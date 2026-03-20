import { useCallback, useEffect, useState } from "react";
import Ticker from "react-ticker";

import "./App.css";

const App = () => {
  const [sources, setSources] = useState({});
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch("/api/news");
      const data = await response.json();

      if (data.status === "ok") {
        const grouped = data.articles.reduce((acc, article) => {
          const name = article.source.name;
          if (!acc[name]) acc[name] = [];
          acc[name].push(article);
          return acc;
        }, {});
        setSources(grouped);
      } else {
        setError(data.message);
      }
    } catch (err) {
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
