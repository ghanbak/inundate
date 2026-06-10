import { list, put } from "@vercel/blob";
import { XMLParser } from "fast-xml-parser";
import SOURCES from "../src/sources.js";

const FRESH_TTL = 30 * 60 * 1000; // Blob snapshot considered fresh for 30 min
const STALE_MAX = 3 * 60 * 60 * 1000; // serve stale Blob only if < 3h old, else prefer fresh RSS
const FRESH_CACHE = "s-maxage=1800, stale-while-revalidate=3600"; // good data: long edge cache
const DEGRADED_CACHE = "s-maxage=120, stale-while-revalidate=120"; // stale/RSS: flush fast on recovery
const BLOB_KEY = "news/latest.json";

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

// ---------------------------------------------------------------------------
// Vercel Blob cache (best-effort: never let cache I/O break the response)
// ---------------------------------------------------------------------------

async function readSnapshot() {
  try {
    // list() takes no AbortSignal — race it so a hung Blob API can't hang the handler.
    const { blobs } = await withTimeout(list({ prefix: BLOB_KEY, limit: 1 }), 3000);
    if (!blobs[0]) return null;
    const snap = await fetch(blobs[0].url, {
      signal: AbortSignal.timeout(5000),
    }).then((r) => r.json());
    return { ...snap, age: Date.now() - (snap.generatedAt || 0) };
  } catch (e) {
    console.error("readSnapshot failed:", e?.message);
    return null;
  }
}

