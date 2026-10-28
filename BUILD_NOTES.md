# IOI OS — Build and Validation Notes

## Local PC
- Start with `START_IOI_OS.bat`.
- Default address: `http://127.0.0.1:8766/index.html`.
- Health check: `http://127.0.0.1:8766/health`.
- Build identity: `http://127.0.0.1:8766/__ioi_version`.
- The launcher reuses an existing server only when its build ID matches this release.

## Android
The workflow copies the frontend assets to `www/`, adds the Capacitor Android platform, syncs, and builds a debug APK. Download the `IOI-OS-debug-apk` artifact from GitHub Actions.

## Cloud
The Supabase migration is included under `supabase/migrations/`. The connected project's table/RLS/function structure was checked separately. A complete account-based PC-to-device end-to-end sync test and an actual APK build are not claimed by these packaging notes.
