export default async function handler(req, res) {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "NEWS_API_KEY not configured" });
  }

  try {
    const url = `https://newsapi.org/v2/top-headlines?sources=associated-press,bbc-news,bloomberg,cnn,fox-news,the-wall-street-journal,the-washington-post&pageSize=100&apiKey=${apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (_err) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
}
