# Inundate

A broadcast-style news ticker that displays scrolling headlines from 7 major sources (AP, BBC, Bloomberg, CNN, Fox News, WSJ, Washington Post).

## How it works

`/api/news` serves headlines with a layered, outage-resilient strategy:

1. **Vercel Blob cache** — a recent snapshot is served directly (no upstream calls) when fresh.
2. **CurrentsAPI** (preferred source) — when the cache is stale, refresh per-source via the
   `domain` filter, then write the snapshot back to Blob.
3. **Stale Blob** — if CurrentsAPI is unavailable, serve the last-good snapshot.
4. **RSS feeds** — if there's no usable snapshot, fall back to each outlet's RSS feed.
5. Otherwise return a `502` and the UI shows an (animated) failure message.

Refresh is lazy/on-demand and shielded by the Vercel CDN cache (`s-maxage`), so the Hobby plan's
once-per-day cron limit is a non-issue.

> Note: CurrentsAPI's `domain` filter depends on their service being healthy. During a CurrentsAPI
> outage it returns `Database error occurred` and the app automatically serves Blob/RSS instead.
> Check status at https://currentsapi.services/en/status.

## Setup

1. Install dependencies: `npm install`
2. Create a `.env` file:
   ```
   CURRENTS_API_KEY=your_currents_key   # https://currentsapi.services
   BLOB_READ_WRITE_TOKEN=your_blob_token # Vercel Blob (auto-injected on Vercel)
   ```
   The RSS fallback needs no key, so the 7 rows still populate without `CURRENTS_API_KEY`.

## Development

```
vercel dev
```

Runs the Vite frontend and the `/api/news` function together at `http://localhost:3000`.

`npm run dev` runs the frontend only — `/api/news` is unavailable, so the rows render the
failure ticker (useful for previewing that state).

## Other Commands

- Run tests: `npm test`
- Production build: `npm run build`
