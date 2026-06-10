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
2. Provide secrets (see below). The RSS fallback needs no key, so the 7 rows still populate
   even without `CURRENTS_API_KEY`.

### Environment variables

| Variable | Used for | Where it comes from |
| --- | --- | --- |
| `CURRENTS_API_KEY` | Preferred headline source ([currentsapi.services](https://currentsapi.services)) | Add to `.env` |
| `BLOB_READ_WRITE_TOKEN` | Read/write the cached snapshot in [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) | **Auto-injected in production** when the Blob store is linked to the project. Locally, pull it with `vercel env pull .env.local` |

Both `.env` and `.env.local` are gitignored (`.env*`), so neither is committed.

> The cache snapshot is written with `access: "public"` (it's just public headlines, served back
> via a plain `fetch` of the blob URL). Don't switch it to `private` — the read path would then
> require authentication.

## Development

```
vercel dev
```

Runs the Vite frontend **and** the `/api/news` function together at `http://localhost:3000`, with
`CURRENTS_API_KEY` / `BLOB_READ_WRITE_TOKEN` loaded from `.env` / `.env.local`. This is the only
way to exercise Blob caching and the source fallback locally.

`npm run dev` runs the frontend only — `/api/news` is unavailable, so every row renders the
failure ticker (useful for previewing that state).

## Other Commands

- Run tests: `npm test`
- Production build: `npm run build`
