# IOI OS — Android APK build

## Build automatically with GitHub Actions

1. Extract this ZIP.
2. Create a GitHub repository and upload the **contents of the `IOI OS` folder** to the repository root. Keep `.github/workflows/build-apk.yml` at that root.
3. Push to `main`, or open **GitHub → Actions → Build IOI OS APK → Run workflow**.
4. Wait for the workflow to complete.
5. Download the `IOI-OS-debug-apk` artifact from the completed workflow run.
6. Extract the artifact ZIP to get `app-debug.apk`.

## Build locally on Windows

Requirements: Node.js 22+, Java 21, Android Studio / Android SDK.

Run `android-build.bat`. The output should be:
`android\app\build\outputs\apk\debug\app-debug.apk`

## Notes

- This produces a debug APK, not a Play Store-signed release.
- Progress is stored locally first and syncs through Supabase after you sign in. Use the same email/password on PC and Android to share progress. Local progress and JSON backup/import remain available when signed out or offline. See `SUPABASE-CLOUD-SYNC.md`.
- YouTube and CSES links open externally and require internet access.
- The APK workflow is included but an APK is not prebuilt in this ZIP.
