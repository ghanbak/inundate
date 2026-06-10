---
title: Restore headlines on inundate.us — CurrentsAPI primary, Vercel Blob cache, RSS fallback
type: fix
date: 2026-06-09
---

# 🐛 Fix: Restore news headlines on inundate.us

## Overview

Every source row on https://www.inundate.us/ shows **"No headlines available."** `/api/news`
returns `{"status":"ok","articles":[]}` (HTTP 200) on every request.

**Root cause: a CurrentsAPI partial outage** degrading the `domain` filter the app depends on.
The status page (https://currentsapi.services/en/status) reports **`partial_outage`** (confirmed
2026-06-09 23:37 UTC). During it, `domain`-filtered requests return `400 Database error occurred`
(v1) / `500 Internal server error` (v2) for **every** domain — even CurrentsAPI's own docs example
`reuters.com` — while every request *without* `domain` (and the sibling `domain_not`) works
normally. So the `domain` per-source query is correct; the upstream is just temporarily broken.

A secondary bug means that outage renders as the innocuous "No headlines available" instead of an error.

**Strategy (per owner decision):** keep **CurrentsAPI as the preferred source** with the existing
per-source `domain` call **unchanged**, and make the app resilient to outages like this one by:

1. **Caching CurrentsAPI results server-side in Vercel Blob** (gives `BLOB_READ_WRITE_TOKEN` its
   purpose) so the UI is served from a durable snapshot and survives transient upstream outages
   by serving last-good data.
2. **Falling back to per-source RSS feeds** when CurrentsAPI is down *and* there's no usable Blob
   snapshot — so a fresh visitor during an outage still sees real headlines.

Also fix the silent-failure bug so a genuine total outage shows a real error, not "No headlines available".

## Problem Statement

### Root cause — confirmed via live testing + status page

`api/news.js:6` calls `https://api.currentsapi.services/v1/search?domain=${source.domain}&language=en&apiKey=${apiKey}`.

- During the current **partial outage**, every `domain`-filtered call errors: v1 → HTTP 400
  `{"status":"400","msg":"Database error occurred"}`; v2 → HTTP 500 `"Internal server error"`.
  Tested across all 7 outlet domains, both endpoints (`/search`, `/latest-news`), both versions,
  single + comma-list + repeated-param, and with/without `keywords`/`type`/`page_size`.
- The **identical-format** `domain_not` param and all non-`domain` queries return `200 + data`,
  which is how we localized the failure to the `domain` (include) path specifically — consistent
  with a partial outage of that component.
- **Auth is fine.** `?apiKey=` query auth (what the code uses) works identically to
  `Authorization: Bearer`. No auth change needed.

### Secondary bug — outage masquerades as "no news"

- `api/news.js:9` `if (!res.ok) return []` swallows the per-source 400, and the handler still
  returns **HTTP 200 / `status:"ok"`** with an empty `articles` array (`:44-53`).
- The UI then shows **"No headlines available"** (`src/App.jsx:135-138`) instead of an error.
- `src/App.jsx:48` reads `setError(data.message)` but the API uses the key `error` (`:41`) → the
  message is `undefined` even on a real 500.

These must be fixed regardless of source, so a future outage is visibly an error, not silent emptiness.

## Proposed Solution

### Data flow

```
Browser ─ GET /api/news ─▶ api/news.js
                              │
                              ├─ 1. read snapshot from Vercel Blob (list → fetch)
                              │      • fresh (age < TTL) → serve it, done (no upstream calls)
                              │
                              ├─ 2. stale/missing → refresh from CurrentsAPI (7× domain calls, unchanged)
                              │      • success → write snapshot to Blob, serve
                              │
                              ├─ 3. CurrentsAPI fails (outage):
                              │      • stale snapshot exists → serve STALE (last-good)
                              │      • else → fetch RSS fallback (7 outlet feeds) → serve
                              │
                              └─ 4. everything fails → 502 + error (UI shows a real message)
```

