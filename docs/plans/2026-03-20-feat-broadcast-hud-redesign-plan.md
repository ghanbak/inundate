---
title: "feat: Broadcast HUD Redesign"
type: feat
date: 2026-03-20
---

# Broadcast HUD Redesign

## Overview

Transform Inundate from a plain black-background text layout into a CNN/Bloomberg-inspired broadcast HUD with a fixed favicon sidebar, full-viewport ticker rows, top branding bar with live clock, per-source accent colors, gradient backgrounds, and monospace font.

## Problem Statement / Motivation

The current UI is an unstyled MVP — black background, system fonts, no branding, no source logos, and vertically stacked tickers that scroll off the page. For a "wall of news" app, it needs to look and feel like a real broadcast monitoring tool.

## Proposed Solution

### Source Configuration Map

Create a single config object that maps each source to its API ID, display name, accent color, favicon URL, and display order. This replaces the current dynamic grouping by `article.source.name` with a deterministic, ordered layout.

```jsx
// src/sources.js
const SOURCES = [
  { id: "associated-press", name: "AP", color: "#ff4444", favicon: "https://www.google.com/s2/favicons?domain=apnews.com&sz=64" },
  { id: "bbc-news", name: "BBC", color: "#bb1919", favicon: "https://www.google.com/s2/favicons?domain=bbc.com&sz=64" },
  { id: "bloomberg", name: "Bloomberg", color: "#472a91", favicon: "https://www.google.com/s2/favicons?domain=bloomberg.com&sz=64" },
  { id: "cnn", name: "CNN", color: "#cc0000", favicon: "https://www.google.com/s2/favicons?domain=cnn.com&sz=64" },
  { id: "fox-news", name: "Fox News", color: "#003366", favicon: "https://www.google.com/s2/favicons?domain=foxnews.com&sz=64" },
  { id: "the-wall-street-journal", name: "WSJ", color: "#0274b6", favicon: "https://www.google.com/s2/favicons?domain=wsj.com&sz=64" },
  { id: "the-washington-post", name: "WaPo", color: "#231f20", favicon: "https://www.google.com/s2/favicons?domain=washingtonpost.com&sz=64" },
];
```

### Layout Structure

```
┌─────────────────────────────────────────────────┐
│  INUNDATE                          16:04:25 UTC │  ← Branding bar (~40px)
├──────┬──────────────────────────────────────────┤
│ [AP] │ ← headline ticker scrolling ──────────→  │  ← Row 1
│ [BBC]│ ← headline ticker scrolling ──────────→  │  ← Row 2
│ [BBG]│ ← headline ticker scrolling ──────────→  │  ← Row 3
│ [CNN]│ ← headline ticker scrolling ──────────→  │  ← Row 4
│ [FOX]│ ← headline ticker scrolling ──────────→  │  ← Row 5
│ [WSJ]│ ← headline ticker scrolling ──────────→  │  ← Row 6
│[WAPO]│ ← headline ticker scrolling ──────────→  │  ← Row 7
└──────┴──────────────────────────────────────────┘
```

- **Top bar**: Fixed height (~40px). "INUNDATE" left-aligned, 24-hour clock with seconds right-aligned. Dark background with subtle bottom border.
- **Sidebar**: Fixed width (~64px). Source favicon (32x32) centered, short source label underneath in small text. Per-source accent color as left border stripe (3px).
- **Ticker area**: Fills remaining width. Each row has a subtle gradient background incorporating a faint version of the accent color. Headlines scroll via `react-ticker`.
- **Row height**: Derived from `SOURCES.length` — `calc((100vh - 40px) / ${SOURCES.length})` — so adding/removing sources auto-adjusts.

### CSS Values

| Property | Value |
|---|---|
| Background | `#0a0a0a` |
| Surface (rows) | `#111` → `#0a0a0a` gradient |
| Text primary | `#e0e0e0` |
| Text secondary | `#888` |
| Border | `#222` |
| Font | `"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace` (system only, no import) |
| Branding bar height | `40px` |
| Sidebar width | `64px` |
| Accent border width | `3px` |

Per-source accent colors applied via CSS custom properties: set `--accent-color` inline on each row, consumed by CSS for `border-left` and gradient background.

## Technical Considerations

### Source Grouping Fix

**Current bug**: Articles are grouped by `article.source.name` (display string from NewsAPI), which is fragile. Switch to grouping by `article.source.id` to match the hardcoded source IDs in the API query. This ensures stable mapping to the `SOURCES` config.

### Favicon Strategy

Use Google's favicon proxy (`google.com/s2/favicons?domain=X&sz=64`) instead of direct `favicon.ico` fetching. Benefits:
- Reliable cross-origin loading
- Consistent size (64x64 available)
- Handles redirects and non-standard favicon locations
- Fallback: on `<img>` `onerror`, track failure in local state and show a CSS letter monogram (first letter of source name in accent-colored circle)

