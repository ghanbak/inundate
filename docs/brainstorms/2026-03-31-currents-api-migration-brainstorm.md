# Currents API Migration Brainstorm

**Date:** 2026-03-31
**Status:** Ready for planning

## What We're Building

Migrate the news data source from NewsAPI (`newsapi.org/v2/top-headlines`) to the Currents API (`api.currentsapi.services/v1/search`). Motivation: Currents API is cheaper and has a more generous free tier (1,000 requests/day).

Keep the same 7 news sources (AP, BBC, Bloomberg, CNN, Fox News, WSJ, WaPo) and the same frontend UX. The migration should be invisible to end users.

## Why This Approach

**Approach chosen: Normalize at the server**

The Currents API requires one request per domain (no multi-source param), and its response shape differs from NewsAPI (`news` array vs `articles`, no `source.id`). Rather than updating the frontend to handle a new response shape, the server will:

1. Make 7 parallel fetch calls to Currents API (one per source domain)
2. Transform responses to match the existing NewsAPI shape the frontend expects
3. Cache the combined result server-side with a 15-minute TTL

This keeps changes isolated to `api/news.js` and `sources.js`. The frontend stays untouched.

**Why not adapt both ends:** More files to change, couples frontend to Currents-specific response shape, harder to swap APIs again in the future.

## Key Decisions

- **API version:** V1 (stable, simple pagination)
- **Server-side cache TTL:** 15 minutes (~672 API calls/day max)
- **Client-side polling interval:** 10 minutes (up from 5)
- **Domain mapping:** Explicit `domain` field added to each source in `sources.js`
- **Response normalization:** Server transforms Currents response to match NewsAPI shape so frontend needs no changes
- **Auth:** API key via query param (`apiKey=`), stored in env as `CURRENTS_API_KEY` (already exists in `.env`)
- **Endpoint:** `https://api.currentsapi.services/v1/search?domain=<domain>&language=en&apiKey=<key>`

## Domain Mapping

| Source | Current ID | Currents Domain |
|--------|-----------|-----------------|
| AP | associated-press | apnews.com |
| BBC | bbc-news | bbc.com |
| Bloomberg | bloomberg | bloomberg.com |
| CNN | cnn | cnn.com |
| Fox News | fox-news | foxnews.com |
| WSJ | the-wall-street-journal | wsj.com |
| WaPo | the-washington-post | washingtonpost.com |

## Open Questions

- Should we keep the NewsAPI key/handler as a fallback if Currents API is down?
- What `page_size` to use per source? (default 30, max 300 — 30 is likely sufficient for a ticker)