- **Hobby-plan friendly:** refresh is **lazy / on-demand** (triggered when the snapshot is stale),
  not a cron job — Vercel Hobby caps cron at once/day, too stale for this. The `s-maxage=1800` edge
  cache means the *steady state* hits the origin ~once per 30 min. Note: the CDN does **not** dedupe
  concurrent origin *misses* (cold edge after deploy, or the moment a window expires) — those can
  each fire a CurrentsAPI refresh. At hobby traffic and ≈7 calls/refresh against a 1,000/day budget
  this is acceptable; `stale-while-revalidate` covers the common stale case with a single revalidation.
- **CurrentsAPI call is left exactly as-is** (`/v1/search?domain=...&language=en&apiKey=`) — it's
  the preferred source and is correct; only the surrounding caching/fallback/error handling changes.

### Phase 1 — Vercel Blob caching layer (primary resilience)

- `npm install @vercel/blob`. Keep `BLOB_READ_WRITE_TOKEN` (set in Vercel env).
- Snapshot shape written to Blob key `news/latest.json`:
  ```json
  { "generatedAt": 1749510000000, "source": "currents" | "rss",
    "articles": [ /* normalized */ ], "sources": { "bbc-news": "ok", "cnn": "error", ... } }
  ```
- Read the snapshot via the SDK's `list()` (the public URL isn't knowable at code-time, so don't
  hardcode it):
  ```js
  import { list, put } from "@vercel/blob";
  const FRESH_TTL = 30 * 60 * 1000; // 30 min

  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

  async function readSnapshot() {
    try {
      // list() takes no AbortSignal — guard it with a race so a hung Blob API can't hang the handler
      const { blobs } = await withTimeout(list({ prefix: "news/latest.json", limit: 1 }), 3000);
      if (!blobs[0]) return null;
      const snap = await fetch(blobs[0].url, { signal: AbortSignal.timeout(5000) }).then((r) => r.json());
      return { ...snap, age: Date.now() - (snap.generatedAt || 0) };
    } catch (e) { console.error("readSnapshot failed:", e?.message); return null; } // best-effort
  }

  async function writeSnapshot(snap) {
    try {
      await put("news/latest.json", JSON.stringify(snap), {
        access: "public", contentType: "application/json",
        addRandomSuffix: false, allowOverwrite: true,
      });
    } catch { /* non-fatal: still serve the freshly-fetched data */ }
  }
  ```

### Phase 2 — CurrentsAPI fetch (unchanged call) → normalized + per-source health

Preserve the existing per-source `domain` request; wrap each so it never rejects (order-independent
health tracking):
```js
async function fetchCurrentsSource(source, apiKey) {
  try {
    // UNCHANGED URL — the preferred call
    const url = `https://api.currentsapi.services/v1/search?domain=${source.domain}&language=en&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.msg || "currents error");
    const seen = new Set();
    const articles = json.news
      .filter((it) => it.url && !seen.has(it.url) && seen.add(it.url))
      .map((it) => ({
        source: { id: source.id }, title: it.title, url: it.url,
        publishedAt: it.published, urlToImage: it.image,
        description: it.description, author: it.author,
      }));
    return { id: source.id, ok: true, articles };
  } catch (e) { console.error("currents", source.id, e?.message); return { id: source.id, ok: false, articles: [] }; }
}

async function refreshFromCurrents(apiKey) {
  const results = await Promise.all(SOURCES.map((s) => fetchCurrentsSource(s, apiKey)));
  return {
    source: "currents",
    sources: Object.fromEntries(results.map((r) => [r.id, r.ok ? "ok" : "error"])),
    articles: results.flatMap((r) => r.articles),
    anyOk: results.some((r) => r.ok && r.articles.length),
  };
}
```

### Phase 3 — RSS fallback (only when CurrentsAPI down & no snapshot)

Verified feeds (2026-06-09): BBC, CNN, Fox, WSJ, WaPo, Bloomberg return 200 + items; AP via Google
News RSS (`https://news.google.com/rss/search?q=when:1d+site:apnews.com&hl=en-US&gl=US&ceid=US:en`).
Requires `User-Agent: Mozilla/5.0`. Add `feedUrl` to each entry in `src/sources.js` (alongside the
existing `domain`, which CurrentsAPI still uses).

