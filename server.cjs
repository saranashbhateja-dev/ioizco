// IOI OS local PC server. Supabase is the cloud state backend; this server serves static assets only.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = __dirname;
const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 8766);
const BUILD_ID = 'ioi-cloud-8766-v1.1';
const MIME = {
  '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8',
  '.webmanifest':'application/manifest+json; charset=utf-8', '.md':'text/markdown; charset=utf-8',
  '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.svg':'image/svg+xml', '.ico':'image/x-icon'
};
const server = http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, {'Allow':'GET, HEAD', 'Content-Type':'text/plain; charset=utf-8'});
    return res.end('Method Not Allowed');
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, `http://${HOST}:${PORT}`).pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/health' || pathname === '/__ioi_version') {
    const body = Buffer.from(JSON.stringify({ok:true, name:'IOI OS', build:BUILD_ID, port:PORT}));
    res.writeHead(200, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Length':body.length});
    return res.end(req.method === 'HEAD' ? undefined : body);
  }
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(ROOT, relative);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
    res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'}); return res.end('Forbidden');
  }
  let stat;
  try { stat = fs.statSync(target); } catch { stat = null; }
  if (!stat || !stat.isFile()) {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}); return res.end('Not found');
  }
  const data = fs.readFileSync(target);
  res.writeHead(200, {'Content-Type':MIME[path.extname(target).toLowerCase()] || 'application/octet-stream','Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Length':data.length});
  return res.end(req.method === 'HEAD' ? undefined : data);
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') console.error(`Port ${PORT} is already in use. Close the other IOI OS server or choose another port.`);
  else console.error(e);
  process.exitCode = 1;
});
server.listen(PORT, HOST, () => console.log(`IOI OS ${BUILD_ID} running at http://${HOST}:${PORT}/index.html`));
