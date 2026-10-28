# IOI OS Cloud Sync Edition v1.1

- Standardized the PC runtime architecture around a small static server, following the JEE OS/Apex OS layout.
- Set the default local PC port to **8766**.
- Added Node.js and Python server implementations with `/health` and `/__ioi_version` endpoints.
- Added a launcher that detects port conflicts and avoids opening an older build silently.
- Kept Supabase Auth, local-first progress, RLS-protected cloud state, and the merge RPC.
- Retained the Capacitor configuration and GitHub Actions APK workflow.
- Removed unrelated Apex OS university/calendar artifacts from the IOI OS package.


## Architecture and port update v1.2
- Aligned the PC runtime conventions with JEE OS and Apex OS: local static server, health/version endpoints, no-cache responses, safe path handling, and launcher build detection.
- Selected port 8766 for IOI OS, distinct from the previous 1311 and Apex OS 8765.
- Updated Node/Python servers, launcher, README, architecture notes, and package metadata together.