```js
import { XMLParser } from "fast-xml-parser"; // npm install fast-xml-parser
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" }); // decodes entities/CDATA
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, "").trim();

function resolveLink(item) {                  // RSS string vs Atom array vs guid fallback
  const l = item.link;
  if (Array.isArray(l)) { const a = l.find((x) => x?.["@_rel"] === "alternate") ?? l[0]; return a?.["@_href"] ?? a; }
  if (l && typeof l === "object") return l["@_href"];
  if (typeof l === "string") return l;
  const g = item.guid; return typeof g === "object" ? g["#text"] : g;
}
function resolveImage(item) { const m = item["media:content"] ?? item.enclosure; const f = Array.isArray(m) ? m[0] : m; return f?.["@_url"] ?? null; }

async function fetchRssSource(source) {
  try {
    const res = await fetch(source.feedUrl, { headers: { "User-Agent": "Mozilla/5.0 (inundate.us)" }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = parser.parse(await res.text());
    const raw = xml?.rss?.channel?.item ?? xml?.feed?.entry ?? [];
    const items = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    const seen = new Set();
    const articles = items.map((it) => ({
      source: { id: source.id },
      title: typeof it.title === "object" ? it.title["#text"] : it.title,
      url: resolveLink(it),
      publishedAt: it.pubDate ?? it.published ?? it.updated ?? null,
      description: stripHtml(it.description ?? it.summary ?? ""),
      urlToImage: resolveImage(it),
      author: it["dc:creator"] ?? it.author?.name ?? it.author ?? null,
    })).filter((a) => a.url && !seen.has(a.url) && seen.add(a.url))
      .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 15);
    return { id: source.id, ok: true, articles };
  } catch (e) { console.error("rss", source.id, e?.message); return { id: source.id, ok: false, articles: [] }; }
}
```
> **Scope the parser to what we actually use (review/YAGNI).** All 7 verified feeds are **RSS 2.0**
> (`<item>`/`<link>`-as-string/`<pubDate>`), incl. Google News for AP. Confirm each feed's format
> during implementation; the normalizer targets RSS 2.0 and keeps only minimal defensive guards
> (single-vs-array `item`, missing fields). The Atom branch (`feed.entry`, array-`link`
> `rel="alternate"`, `published`/`updated`) is included **only** if a feed actually needs it — don't
> ship a generic Atom parser for inputs we never hit. Also: `resolveLink` must return a non-empty
> **string** (guard against returning a link object), since a bad `url` breaks the `<a href>` and React keys.
> Known fallback-quality note: Google News (AP) yields `news.google.com` redirect links and " - AP"-suffixed titles.

### Phase 4 — Handler: tie it together + correct error semantics

