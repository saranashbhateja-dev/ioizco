# IOI OS — Application Architecture v1.2

## Architecture model
IOI OS follows the lightweight local-first architecture used by JEE OS and Apex OS: a static web UI, a small local PC server, a Supabase persistence layer, and a Capacitor Android wrapper built by GitHub Actions. It does not require a frontend framework or a separate local database server.

## Runtime boundaries
- **Presentation:** `index.html` defines the views and accessible structure; `styles.css` owns responsive layout and visual tokens.
- **Curriculum source:** `ioi-curriculum.js` holds the ordered topics, playlist URLs, and CSES assignments extracted from the supplied PDF.
- **Client state and interactions:** `app.js` owns rendering, checklists, timer, analytics, local persistence, backup/import, authentication, and sync orchestration.
- **Local PC server:** `server.cjs` is the primary static server; `server.py` is a Python fallback. Both bind to `127.0.0.1:8766` by default and expose `/health` and `/__ioi_version`. They serve files only and do not proxy secrets or hold user data.
- **Cloud persistence:** Supabase Auth identifies the user; `public.ioi_os_cloud_state` stores the JSON state under row-level security; `public.ioi_os_merge_cloud_state(jsonb)` merges incoming state using the authenticated user's permissions. Only the publishable client key is included.
- **Android:** Capacitor packages the same frontend into the Android WebView. GitHub Actions creates the `IOI-OS-debug-apk` artifact. The PC port is unrelated to Android networking.

## Data flow
1. Interactions update in-memory state and `localStorage` immediately.
2. If signed in and online, a debounced write invokes the merge RPC.
3. Supabase Realtime notifications merge cloud updates into local state.
4. Offline or signed-out use remains local-first; users can export/import a JSON backup.
5. PC and Android share progress when signed in to the same Supabase account.

## Security and reliability
- Never place a Supabase service-role/secret key in browser or Android code.
- RLS restricts each account to its own row. The merge RPC runs as `SECURITY INVOKER` and rejects unauthenticated calls.
- The launcher checks the running build ID before reusing port 8766; it does not kill arbitrary processes.
- The static server accepts only GET/HEAD, normalizes paths, prevents traversal, and disables caching for development releases.
- Curriculum data and local tracking remain usable if Supabase is unavailable.

## Project layout
- `index.html`, `styles.css`, `app.js`, `ioi-curriculum.js` — application frontend
- `server.cjs`, `server.py`, `START_IOI_OS.bat` — local PC runtime on port 8766
- `supabase/migrations/` and `SUPABASE-CLOUD-SYNC.md` — cloud schema and setup notes
- `capacitor.config.json`, `android-build.bat`, `.github/workflows/build-apk.yml` — Android packaging