### Ticker Behavior

- Keep `react-ticker` with `mode="chain"`
- Uniform speed: `speed={30}` as a literal (no randomness, no `useMemo`)
- Deterministic offsets derived from source index: `offset={index * 150}`
- Hover pauses the ticker row (set `move={false}` on hover)
- Show title only (drop description) for density in compact rows

### Data Refresh

Add a 5-minute polling interval with `AbortController` cleanup:

```jsx
useEffect(() => {
  const controller = new AbortController();
  const doFetch = () => fetchData(controller.signal);
  doFetch();
  const interval = setInterval(doFetch, 5 * 60 * 1000);
  return () => {
    controller.abort();
    clearInterval(interval);
  };
}, [fetchData]);
```

### Empty Source Handling

Always render all 7 rows regardless of API response. If a source returns zero articles, show a muted "No headlines available" message in that row's ticker area. This keeps the layout stable.

### Clock

24-hour format with seconds (`HH:MM:SS`), user's local timezone. Updated every second via `setInterval`. Inline in `App.jsx` — just one `useState` and one `useEffect`. Displayed in the branding bar, right-aligned.

## Implementation Tasks

All changes ship together as one feature. No phasing.

### Foundation
- [x] Create `src/sources.js` with the SOURCES config array
- [x] Update `src/index.css`: monospace font stack (system only, no Google Fonts import), `html, body { height: 100%; overflow: hidden; }`, background `#0a0a0a`
- [x] Update `index.html` `<title>` from "React App" to "Inundate"
- [x] Update `public/manifest.json` name fields

### Layout & Styling
- [x] Write `src/App.css` with all HUD styles (replace inline styles)
- [x] `.hud-bar`: flex layout, "INUNDATE" title left, clock right, 40px height
- [x] `.hud-grid`: CSS Grid with fixed 64px sidebar column + flexible ticker column
- [x] `.hud-row`: height derived from `SOURCES.length`, `--accent-color` CSS custom property set inline, consumed by `border-left` and gradient
- [x] `.hud-sidebar`: centered favicon `<img>` (32x32) + source label below
- [x] Gradient backgrounds per row using `--accent-color` at low opacity
- [x] Favicon `onerror` fallback: track failure in state, render letter monogram
- [x] Row separator borders (`border-bottom: 1px solid #222`)

### Logic Updates
- [x] Import `SOURCES`, group articles by `source.id` instead of `source.name`
- [x] Always render all source rows (iterate `SOURCES`, not `Object.entries(grouped)`)
- [x] Inline live clock: `useState` + `setInterval(1000)` in `useEffect`
- [x] 5-minute data refresh interval with `AbortController` cleanup
- [x] Hover-to-pause on ticker rows (`move={!isHovered}`)
- [x] Show title only in ticker (remove description)
- [x] Loading state: render all rows with "Loading..." in ticker area (reuse empty-source pattern)
- [x] Error state: render within the HUD layout (not a separate banner)
- [x] Remove `randomInteger` helper; use `speed={30}` and `offset={index * 150}`

## Acceptance Criteria

- [ ] 7 source rows fill the full viewport height with no scrolling
- [ ] Each row shows the source favicon in a fixed-width sidebar with the source name label
- [ ] Each row has a per-source accent color (left border + gradient tint)
- [ ] Top bar displays "INUNDATE" and a live ticking clock
- [ ] All text uses monospace font (system, no external import)
- [ ] Dark theme with no light mode
- [ ] Headlines scroll horizontally via react-ticker
- [ ] Broken favicons fall back to a letter monogram
- [ ] Data refreshes every 5 minutes
- [ ] Empty sources still show their row with a placeholder message
- [ ] `<title>` updated to "Inundate"

## Dependencies & Risks

- **Google Favicon Proxy**: Third-party dependency. If down, favicons break (mitigated by letter fallback).
- **react-ticker compatibility**: Already using v1.2.2 with React 19 via overrides. No change needed.
- **NewsAPI rate limits**: Free tier is 100 req/day. 5-minute polling from one client = 288 req/day. Server-side caching would be a separate enhancement.

## Files to Modify

| File | Changes |
|---|---|
| `src/sources.js` | **NEW** — Source config array |
| `src/App.jsx` | Restructure to HUD layout, new data grouping, clock, refresh |
| `src/App.css` | **Rewrite** — All HUD styles (currently empty) |
| `src/index.css` | Monospace font stack, viewport lock, background |
| `index.html` | Update title |
| `public/manifest.json` | Update name fields |

## References

- Brainstorm: `docs/brainstorms/2026-03-20-broadcast-hud-redesign-brainstorm.md`
- react-ticker docs: https://github.com/AndreasFaust/react-ticker
- Google Favicon API: `https://www.google.com/s2/favicons?domain=DOMAIN&sz=SIZE`
