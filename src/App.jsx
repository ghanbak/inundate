import { useCallback, useEffect, useState } from "react";
import Ticker from "react-ticker";

import "./App.css";

const App = () => {
  const [sources, setSources] = useState({});
  const [error, setError] = useState(null);

  const apiKey = import.meta.env.VITE_INUNDATEUS_NEWS_API_KEY;

  const fetchData = useCallback(async () => {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "App.jsx:11",
        message: "fetchData entry",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "D",
      }),
    }).catch(() => {});
    // #endregion
    try {
      const url = `https://newsapi.org/v2/top-headlines?sources=associated-press,bbc-news,bloomberg,cnn,fox-news,the-wall-street-journal,the-washington-post&pageSize=100&apiKey=${apiKey}`;

      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "App.jsx:18",
            message: "Initiating fetch",
            data: { url },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "A",
          }),
        }
      ).catch(() => {});
      // #endregion
      const response = await fetch(url);
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "App.jsx:21",
            message: "Fetch response received",
            data: { status: response.status, ok: response.ok },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "B",
          }),
        }
      ).catch(() => {});
      // #endregion
      const data = await response.json();
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "App.jsx:24",
            message: "Data parsed",
            data: {
              status: data.status,
              totalResults: data.totalResults,
              articleCount: data.articles?.length,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "B,E",
          }),
        }
      ).catch(() => {});
      // #endregion

      if (data.status === "ok") {
        const grouped = data.articles.reduce((acc, article) => {
          const name = article.source.name;
          if (!acc[name]) acc[name] = [];
          acc[name].push(article);
          return acc;
        }, {});
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "App.jsx:34",
              message: "Grouped sources",
              data: { sourceNames: Object.keys(grouped) },
              timestamp: Date.now(),
              sessionId: "debug-session",
              hypothesisId: "C",
            }),
          }
        ).catch(() => {});
        // #endregion
        setSources(grouped);
      } else {
        // #region agent log
        fetch(
          "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              location: "App.jsx:38",
              message: "API returned error status",
              data: { message: data.message },
              timestamp: Date.now(),
              sessionId: "debug-session",
              hypothesisId: "B",
            }),
          }
        ).catch(() => {});
        // #endregion
        setError(data.message);
      }
    } catch (err) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/2f452cb7-fe9e-4766-b4a3-1cbf4750e844",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "App.jsx:43",
            message: "Fetch catch block",
            data: { error: err.message },
            timestamp: Date.now(),
            sessionId: "debug-session",
            hypothesisId: "A,B",
          }),
        }
      ).catch(() => {});
      // #endregion
      setError("Failed to fetch news. Please try again later.");
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const randomInteger = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  return (
    <div
      style={{
        padding: "20px",
        minHeight: "100vh",
        background: "#000",
        color: "#fff",
      }}
    >
      <h1>Inundate.us</h1>
      {error && (
        <div
          style={{
            color: "#ff4444",
            border: "1px solid",
            padding: "10px",
            margin: "20px 0",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {Object.entries(sources).length === 0 && !error ? (
        <p>Loading news...</p>
      ) : (
        Object.entries(sources).map(([sourceName, articles]) => (
          <div key={sourceName} style={{ marginBottom: "30px" }}>
            <h2
              style={{ borderBottom: "1px solid #333", paddingBottom: "5px" }}
            >
              {sourceName}
            </h2>
            <Ticker
              offset={randomInteger(0, 1024)}
              mode="chain"
              speed={randomInteger(25, 40)}
            >
              {() => (
                <p
                  style={{
                    whiteSpace: "nowrap",
                    display: "inline-block",
                    margin: 0,
                  }}
                >
                  {articles.map((article) => (
                    <span key={article.url} style={{ paddingRight: "40px" }}>
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          fontWeight: "bold",
                          color: "#007bff",
                          textDecoration: "none",
                        }}
                      >
                        {article.title}:
                      </a>{" "}
                      <span style={{ color: "#ccc" }}>
                        {article.description}
                      </span>
                    </span>
                  ))}
                </p>
              )}
            </Ticker>
          </div>
        ))
      )}
    </div>
  );
};

export default App;
