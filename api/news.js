import SOURCES from "../src/sources.js";

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
let cache = { data: null, timestamp: 0 };
let inflight = null;

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
    .catch((err) => {
      console.error("Failed to refresh articles:", err);
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
