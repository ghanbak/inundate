import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { Analytics } from "@vercel/analytics/react";
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
  const [showAbout, setShowAbout] = useState(false);

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
    <div className="h-dvh flex flex-col bg-hud-bg">
      <div className="h-auto sm:h-10 flex flex-col shrink-0 sm:flex-row items-center justify-between p-2 sm:py-0 sm:px-4 gap-4 sm:gap-0 bg-hud-bar border-b border-hud-border">
        <span className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-[4px] text-hud-text uppercase">
            Inundate
          </span>
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="text-hud-dim hover:text-hud-text transition-colors"
            aria-label="About Inundate"
          >
            <CircleHelp size={14} />
          </button>
        </span>
        <WorldClocks />
      </div>
      <div className="flex-1 flex flex-col grow">
        {SOURCES.map((source) => {
          const sourceArticles = articles[source.id] || [];

          return (
            <div
              key={source.id}
              className="flex-1 flex border-b border-hud-border last:border-b-0 border-l-3 border-l-(--accent-color) overflow-hidden hud-row"
              style={{ "--accent-color": source.color }}
            >
              <div className="w-16 sm:w-24 flex flex-col items-center justify-center gap-1 bg-black/30 border-r border-hud-border">
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
      {/* <AdRow /> */}
      {showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}
      <Analytics />
    </div>
  );
};

// const AdRow = memo(function AdRow() {
//   const pushed = useRef(false);

//   useEffect(() => {
//     if (pushed.current) return;
//     pushed.current = true;
//     const timer = setTimeout(() => {
//       try {
//         window.adsbygoogle = window.adsbygoogle || [];
//         window.adsbygoogle.push({});
//       } catch (e) {
//         console.error("AdSense error:", e);
//       }
//     }, 500);
//     return () => clearTimeout(timer);
//   }, []);

//   return (
//     <div
//       className="flex hud-row fixed bottom-0 left-0 right-0 h-24 z-10 border-t border-hud-border border-l-3 border-l-(--accent-color)"
//       style={{ "--accent-color": "#f5c518" }}
//     >
//       <div className="w-24 flex flex-col items-center justify-center gap-1 bg-black/30 border-r border-hud-border">
//         <div
//           className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
//           style={{ background: "#f5c518" }}
//         >
//           AD
//         </div>
//         <span className="text-xs text-center text-hud-muted tracking-[1px] uppercase">
//           Sponsored
//         </span>
//       </div>
//       <div className="flex items-center justify-center px-4 py-2">
//         <ins
//           className="adsbygoogle"
//           style={{ display: "block", width: "100%", height: "80px" }}
//           data-ad-client="ca-pub-7114488121930728"
//           data-ad-slot="1029974852"
//           data-ad-format="horizontal"
//         />
//       </div>
//     </div>
//   );
// });

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

function AboutOverlay({ onClose }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-hud-bg/95 flex items-center justify-center overflow-y-auto">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 bg-hud-border rounded-full p-2 text-hud-dim hover:bg-hud-separator hover:text-hud-text transition-colors"
        aria-label="Close"
      >
        <X size={20} />
      </button>
      <div className="w-dvw max-w-dvw sm:max-w-xl max-h-dvh overflow-y-auto sm:max-h-none sm:overflow-y-scroll bg-hud-bar border border-hud-border rounded-lg p-8 text-hud-muted leading-relaxed space-y-6 text-sm">
        <p className="text-hud-text text-lg">
          <strong>Inundate</strong>{" "}
          <span className="text-hud-dim">/ˈɪn.ʌn.deɪt/</span> — to overwhelm
          with things to be dealt with.
        </p>
        <p>
          This is a wall of news. Seven sources. Hundreds of headlines. All
          updating constantly. None of it will change what you do today.
        </p>
        <p>
          The modern news cycle is a machine that converts your attention into
          revenue. Every headline is engineered to feel urgent. Almost none of
          them are. The person who reads every story and the person who reads
          none of them will make the same decisions about what to have for
          dinner.
        </p>
        <p>
          Inundate exists to make this visible. Stare at it long enough and the
          headlines blur together. That's not a bug.
        </p>
        <p>
          You don't need to keep up. The news will happen whether you watch it
          or not.
        </p>
        <p className="text-hud-dim">Close this and go touch grass.</p>
        <p className="text-hud-subtle text-xs pt-4">
          Begrudgingly crafted by{" "}
          <a
            href="https://ghanbak.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-hud-dim hover:text-hud-text transition-colors underline"
          >
            ghanbak
          </a>
        </p>
      </div>
    </div>
  );
}

export default App;
