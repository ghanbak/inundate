import { memo, useCallback, useEffect, useRef, useState } from "react";
import SOURCES from "./sources";

const LOCAL_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const CLOCKS = [
  { label: LOCAL_TZ.split("/").pop().replace(/_/g, " "), timeZone: LOCAL_TZ },
  { label: "NYC", timeZone: "America/New_York" },
  { label: "LDN", timeZone: "Europe/London" },
  { label: "PAR", timeZone: "Europe/Paris" },
  { label: "TYO", timeZone: "Asia/Tokyo" },
];

function formatTime(date, timeZone) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone,
  });
}

const App = () => {
  const [articles, setArticles] = useState({});
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
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
      10 * 60 * 1000,
    );
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  return (
    <div className="h-screen flex flex-col bg-hud-bg">
      <div className="h-auto sm:h-10 flex flex-col sm:flex-row items-center justify-between p-2 sm:py-0 sm:px-4 gap-4 sm:gap-0 bg-hud-bar border-b border-hud-border">
        <span className="text-sm font-bold tracking-[4px] text-hud-text uppercase">
          Inundate
        </span>
        <WorldClocks />
      </div>
      <div className="flex-1 flex flex-col mb-24">
        {SOURCES.map((source) => {
          const sourceArticles = articles[source.id] || [];

          return (
            <div
              key={source.id}
              className="flex-1 flex border-b border-hud-border last:border-b-0 border-l-3 border-l-(--accent-color) overflow-hidden hud-row"
              style={{ "--accent-color": source.color }}
            >
              <div className="w-24 flex flex-col items-center justify-center gap-1 bg-black/30 border-r border-hud-border">
                {failedFavicons[source.id] ? (
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: source.color }}
                  >
                    {source.name[0]}
                  </div>
                ) : (
                  <img
                    className="w-6 h-6 rounded"
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
                <span className="text-xs text-center text-hud-muted tracking-[1px] uppercase">
                  {source.name}
                </span>
              </div>
              <div className="flex-1 flex items-center px-2 overflow-hidden">
                {loading ? (
                  <span className="text-hud-subtle text-xs italic">
                    Loading...
                  </span>
                ) : error && sourceArticles.length === 0 ? (
                  <span className="text-hud-error text-xs px-3 flex items-center">
                    {error}
                  </span>
                ) : sourceArticles.length === 0 ? (
                  <span className="text-hud-subtle text-xs italic">
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
      <AdRow />
    </div>
  );
};

const AdRow = memo(function AdRow() {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    const timer = setTimeout(() => {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      } catch (e) {
        console.error("AdSense error:", e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="flex hud-row fixed bottom-0 left-0 right-0 h-24 z-10 border-t border-hud-border border-l-3 border-l-(--accent-color)"
      style={{ "--accent-color": "#f5c518" }}
    >
      <div className="w-24 flex flex-col items-center justify-center gap-1 bg-black/30 border-r border-hud-border">
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
          style={{ background: "#f5c518" }}
        >
          AD
        </div>
        <span className="text-xs text-center text-hud-muted tracking-[1px] uppercase">
          Sponsored
        </span>
      </div>
      <div className="flex items-center justify-center px-4 py-2">
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", height: "80px" }}
          data-ad-client="ca-pub-7114488121930728"
          data-ad-slot="1029974852"
          data-ad-format="horizontal"
        />
      </div>
    </div>
  );
});

function TickerScroll({ articles }) {
  const scrollRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const duration = useRef(40 + Math.random() * 40);

  return (
    <div className="overflow-hidden w-full">
      <div
        ref={scrollRef}
        className={`inline-flex whitespace-nowrap animate-ticker-scroll ${paused ? "ticker-paused" : ""}`}
        style={{ animationDuration: `${duration.current}s` }}
      >
        {articles.map((article) => (
          <span key={article.url} className="shrink-0">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold no-underline text-sm brightness-150 hover:underline"
              style={{ color: "var(--accent-color)" }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {article.title}
            </a>
            <span className="px-6 text-hud-separator">|</span>
          </span>
        ))}
        {articles.map((article) => (
          <span
            key={`${article.url}-duplicate`}
            className="shrink-0"
            aria-hidden="true"
          >
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold no-underline text-sm brightness-150 hover:underline"
              style={{ color: "var(--accent-color)" }}
              tabIndex={-1}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {article.title}
            </a>
            <span className="px-6 text-hud-separator">|</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function WorldClocks() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex-1 flex justify-evenly items-center min-w-0 gap-4 sm:gap-0">
      {CLOCKS.map((c) => (
        <div
          key={c.timeZone}
          className="flex flex-col items-center gap-0.5 sm:gap-1.5 text-2xs text-hud-muted tracking-[1px] sm:flex-row sm:text-xs lg:text-sm"
        >
          <span className="font-semibold text-hud-dim uppercase">
            {c.label}
          </span>
          <span className="tabular-nums">{formatTime(now, c.timeZone)}</span>
        </div>
      ))}
    </div>
  );
}

export default App;