async function writeSnapshot(snap) {
  try {
    await put(BLOB_KEY, JSON.stringify(snap), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    // Non-fatal: we still serve the freshly-fetched data.
    console.error("writeSnapshot failed:", e?.message);
  }
}

// ---------------------------------------------------------------------------
// CurrentsAPI (preferred source) — per-source domain query, left unchanged
// ---------------------------------------------------------------------------

async function fetchCurrentsSource(source, apiKey) {
  try {
    const url = `https://api.currentsapi.services/v1/search?domain=${source.domain}&language=en&apiKey=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.status !== "ok") throw new Error(json.msg || "currents error");
    const seen = new Set();
    const articles = json.news
      .filter((it) => it.url && !seen.has(it.url) && seen.add(it.url))
      .map((it) => ({
        source: { id: source.id },
        title: it.title,
        url: it.url,
        publishedAt: it.published,
        urlToImage: it.image,
        description: it.description,
        author: it.author,
      }));
    return { id: source.id, ok: true, articles };
  } catch (e) {
    console.error("currents", source.id, e?.message);
    return { id: source.id, ok: false, articles: [] };
  }
}

async function refreshFromCurrents(apiKey) {
  const results = await Promise.all(
    SOURCES.map((s) => fetchCurrentsSource(s, apiKey)),
  );
  return {
    source: "currents",
    sources: Object.fromEntries(results.map((r) => [r.id, r.ok ? "ok" : "error"])),
    articles: results.flatMap((r) => r.articles),
    anyOk: results.some((r) => r.ok && r.articles.length),
  };
}

// ---------------------------------------------------------------------------
// RSS fallback (only when CurrentsAPI is down and no usable snapshot exists)
// ---------------------------------------------------------------------------

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
const stripHtml = (s = "") => String(s).replace(/<[^>]*>/g, "").trim();
const asText = (v) => (v && typeof v === "object" ? v["#text"] : v);

// Our 7 feeds are RSS 2.0 (<link> is a string). The Atom branch (array <link>) is
// kept as a minimal guard so a feed swap can't yield "[object Object]" hrefs.
function resolveLink(item) {
  const l = item.link;
  if (Array.isArray(l)) {
    const alt = l.find((x) => x?.["@_rel"] === "alternate") ?? l[0];
    const href = alt?.["@_href"] ?? alt;
    return typeof href === "string" ? href : null;
  }
  if (typeof l === "string") return l;
  if (l && typeof l === "object" && typeof l["@_href"] === "string") return l["@_href"];
  const g = asText(item.guid);
  return typeof g === "string" ? g : null;
}

function resolveImage(item) {
  const m = item["media:content"] ?? item.enclosure ?? item["media:thumbnail"];
  const first = Array.isArray(m) ? m[0] : m;
  const url = first?.["@_url"];
  return typeof url === "string" ? url : null;
}

// Pure + exported for unit testing against feed fixtures.
export function parseRss(xmlText, sourceId) {
  const xml = parser.parse(xmlText);
  const raw = xml?.rss?.channel?.item ?? xml?.feed?.entry ?? [];
  const items = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
  const seen = new Set();
  return items
    .map((it) => ({
      source: { id: sourceId },
      title: asText(it.title),
      url: resolveLink(it),
      publishedAt: it.pubDate ?? it.published ?? it.updated ?? null,
      description: stripHtml(asText(it.description ?? it.summary ?? "")),
      urlToImage: resolveImage(it),
      author: it["dc:creator"] ?? it.author?.name ?? it.author ?? null,
    }))
    .filter((a) => a.url && !seen.has(a.url) && seen.add(a.url))
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, 15);
}

async function fetchRssSource(source) {
  try {
    const res = await fetch(source.feedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (inundate.us news ticker)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { id: source.id, ok: true, articles: parseRss(await res.text(), source.id) };
  } catch (e) {
    console.error("rss", source.id, e?.message);
    return { id: source.id, ok: false, articles: [] };
  }
}

// ---------------------------------------------------------------------------
// Handler: fresh Blob → CurrentsAPI → stale Blob → RSS → error
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  const apiKey = process.env.CURRENTS_API_KEY;
  if (!apiKey) {
    console.error("CURRENTS_API_KEY not configured — will serve cache/RSS only");
  }

  // 1. Fresh cache → serve immediately, no upstream calls.
  const snap = await readSnapshot();
  if (snap && snap.age < FRESH_TTL && snap.articles?.length) {
    res.setHeader("Cache-Control", FRESH_CACHE);
    return res
      .status(200)
      .json({ status: "ok", source: snap.source, articles: snap.articles, sources: snap.sources });
  }

  // 2. Refresh from CurrentsAPI (preferred).
  const fresh = apiKey ? await refreshFromCurrents(apiKey) : { anyOk: false };
  if (fresh.anyOk) {
    await writeSnapshot({ generatedAt: Date.now(), ...fresh });
    res.setHeader("Cache-Control", FRESH_CACHE);
    return res
      .status(200)
      .json({ status: "ok", source: "currents", articles: fresh.articles, sources: fresh.sources });
  }

  // 3a. CurrentsAPI down but we have a recent snapshot → serve last-good.
  if (snap && snap.articles?.length && snap.age < STALE_MAX) {
    res.setHeader("Cache-Control", DEGRADED_CACHE);
    return res.status(200).json({
      status: "ok",
      source: snap.source,
      stale: true,
      articles: snap.articles,
      sources: snap.sources,
    });
  }

  // 3b. No usable snapshot → RSS fallback.
  const rss = await Promise.all(SOURCES.map(fetchRssSource));
  const rssArticles = rss.flatMap((r) => r.articles);
  if (rssArticles.length) {
    const sources = Object.fromEntries(rss.map((r) => [r.id, r.ok ? "ok" : "error"]));
    await writeSnapshot({ generatedAt: Date.now(), source: "rss", articles: rssArticles, sources });
    res.setHeader("Cache-Control", DEGRADED_CACHE);
    return res.status(200).json({ status: "ok", source: "rss", articles: rssArticles, sources });
  }

  // 4. Everything failed → real error (UI shows the animated "touch grass" message).
  res.setHeader("Cache-Control", "s-maxage=30");
  return res.status(502).json({ status: "error", error: "All news sources are unavailable" });
}
