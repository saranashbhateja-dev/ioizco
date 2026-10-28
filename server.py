"""IOI OS local PC server, matching the Node server's port and version endpoints."""
from __future__ import annotations
import json, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parent
HOST = '127.0.0.1'
PORT = int(os.environ.get('PORT', '8766'))
BUILD_ID = 'ioi-cloud-8766-v1.1'
class IOIHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)
    def do_GET(self):
        route = urlsplit(self.path).path
        if route in ('/health', '/__ioi_version'):
            body = json.dumps({'ok': True, 'name': 'IOI OS', 'build': BUILD_ID, 'port': PORT}).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store, max-age=0')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.end_headers(); self.wfile.write(body); return
        return super().do_GET()
    def do_HEAD(self):
        route = urlsplit(self.path).path
        if route in ('/health', '/__ioi_version'):
            body = json.dumps({'ok': True, 'name': 'IOI OS', 'build': BUILD_ID, 'port': PORT}).encode()
            self.send_response(200); self.send_header('Content-Type','application/json; charset=utf-8')
            self.send_header('Content-Length',str(len(body))); self.send_header('Cache-Control','no-store, max-age=0')
            self.end_headers(); return
        return super().do_HEAD()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        self.send_header('X-Content-Type-Options', 'nosniff')
        super().end_headers()
    def log_message(self, fmt, *args): print('[IOI OS] ' + fmt % args)
if __name__ == '__main__':
    server = ThreadingHTTPServer((HOST, PORT), IOIHandler)
    print(f'IOI OS {BUILD_ID} running at http://{HOST}:{PORT}/index.html')
    server.serve_forever()
