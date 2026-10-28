# IOI OS — Competitive Programming Command Centre

IOI OS converts the supplied `IOI_Topics_Playlists_CSES_Practice(1).pdf` into an interactive, local-first study dashboard with optional Supabase cloud sync and an Android APK workflow. Its runtime layout follows the same lightweight architecture pattern used by JEE OS and Apex OS.

## Launch on Windows
1. Extract the ZIP to a writable folder.
2. Double-click `START_IOI_OS.bat`.
3. The dashboard opens at **http://127.0.0.1:8766/index.html**.
4. Keep the minimized **IOI OS Local Server** window open while using the PC app.

Node.js 22+ or Python 3 is required. The launcher prefers Node.js and falls back to Python. Port `8766` is the default; set `PORT` manually if running the server from a terminal on another port.

## Architecture
- `index.html` + `styles.css`: responsive dashboard UI.
- `app.js`: local state, progress tracking, timer, analytics, backups, Supabase auth and sync.
- `ioi-curriculum.js`: source-derived ordered topic and practice data.
- `server.cjs` / `server.py`: local static server, health endpoint and build identity check.
- `supabase/migrations/`: RLS-protected cloud state table and merge RPC.
- `.github/workflows/build-apk.yml`: repeatable Android debug APK build.
See `APP_ARCHITECTURE_v1.4.md` for component boundaries and data flow.

## What's included
- All **57 topics** from the supplied PDF, in the original order.
- Linked YouTube playlists and the listed CSES tasks with direct URLs.
- Per-topic playlist checkbox and task checkboxes.
- Completion logic: a topic is complete only when its playlist and all listed tasks are checked.
- Search/filter for CSES tasks, focus timer, manual study-session logging, streak/time summaries, and topic-block analytics.
- Local progress persistence and JSON backup export/import.
- Supabase email/password authentication, debounced cloud sync, Realtime updates, and merge RPC.
- GitHub Actions and Windows scripts for building a debug Android APK.

## Source fidelity
The curriculum data was extracted from the supplied PDF's text and hyperlink annotations. The original topic order and repeated task assignments are preserved. The app does not claim that this sequence alone proves complete coverage of the official IOI syllabus.

## Android APK
See `APK-BUILD-GUIDE.md`. Push the project to GitHub and run **Actions → Build IOI OS APK**. Download the `IOI-OS-debug-apk` artifact after a successful build. No prebuilt APK is included in this ZIP.

## Supabase cloud sync
Open **Settings & backups → Supabase Cloud**, create an account or sign in, and use the same account on PC and Android. Local-first progress remains available while signed out or offline. See `SUPABASE-CLOUD-SYNC.md` for the schema, security model, and Auth setup notes.
