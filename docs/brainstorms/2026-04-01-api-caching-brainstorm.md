---
title: API Response Caching with Vercel Edge
date: 2026-04-01
---

# API Response Caching

## What We're Building

Add HTTP cache headers (`Cache-Control: s-maxage=3600, stale-while-revalidate=300`) to the `/api/news` serverless function response. This lets Vercel's CDN edge cache the response for 1 hour, preventing the function from executing at all for cached requests. After the 1-hour window, `stale-while-revalidate` serves the stale response immediately while refreshing in the background.

## Why This Approach

- **Problem:** The current in-memory cache in `api/news.js` resets on every cold start. With 7 Currents API calls per request and frequent cold starts, the free tier daily quota gets exhausted quickly.
- **HTTP edge caching is the simplest fix:** One line of header code, zero dependencies, zero cost. The function doesn't even execute during the cache window, so it can't burn API quota.
- **Hourly freshness is acceptable** for a news aggregator — stories don't need sub-minute updates.
- **Alternatives considered:**
  - `/tmp` file cache: Still resets on cold starts, just less often. Marginal improvement.
  - Upstash Redis: True persistence but adds an external dependency and account for a problem solvable with headers.

## Key Decisions

- **TTL: 1 hour** (`s-maxage=3600`) — matches the user's freshness tolerance and dramatically reduces API calls (from ~100s/day to ~24/day per edge location)
- **stale-while-revalidate: 5 minutes** (`stale-while-revalidate=300`) — after TTL expires, serve stale while refreshing in background so users never see a slow request
- **Keep in-memory cache as fallback** — still useful within a warm container for requests that bypass edge (e.g., cache purge)
- **Increase in-memory TTL to 1 hour** to match edge TTL

## Open Questions

- Should we add a manual cache purge mechanism (e.g., `?purge=1` with a secret) for breaking news?
- Should error responses also be cached (with a shorter TTL) to avoid hammering a failing API?
