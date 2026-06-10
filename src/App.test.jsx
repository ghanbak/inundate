import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stubNews = (response) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response),
  );

test("renders app header", async () => {
  stubNews({ ok: true, json: async () => ({ status: "ok", articles: [] }) });
  render(<App />);
  expect(screen.getByText("Inundate")).toBeInTheDocument();
  await screen.findAllByText(/the internet is borked/i); // let the async fetch settle
});

test("shows the animated failure message when the API errors", async () => {
  stubNews({
    ok: false,
    status: 502,
    json: async () => ({ status: "error", error: "All news sources are unavailable" }),
  });
  render(<App />);

  const lines = await screen.findAllByText(/the internet is borked/i);
  expect(lines.length).toBeGreaterThan(0);
});

test("renders headlines when the API returns articles", async () => {
  stubNews({
    ok: true,
    json: async () => ({
      status: "ok",
      source: "currents",
      articles: [
        { source: { id: "bbc-news" }, title: "Test Headline", url: "https://example.com/1" },
      ],
    }),
  });
  render(<App />);

  const links = await screen.findAllByText("Test Headline");
  expect(links.length).toBeGreaterThan(0);
  expect(links[0].closest("a")).toHaveAttribute("href", "https://example.com/1");
});
