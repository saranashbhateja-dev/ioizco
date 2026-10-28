# IOI OS — Final UI, Cloud and APK Release

- **PC URL:** `http://127.0.0.1:8766/index.html`
- **Default port:** `8766`
- **PC launch:** `START_IOI_OS.bat` (Node.js primary, Python fallback)
- **Cloud:** Supabase Auth + RLS-protected `ioi_os_cloud_state` + merge RPC
- **Android:** Capacitor + GitHub Actions workflow at `.github/workflows/build-apk.yml`
- **Artifact:** `IOI-OS-debug-apk`

The release keeps the local-first UI/state architecture while separating static serving, curriculum data, cloud persistence, and Android packaging. The ZIP contains source and build scripts, not a prebuilt APK.
