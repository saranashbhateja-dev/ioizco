# IOI OS — Supabase cloud sync

## Connected project
- Supabase URL: `https://bztsnkejidzjjlaghtly.supabase.co`
- Client key: publishable key only (safe for client use with RLS; never add a secret/service-role key to this project)
- Cloud table: `public.ioi_os_cloud_state`
- RPC: `public.ioi_os_merge_cloud_state(jsonb)`

The schema and RPC migration has already been applied to the connected Supabase project. A copy is included at `supabase/migrations/202610270001_ioi_os_cloud_sync.sql` for reference/reproducibility.

## How to use it
1. Start IOI OS on the PC at `http://127.0.0.1:8766/index.html`, or install/open the Android APK.
2. Open **Settings & backups → Supabase Cloud**.
3. Create an account with an email and password (8+ characters). If email confirmation is enabled, confirm the message first, then sign in.
4. Sign in with the same account on the other device.
5. Changes sync after a short debounce; use **Sync now** to force a sync.

Local progress continues to work while signed out or offline. Cloud sync requires an internet connection. The same account is required on both devices. The app stores its Supabase Auth session locally on each device.

## Security model
- The browser/mobile app uses only the Supabase publishable key.
- Row Level Security is enabled on the cloud-state table; authenticated users can access only the row where `user_id = auth.uid()`.
- The merge RPC is `SECURITY INVOKER`, rejects unauthenticated requests, and enforces a 1 MB state-size limit.
- Topic updates use timestamps where available; solved-task lists and study sessions are merged to reduce accidental loss when devices update close together.

## Supabase Auth configuration
In Supabase Dashboard → Authentication → URL Configuration, set the Site URL to the actual URL you use for the hosted web app. For local PC use, the local address is not a good confirmation-link destination; if email confirmation is enabled, confirm the email and then sign in manually in the app. For Android, use the same email/password sign-in after installing the APK.

## Notes
- A first sign-up may require email confirmation depending on the project's Auth settings.
- Do not disable RLS or expose the service-role/secret key.
- This ZIP does not contain a prebuilt APK; the existing GitHub Actions workflow builds it.
