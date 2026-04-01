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
