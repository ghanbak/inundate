---
title: "fix: Add Vercel edge caching to /api/news"
type: fix
date: 2026-04-01
---

# Add Vercel Edge Caching to /api/news

## Overview

The in-memory cache in `api/news.js` resets on every serverless cold start, causing 7 Currents API calls per request and burning through the free tier daily quota. Add `Cache-Control` response headers so Vercel's CDN caches the response at the edge for 1 hour, preventing the function from executing at all during the cache window. Remove the in-memory cache entirely — one caching layer (edge) is simpler and sufficient.

**Brainstorm:** `docs/brainstorms/2026-04-01-api-caching-brainstorm.md`

## Acceptance Criteria

- [x] Successful responses include `Cache-Control: s-maxage=3600, stale-while-revalidate=300`
- [x] Error responses include `Cache-Control: s-maxage=60` (short TTL to retry sooner)
- [x] Config error (missing API key) includes `Cache-Control: s-maxage=0, must-revalidate`
- [x] In-memory cache, stampede protection, and `getArticles` wrapper removed
- [x] No change to response body format
- [x] `npm run build` passes

## Files to Change

| File | Change |
|------|--------|
| `api/news.js` | Remove in-memory cache, add `Cache-Control` headers, call `fetchAllSources` directly |

## Implementation

### `api/news.js`

Strip down to: fetch sources, set headers, return response. ~25 lines instead of 65.

```js
import SOURCES from "../src/sources.js";

async function fetchAllSources(apiKey) {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const url = `https://api.currentsapi.services/v1/search?domain=${source.domain}&language=en&apiKey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });

      if (!res.ok) return [];

      const json = await res.json();
      if (json.status !== "ok") return [];

      const seen = new Set();
      return json.news
        .filter((item) => {
          if (seen.has(item.url)) return false;
          seen.add(item.url);
          return true;
        })
        .map((item) => ({
          source: { id: source.id },
          title: item.title,
          url: item.url,
          publishedAt: item.published,
          urlToImage: item.image,
          description: item.description,
          author: item.author,
        }));
    })
  );

  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export default async function handler(req, res) {
  const apiKey = process.env.CURRENTS_API_KEY;

  if (!apiKey) {
    res.setHeader("Cache-Control", "s-maxage=0, must-revalidate");
    return res.status(500).json({ error: "CURRENTS_API_KEY not configured" });
  }

  const articles = await fetchAllSources(apiKey);
  const data = { status: "ok", articles };

  if (articles.length > 0) {
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=300");
  } else {
    res.setHeader("Cache-Control", "s-maxage=60");
  }

  res.status(200).json(data);
}
```

## Review Feedback Applied

- **Simplicity reviewer:** Removed in-memory cache entirely. One caching layer (Vercel edge) instead of two. Function goes from 65 to ~25 lines.
- **Kieran:** Added `Cache-Control: s-maxage=0, must-revalidate` to the 500/missing-key early return path.
- **DHH:** Confirmed approach is correct. No invalidation infra needed for a news ticker.

## Context

- `s-maxage` controls Vercel's CDN cache (not the browser). Browser won't cache because there's no `max-age`.
- `stale-while-revalidate=300` means after the 1-hour TTL expires, the edge serves stale data immediately while triggering a background refresh. Users never see a slow request.
- Quota savings depend on number of edge PoPs — real number is ~24/day per PoP, not flat.
