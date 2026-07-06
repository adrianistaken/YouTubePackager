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
- Compare thumbnail variants A, B, and C.
- Export the current preview as a PNG.

## Optional live feed context

By default, YouTube Packager uses generated context videos so the app works without setup. To use real popular YouTube videos in the feed context, set a server-side environment variable before running or deploying:

```sh
cp .env.local.example .env.local
npm run dev
```

Then put your key in `.env.local`.

The live feed uses YouTube Data API `videos.list` with `chart=mostPopular`.
Feed results are cached server-side for 1 hour and can serve stale results for up to 24 hours if YouTube refreshes fail.
