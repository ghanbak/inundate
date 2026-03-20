import { useCallback, useEffect, useRef, useState } from "react";
import SOURCES from "./sources";

import "./App.css";

const App = () => {
  const [articles, setArticles] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clock, setClock] = useState(() => formatTime(new Date()));
  const [failedFavicons, setFailedFavicons] = useState({});

  const fetchData = useCallback(async (signal) => {
    try {
      const response = await fetch("/api/news", { signal });
      const data = await response.json();

      if (data.status === "ok") {
        const grouped = data.articles.reduce((acc, article) => {
          const id = article.source.id;
          if (!acc[id]) acc[id] = [];
          acc[id].push(article);
          return acc;
        }, {});
        setArticles(grouped);
        setError(null);
      } else {
        setError(data.message);
      }
    } catch (err) {
      if (err.name !== "AbortError") {
        setError("Failed to fetch news. Please try again later.");
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(
      () => fetchData(controller.signal),
      5 * 60 * 1000,
    );
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  useEffect(() => {
    const timer = setInterval(() => setClock(formatTime(new Date())), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hud">
      <div className="hud-bar">
        <span className="hud-bar-title">Inundate</span>
        <span className="hud-bar-clock">{clock}</span>
      </div>
      <div className="hud-rows">
        {SOURCES.map((source) => {
          const sourceArticles = articles[source.id] || [];

          return (
            <div
              key={source.id}
              className="hud-row"
              style={{ "--accent-color": source.color }}
            >
              <div className="hud-sidebar">
                {failedFavicons[source.id] ? (
                  <div
                    className="hud-favicon-fallback"
                    style={{ background: source.color }}
                  >
                    {source.name[0]}
                  </div>
                ) : (
                  <img
                    className="hud-favicon"
                    src={source.favicon}
                    alt={source.name}
                    onError={() =>
                      setFailedFavicons((prev) => ({
                        ...prev,
                        [source.id]: true,
                      }))
                    }
                  />
                )}
                <span className="hud-source-label">{source.name}</span>
              </div>
              <div className="hud-ticker">
                {loading ? (
                  <span className="hud-ticker-empty">Loading...</span>
                ) : error && sourceArticles.length === 0 ? (
                  <span className="hud-error">{error}</span>
                ) : sourceArticles.length === 0 ? (
                  <span className="hud-ticker-empty">
                    No headlines available
                  </span>
                ) : (
                  <TickerScroll articles={sourceArticles} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

function TickerScroll({ articles }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);

  return (
    <div className="ticker-scroll">
      <div
        ref={scrollRef}
        className={`ticker-scroll-inner ${paused ? "paused" : ""}`}
      >
        {articles.map((article) => (
          <span key={article.url} className="ticker-scroll-item">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hud-ticker-link"
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {article.title}
            </a>
            <span className="hud-ticker-separator">|</span>
          </span>
        ))}
        {articles.map((article) => (
          <span
            key={`${article.url}-duplicate`}
            className="ticker-scroll-item"
            aria-hidden="true"
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hud-ticker-link"
              tabIndex={-1}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {article.title}
            </a>
            <span className="hud-ticker-separator">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function formatTime(date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default App;
