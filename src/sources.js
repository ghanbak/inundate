const SOURCES = [
  {
    id: "associated-press",
    name: "AP",
    color: "#ff4444",
    favicon: "https://www.google.com/s2/favicons?domain=apnews.com&sz=64",
    domain: "apnews.com",
    // AP's own feed is Cloudflare-blocked; Google News RSS is the working fallback source.
    feedUrl:
      "https://news.google.com/rss/search?q=when:1d+site:apnews.com&hl=en-US&gl=US&ceid=US:en",
  },
  {
    id: "bbc-news",
    name: "BBC",
    color: "#bb1919",
    favicon: "https://www.google.com/s2/favicons?domain=bbc.com&sz=64",
    domain: "bbc.com",
    feedUrl: "https://feeds.bbci.co.uk/news/rss.xml",
  },
  {
    id: "bloomberg",
    name: "Bloomberg",
    color: "#472a91",
    favicon: "https://www.google.com/s2/favicons?domain=bloomberg.com&sz=64",
    domain: "bloomberg.com",
    feedUrl: "https://feeds.bloomberg.com/markets/news.rss",
  },
  {
    id: "cnn",
    name: "CNN",
    color: "#cc0000",
    favicon: "https://www.google.com/s2/favicons?domain=cnn.com&sz=64",
    domain: "cnn.com",
    feedUrl: "http://rss.cnn.com/rss/cnn_topstories.rss",
  },
  {
    id: "fox-news",
    name: "Fox News",
    color: "#1b4e81",
    favicon: "https://www.google.com/s2/favicons?domain=foxnews.com&sz=64",
    domain: "foxnews.com",
    feedUrl: "https://moxie.foxnews.com/google-publisher/latest.xml",
  },
  {
    id: "the-wall-street-journal",
    name: "WSJ",
    color: "#0274b6",
    favicon: "https://www.google.com/s2/favicons?domain=wsj.com&sz=64",
    domain: "wsj.com",
    feedUrl: "https://feeds.a.dj.com/rss/RSSWorldNews.xml",
  },
  {
    id: "the-washington-post",
    name: "WaPo",
    color: "#d4d4d4",
    favicon:
      "https://www.google.com/s2/favicons?domain=washingtonpost.com&sz=64",
    domain: "washingtonpost.com",
    feedUrl: "https://feeds.washingtonpost.com/rss/world",
  },
];

export default SOURCES;
