# YouTube Packager

Lightweight YouTube packaging preview tool for checking a thumbnail, title, and channel metadata in realistic desktop and mobile feed layouts.

## Run locally

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## MVP scope

- Upload PNG, JPG, JPEG, or WEBP thumbnails.
- Upload or remove a channel avatar.
- Paste a public YouTube channel URL to fetch the channel avatar automatically.
- Edit title, channel name, views, publish time, and duration.
- Switch between desktop and mobile YouTube-style previews.
- See the package inside a YouTube-style feed with surrounding context videos.
- Compare thumbnail variants A, B, C, D, and E.
- Export a high-quality PNG or a smaller, Notion-friendly JPG.
- Log in with an email link and continue the same saved workspace on another device.

## Login and cross-device sync

The app uses Supabase Auth, Postgres, and Storage. Each account currently has one automatically saved preview workspace. The database structure keeps a separate session ID so multiple projects can be added later without changing how saved data is represented.

1. Create a Supabase project.
2. Open its SQL editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. In **Authentication → URL Configuration**, set the site URL to the deployed app URL and add `http://localhost:5173` as a redirect URL for local development.
4. Copy `.env.local.example` to `.env.local` and provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the Supabase project settings.
5. Add the same two public environment variables to the deployment platform.

When Supabase is not configured, the app remains usable in local-only mode. On a user's first login, the current local workspace becomes their cloud workspace. Later logins load that account's saved workspace. Edits are cached locally immediately and synced to Supabase after a short debounce.

## Optional live feed context

By default, YouTube Packager uses generated context videos so the app works without setup. To use real popular YouTube videos in the feed context, set a server-side environment variable before running or deploying:

```sh
cp .env.local.example .env.local
npm run dev
```

Then put your key in `.env.local`.

The live feed uses YouTube Data API `videos.list` with `chart=mostPopular`.
Feed results are cached server-side for 1 hour and can serve stale results for up to 24 hours if YouTube refreshes fail.

## Public deployment security

For an existing Supabase project, run
[`supabase/migrations/20260913_public_launch_security.sql`](supabase/migrations/20260913_public_launch_security.sql)
in its SQL editor **before deploying this update**. New projects can run `supabase/schema.sql`.
The migration preserves existing workspaces and images. It restricts new uploads to one
avatar and five thumbnail paths per account, each at most 10 MB (60 MB maximum for the
six current assets). Old extra objects are not deleted automatically. Session IDs can
no longer be changed or deleted by the client to evade that limit; administrative
account deletion/cleanup must use a trusted backend. Metadata is limited to 64 KB.

For live YouTube lookups on Vercel, configure a persistent Upstash Redis database and
set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` as **server-only** environment
variables, alongside `YOUTUBE_API_KEY`. Never prefix these secrets with `VITE_`.
The counter uses an atomic Redis script shared across server instances, allowing 10
avatar or 30 feed requests per IP per 60 seconds and 2,000 combined origin requests
per 24-hour window. Cached CDN responses do not consume that allowance. A request can
make at most two YouTube Data API calls. Vercel's overwritten `x-vercel-forwarded-for`
header supplies the client IP; another host needs an equivalent trusted-IP adapter.
Do not trust arbitrary client-supplied forwarding headers.

Production lookups fail closed if the counters are missing or unavailable. Uploaded
images, previews, exports, cloud sync, and generated feed context still work; automatic
avatar lookup displays an availability message. Local development uses in-memory
counters when Redis is not configured. Supported avatar URLs are HTTPS public channel
URLs (`/@handle`, `/channel/ID`, `/user/name`, `/c/name`, including common channel tabs).
Video links and arbitrary redirects are rejected; remote pages and images have size,
timeout, redirect, and destination limits. The feed uses US popular videos.

Also configure hosting firewall/rate limits and provider spending/quota alerts: the
application limiter cannot prevent costs from incoming traffic or unlimited new
account signups. In Supabase, review signup/email rate limits, enable CAPTCHA if
opening registration broadly, and verify the private bucket and RLS policies on the
actual deployed project. Restrict the Google key to the YouTube Data API. Deploy the
built app with the serverless API functions, never an exposed Vite development server.

Account caches are scoped by user. Logout and account switches clear the departing
account's local cache and visible draft. The next login reloads its cloud workspace.
Logout waits for saves. If saving fails, it offers retry or an explicit
"Log out without saving" action; the latter clears the unsynced local draft. A guest draft is adopted once on first account
creation. Existing legacy caches migrate behind their recorded account owner.

Verification: `npm test`, `npm run build`, and `npm audit`.