```js
const FRESH_TTL = 30 * 60 * 1000;   // Blob snapshot considered fresh for 30 min
const STALE_MAX = 3 * 60 * 60 * 1000; // serve stale Blob only if < 3h old, else prefer fresh RSS
const FRESH_CACHE = "s-maxage=1800, stale-while-revalidate=3600"; // good data: long edge cache
const DEGRADED_CACHE = "s-maxage=120, stale-while-revalidate=120"; // stale/RSS: escape fast when Currents recovers

export default async function handler(req, res) {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) console.error("CURRENTS_API_KEY not configured — will serve cache/RSS only");

  // 1. Fresh cache → serve immediately, no upstream calls
  const snap = await readSnapshot();
  if (snap && snap.age < FRESH_TTL && snap.articles?.length) {
    res.setHeader("Cache-Control", FRESH_CACHE);
    return res.status(200).json({ status: "ok", source: snap.source, articles: snap.articles, sources: snap.sources });
  }

  // 2. Refresh from CurrentsAPI (preferred)
  const fresh = apiKey ? await refreshFromCurrents(apiKey) : { anyOk: false };
  if (fresh.anyOk) {
    await writeSnapshot({ generatedAt: Date.now(), ...fresh });
    res.setHeader("Cache-Control", FRESH_CACHE);
    return res.status(200).json({ status: "ok", source: "currents", articles: fresh.articles, sources: fresh.sources });
  }

  // 3a. CurrentsAPI down but we have a RECENT snapshot → serve last-good (preferred source data)
  if (snap && snap.articles?.length && snap.age < STALE_MAX) {
    res.setHeader("Cache-Control", DEGRADED_CACHE);  // retry Currents soon
    return res.status(200).json({ status: "ok", source: snap.source, stale: true, articles: snap.articles, sources: snap.sources });
  }

  // 3b. No usable snapshot → RSS fallback
  const rss = await Promise.all(SOURCES.map(fetchRssSource));
  const rssArticles = rss.flatMap((r) => r.articles);
  if (rssArticles.length) {
    const sources = Object.fromEntries(rss.map((r) => [r.id, r.ok ? "ok" : "error"]));
    await writeSnapshot({ generatedAt: Date.now(), source: "rss", articles: rssArticles, sources });
    res.setHeader("Cache-Control", DEGRADED_CACHE);  // RSS is degraded — don't cache long
    return res.status(200).json({ status: "ok", source: "rss", articles: rssArticles, sources });
  }

  // 4. Everything failed → real error (UI shows the animated "touch grass" message)
  res.setHeader("Cache-Control", "s-maxage=30");
  return res.status(502).json({ status: "error", error: "All news sources are unavailable" });
}
```
> **Cache rationale (review fix):** good data (CurrentsAPI fresh, or a fresh Blob) gets a long edge
> cache (`s-maxage=1800`) so the origin — and CurrentsAPI — is hit at most ~once per 30 min
> regardless of traffic (≈48 refreshes/day × 7 calls ≈ 336/day, well under 1,000). Degraded data
> (stale Blob / RSS) gets a **short** cache so the site flushes back to fresh CurrentsAPI quickly
> once the outage clears. The `s-maxage` was deliberately **not** lowered to 300 (an earlier draft did
> that — it would have 12×'d origin traffic for no benefit, since Blob is the durable layer).

### Phase 5 — Frontend fixes + animated failure state (`src/App.jsx`)
- Line 48: `setError(data.message)` → `setError(data.error)`.
- `fetchData`: handle non-OK HTTP while preserving the body message:
  ```js
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.status !== "ok") {
    setError(data?.error ?? "Failed to fetch news. Please try again later.");
    return;
  }
  ```
- **Animated failure state.** Today an empty/errored row renders static text (`src/App.jsx:131-138`):
  the `error`/`No headlines available` branches. Replace that static text with the **same scrolling
  ticker animation** used for real headlines, repeating the copy:
  > **"The internet is borked. This is your sign to go outside and touch grass."**

  **Implementation (normalize to one item list — avoids the two bugs below).** Do **not** branch
  `TickerScroll` internally on `articles` vs `message`. Instead normalize at the call site into a
  single `items` array of `{ key, text, href }` and let `TickerScroll` render one `.map` per copy,
  emitting `<a href>` when `href` is set and a dim `<span>` otherwise:
  ```jsx
  // call site (row body) — replaces the loading/error/empty branches:
  {loading
    ? <span className="text-hud-subtle text-xs italic">Loading...</span>
    : <TickerScroll items={sourceArticles.length ? toItems(sourceArticles) : BORKED_ITEMS} />}

  // headlines → linkable items
  const toItems = (arts) => arts.map((a) => ({ key: a.url, text: a.title, href: a.url }));

  // failure message → repeated, non-linkable items, keyed by index
  const BORKED = "The internet is borked. This is your sign to go outside and touch grass.";
  const BORKED_ITEMS = Array.from({ length: 8 }, (_, i) => ({ key: `borked-${i}`, text: BORKED, href: null }));
  ```
  **Two constraints the implementer MUST honor (per review):**
  1. **Two identical copies.** The CSS keyframe (`src/index.css:22-29`) translates the track by
     exactly `-50%`, so seamless looping requires rendering the `items` list **twice** (second copy
     `aria-hidden`), exactly as the current articles path does (`src/App.jsx:212-248`). The message
     path must keep that two-copy structure.
  2. **Repeat enough to overflow the row.** A short phrase rendered once is narrower than the row and
     scrolls with a large gap. Repeat the message (the `length: 8` above, tune as needed) so one copy
     overflows the row width before duplicating.
  3. **No `url` keys on the message path** — key by index (`borked-${i}`); a constant/undefined key
     across repeated spans causes React key-collision and a collapsed track.

  This applies both to the global all-fail case (every row scrolls the message) and to any single
  empty row, so the wall is never visually dead.

### Deferred (out of scope) — warm-the-cache endpoint
A `CRON_SECRET`-guarded `api/refresh.js` (force refresh + Blob write, for a manual/cron warm) was
considered and **cut as YAGNI** (review consensus): it only mitigates a cold-miss stampede that's
already acceptable at hobby scale, and adds a second function + secret. Revisit only if CurrentsAPI
usage ever approaches the daily cap.

### Cleanup
- **Env vars:** keep `CURRENTS_API_KEY` + `BLOB_READ_WRITE_TOKEN` (active). Also **keep**
  `NEWS_API_KEY` (retain for future posterity) and `EDGE_CONFIG` (retain — may be used in Vercel
  later). None are deleted; `NEWS_API_KEY`/`EDGE_CONFIG` are intentionally-retained-but-unused.
- `src/sources.js`: add `feedUrl` per source (RSS fallback); keep `domain` (CurrentsAPI primary).
- Update `README.md`: CurrentsAPI-primary + Blob cache + RSS fallback; note `domain` errors during
  CurrentsAPI outages (track https://currentsapi.services/en/status).

## Acceptance Criteria

### Functional
- [x] When CurrentsAPI is healthy, all 7 rows show CurrentsAPI headlines and a snapshot is written to Blob.
- [x] A second request within the TTL is served from Blob (verify: no upstream CurrentsAPI calls).
- [x] When CurrentsAPI `domain` calls fail (simulate by forcing error), the app serves the last-good Blob snapshot.
- [x] With CurrentsAPI failing **and** no snapshot, the 7 rows populate from RSS.
- [x] With every source failing, each row **scrolls the animated message** "The internet is borked.
      This is your sign to go outside and touch grass." (same ticker motion as headlines) — **not**
      static "No headlines available".
- [x] A single empty row also scrolls the message (no visually dead rows); rows with articles are unchanged.
- [x] `GET /api/news` returns `status:"ok"` + non-empty `articles` under normal and degraded conditions.

### Non-functional / quality
- [x] CurrentsAPI request URL is unchanged from current `api/news.js:6`.
- [x] Blob snapshot read via `list()` (no hardcoded blob URL); writes are non-fatal if they fail.
- [x] CurrentsAPI usage well under 1,000/day (≈7 calls per TTL window via lazy refresh + CDN cache).
- [x] RSS normalizer handles the RSS 2.0 our 7 feeds emit: CDATA/entities (verify against a real
      entity-heavy BBC/Fox fixture — don't just assume the parser decodes; add a decode step if titles show `&amp;`/`&#39;`), single-vs-array item, missing pubDate; `resolveLink` returns a non-empty string.
- [x] `npm test` passes. Tests to add: (a) RSS-normalizer fixture tests; (b) a **ticker message-path**
      test asserting two copies render and no duplicate-key warning; (c) **handler branch** tests with
      `readSnapshot`/`refreshFromCurrents`/`fetchRssSource` mocked to exercise all 5 paths and assert the
      right status code + `Cache-Control` per branch; (d) an `App.test.jsx` case asserting `status:"error"` shows the animated message.

### Verification (against live)
- [ ] After the CurrentsAPI outage clears, deploy and confirm all 7 rows show CurrentsAPI data; `curl -s https://www.inundate.us/api/news | jq '.articles|length'` > 0.
- [ ] While the outage persists, confirm the deployed site shows RSS data (fallback path) rather than empty rows.

## Edge Cases & Notes
- **Stampede on cold/stale cache:** lazy refresh means concurrent misses could each call CurrentsAPI;
  the short `s-maxage` lets the CDN absorb most traffic. Acceptable at hobby scale; a `CRON_SECRET`-guarded warm endpoint reduces it further.
- **Blob write fails** → still serve the freshly-fetched data (write is best-effort).
- **Stale snapshot served** → response includes `stale:true` and a short cache so the next window retries CurrentsAPI.
- **Atom `<link>`/`media:content` arrays, guid non-permalinks, single `<item>`, missing pubDate** → handled in `resolveLink`/`resolveImage`/normalizer; url-less items dropped.
- **CurrentsAPI partial outage of `domain`** (the current incident) → `fetchCurrentsSource` throws per source → `anyOk:false` → falls through to snapshot/RSS.

## Dependencies & Risks
- **New deps:** `@vercel/blob`, `fast-xml-parser`. Both lightweight, no native build.
- **Risk — CurrentsAPI `domain` reliability:** this incident shows the preferred path can degrade.
  *Mitigation:* the Blob last-good + RSS fallback is exactly the resilience for that. Monitor the status page.
- **Risk — Hobby no-cron:** addressed by lazy refresh + CDN cache (no scheduled job needed).
- **Risk — Blob read latency on the hot path:** mitigated by CDN `s-maxage`; the Blob read only happens on origin cache-misses.
- **Non-risk:** secrets — `.env` is gitignored (`.env*`).

## Alternatives Considered
- **RSS as primary (earlier draft):** rejected now that the CurrentsAPI failure is a transient
  outage, not a permanent capability gap. RSS is retained as the fallback layer.
- **Visible "Global Wire" CurrentsAPI row:** dropped — CurrentsAPI is the primary source for the
  branded rows once the outage clears, so no separate row is needed.
- **Cron-driven refresh:** not viable on Hobby (once/day cap); lazy refresh chosen instead.
- **NewsAPI:** rejected — free tier 426s from production servers.
- **Minority review view — skip Blob, just widen the existing CDN `stale-while-revalidate`:** DHH/Simplicity
  argued the two bug fixes + a multi-hour SWR window cover a *transient* same-day outage for free, and
  that Blob's marginal value is narrow (only outages outlasting the SWR window, or a cold edge during one).
  Valid and simpler. **Not adopted** because the owner wants a durable server-side cache (Blob) and RSS
  fallback as deliberate resilience. Recorded so the trade-off is explicit: if this proves heavy to
  maintain, widening SWR is the documented fallback-to-simpler path.
- **Env var cleanup:** reviewers flagged retaining unused `NEWS_API_KEY`/`EDGE_CONFIG` as clutter. Kept
  per owner decision (future posterity / possible Vercel use).

## References
- Broken call: `api/news.js:6` (`domain` per-source), `:9` (swallows error), `:44-53` (silent 200-on-empty).
- Frontend bugs: `src/App.jsx:48` (`data.message` vs `data.error`), `:135-138` ("No headlines available").
- Source registry: `src/sources.js:1-54` (add `feedUrl`, keep `domain`). Tests: `src/App.test.jsx`.
- CurrentsAPI status (incident source): https://currentsapi.services/en/status
- CurrentsAPI docs: search https://currentsapi.services/en/docs/search · latest-news https://currentsapi.services/en/docs/latest_news
- Vercel Blob: https://vercel.com/docs/storage/vercel-blob · CDN caching: https://vercel.com/docs/edge-network/caching
