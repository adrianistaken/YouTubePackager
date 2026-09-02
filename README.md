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
