---
title: Migrate from NewsAPI to Currents API
type: feat
date: 2026-03-31
---

# Migrate from NewsAPI to Currents API

## Overview

Replace NewsAPI (`newsapi.org/v2/top-headlines`) with Currents API (`api.currentsapi.services/v1/search`) as the news data source. Motivation: cheaper, more generous free tier (1,000 requests/day).

The migration is server-side only. The frontend contract stays the same -- `api/news.js` normalizes Currents API responses to match the existing NewsAPI shape.

**Brainstorm:** `docs/brainstorms/2026-03-31-currents-api-migration-brainstorm.md`

## Acceptance Criteria

- [x] `api/news.js` fetches from Currents API v1 search endpoint using `CURRENTS_API_KEY`
- [x] 7 parallel fetches (one per source domain) replace the single NewsAPI call
- [x] Response shape matches existing contract: `{ status: "ok", articles: [{ source: { id }, title, url, ... }] }`
- [x] Server-side in-memory cache with 15-minute TTL
- [x] Stampede protection: concurrent requests share a single in-flight fetch
- [x] Partial failure: successful sources return articles; failed sources return empty arrays; overall status stays `"ok"`
- [x] Stale cache served when refresh fails (graceful degradation)
- [x] `sources.js` includes explicit `domain` field for each source
- [x] Client polling interval updated from 5 to 10 minutes in `App.jsx`
- [ ] All 7 source tickers display headlines from Currents API

## Files to Change

| File | Change |
|------|--------|
| `src/sources.js` | Add `domain` field to each source |
| `api/news.js` | Rewrite: Currents API calls, response normalization, caching |
| `src/App.jsx` | Update polling interval from `5 * 60 * 1000` to `10 * 60 * 1000` |

## Implementation

### 1. Add `domain` field to `src/sources.js`

```js
const SOURCES = [
  { id: "associated-press", name: "AP", color: "#ff4444", favicon: "https://www.google.com/s2/favicons?domain=apnews.com&sz=64", domain: "apnews.com" },
  { id: "bbc-news", name: "BBC", color: "#bb1919", favicon: "https://www.google.com/s2/favicons?domain=bbc.com&sz=64", domain: "bbc.com" },
  { id: "bloomberg", name: "Bloomberg", color: "#472a91", favicon: "https://www.google.com/s2/favicons?domain=bloomberg.com&sz=64", domain: "bloomberg.com" },
  { id: "cnn", name: "CNN", color: "#cc0000", favicon: "https://www.google.com/s2/favicons?domain=cnn.com&sz=64", domain: "cnn.com" },
  { id: "fox-news", name: "Fox News", color: "#003366", favicon: "https://www.google.com/s2/favicons?domain=foxnews.com&sz=64", domain: "foxnews.com" },
  { id: "the-wall-street-journal", name: "WSJ", color: "#0274b6", favicon: "https://www.google.com/s2/favicons?domain=wsj.com&sz=64", domain: "wsj.com" },
  { id: "the-washington-post", name: "WaPo", color: "#231f20", favicon: "https://www.google.com/s2/favicons?domain=washingtonpost.com&sz=64", domain: "washingtonpost.com" },
];

export default SOURCES;
```

### 2. Rewrite `api/news.js`

Key design decisions:
- **Cache**: Module-scoped variable storing `{ data, timestamp }`. Serves cached response if `Date.now() - timestamp < 15 * 60 * 1000`.
- **Stampede protection**: Store the in-flight Promise. Concurrent requests await the same Promise instead of triggering duplicate fetches.
- **Stale-on-error**: If a refresh fails entirely, serve stale cache if available.
- **Partial failure**: Use `Promise.allSettled` so one failed source doesn't break the others. Failed sources produce zero articles.
- **Per-fetch timeout**: `AbortSignal.timeout(8000)` on each fetch call (Vercel Hobby has 10s function timeout).
- **Response normalization**: Inject `source: { id }` into each article, map `news` array items to the frontend's expected shape.

```js
// api/news.js
import SOURCES from "../src/sources.js";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let cache = { data: null, timestamp: 0 };
let inflight = null;

async function fetchAllSources(apiKey) {
  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const url = `https://api.currentsapi.services/v1/search?domain=${source.domain}&language=en&apiKey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();

      if (json.status !== "ok") return [];

      return json.news.map((item) => ({
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

async function getArticles(apiKey) {
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL) {
    return cache.data;
  }

  // Stampede protection: reuse in-flight promise
  if (inflight) return inflight;

  inflight = fetchAllSources(apiKey)
    .then((articles) => {
      const data = { status: "ok", articles };
      cache = { data, timestamp: Date.now() };
      return data;
    })
    .catch(() => {
      // Serve stale cache on failure
      if (cache.data) return cache.data;
      return { status: "error", message: "Failed to fetch news" };
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

export default async function handler(req, res) {
  const apiKey = process.env.CURRENTS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "CURRENTS_API_KEY not configured" });
  }

  const data = await getArticles(apiKey);
  res.status(data.status === "ok" ? 200 : 502).json(data);
}
```

### 3. Update polling interval in `src/App.jsx`

Change line 44:

```js
// Before
const interval = setInterval(() => fetchData(controller.signal), 5 * 60 * 1000);

// After
const interval = setInterval(() => fetchData(controller.signal), 10 * 60 * 1000);
```

## Deployment Steps

1. Ensure `CURRENTS_API_KEY` is set in Vercel dashboard environment variables
2. Deploy changes
3. Verify all 7 source rows show headlines
4. Monitor Currents API usage in their dashboard for the first day

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Wrong domain string returns empty results silently | Medium | Test each domain against the Currents API before deploying |
| Multiple Vercel instances each maintain separate caches, multiplying API calls | Low (low-traffic site) | Monitor usage; upgrade to Vercel KV if needed |
| Currents API slower than NewsAPI, hitting 10s function timeout | Low | 8s per-fetch timeout via `AbortSignal.timeout()` |
| Rate limit exhaustion (1,000/day) | Low | Cache + stampede protection keeps usage at ~672 calls/day for single instance |

## Context

- Currents API docs: https://currentsapi.services/en/docs/
- Search endpoint docs: https://currentsapi.services/en/docs/search
- `CURRENTS_API_KEY` already exists in `.env`
- `.env` is excluded from git via `.gitignore` (line 60: `.env*`)
