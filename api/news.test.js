import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@vercel/blob", () => ({
  list: vi.fn(() => Promise.resolve({ blobs: [] })),
  put: vi.fn(() => Promise.resolve()),
}));

import { list, put } from "@vercel/blob";
import handler, { parseRss } from "./news.js";

const RSS_SAMPLE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title><![CDATA[Markets rally & rebound]]></title>
    <link>https://example.com/a</link>
    <pubDate>Mon, 09 Jun 2026 10:00:00 GMT</pubDate>
    <description>&lt;p&gt;Stocks climbed.&lt;/p&gt;</description>
  </item>
  <item>
    <title>Older story</title>
    <link>https://example.com/b</link>
    <pubDate>Sun, 08 Jun 2026 10:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Duplicate link</title>
    <link>https://example.com/a</link>
  </item>
</channel></rss>`;

const RSS_SINGLE_ITEM = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item><title>Lonely</title><link>https://example.com/solo</link></item>
</channel></rss>`;

describe("parseRss", () => {
  test("maps items, tags source id, strips HTML, decodes entities", () => {
    const out = parseRss(RSS_SAMPLE, "bbc-news");
    expect(out).toHaveLength(2); // duplicate url dropped
    expect(out[0].source.id).toBe("bbc-news");
    expect(out[0].title).toBe("Markets rally & rebound"); // CDATA + entity decoded
    expect(out[0].description).toBe("Stocks climbed."); // HTML stripped
  });

  test("sorts newest first by publishedAt", () => {
    const out = parseRss(RSS_SAMPLE, "cnn");
    expect(out[0].url).toBe("https://example.com/a"); // Jun 09 before Jun 08
    expect(out[1].url).toBe("https://example.com/b");
  });

  test("handles a single <item> (parser returns an object, not an array)", () => {
    const out = parseRss(RSS_SINGLE_ITEM, "fox-news");
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe("https://example.com/solo");
  });

  test("drops items without a usable url", () => {
    const out = parseRss(
      `<rss version="2.0"><channel><item><title>No link</title></item></channel></rss>`,
      "cnn",
    );
    expect(out).toHaveLength(0);
  });

  test("keeps items with an unparseable pubDate and still sorts (no NaN comparator)", () => {
    const out = parseRss(
      `<rss version="2.0"><channel>
        <item><title>Bad date</title><link>https://e/a</link><pubDate>not a date</pubDate></item>
        <item><title>Good date</title><link>https://e/b</link><pubDate>Mon, 09 Jun 2026 10:00:00 GMT</pubDate></item>
      </channel></rss>`,
      "cnn",
    );
    expect(out).toHaveLength(2); // unparseable date item is retained, not dropped
    expect(out[0].url).toBe("https://e/b"); // valid date sorts ahead of epoch-0 fallback
  });
});

function mockRes() {
  const res = { headers: {}, statusCode: null, body: null };
  res.setHeader = (k, v) => {
    res.headers[k] = v;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

describe("handler", () => {
  beforeEach(() => {
    process.env.CURRENTS_API_KEY = "test-key";
    list.mockResolvedValue({ blobs: [] }); // no snapshot by default
    put.mockResolvedValue();
  });
  afterEach(() => vi.unstubAllGlobals());

  test("serves CurrentsAPI data when healthy and writes a snapshot", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.includes("currentsapi.services")) {
          return {
            ok: true,
            json: async () => ({
              status: "ok",
              news: [
                { title: "Hi", url: "https://x/1", published: "2026-06-09", image: null, description: "", author: null },
              ],
            }),
          };
        }
        throw new Error("unexpected fetch");
      }),
    );

    const res = mockRes();
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.source).toBe("currents");
    expect(res.body.articles.length).toBeGreaterThan(0);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=1800");
    expect(put).toHaveBeenCalled();
  });

  test("returns 502 when CurrentsAPI and RSS both fail and no snapshot exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) })));

    const res = mockRes();
    await handler({}, res);

    expect(res.statusCode).toBe(502);
    expect(res.body.status).toBe("error");
    expect(res.body.error).toMatch(/unavailable/i);
  });

  test("treats an all-ok-but-empty CurrentsAPI response as success, not an outage (#3)", async () => {
    // Every source responds ok with zero articles (quiet news period) — must NOT fall to RSS.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.includes("currentsapi.services")) {
          return { ok: true, json: async () => ({ status: "ok", news: [] }) };
        }
        throw new Error("RSS fallback should not be reached");
      }),
    );

    const res = mockRes();
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe("currents"); // healthy API respected, not RSS
    expect(res.body.stale).toBe(false);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=1800");
  });

  test("serves a partial CurrentsAPI refresh as degraded without falling to RSS (#2)", async () => {
    // Only BBC responds; the other 6 error. Should still serve Currents data, marked stale.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (url.includes("currentsapi.services")) {
          if (url.includes("domain=bbc.com")) {
            return {
              ok: true,
              json: async () => ({ status: "ok", news: [{ title: "BBC", url: "https://b/1", published: "2026-06-09" }] }),
            };
          }
          return { ok: false, status: 503, json: async () => ({}) };
        }
        throw new Error("RSS fallback should not be reached");
      }),
    );

    const res = mockRes();
    await handler({}, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.source).toBe("currents");
    expect(res.body.stale).toBe(true); // incomplete → flagged + short cache
    expect(res.body.articles.length).toBeGreaterThan(0);
    expect(res.headers["Cache-Control"]).toContain("s-maxage=120");
  });
});
