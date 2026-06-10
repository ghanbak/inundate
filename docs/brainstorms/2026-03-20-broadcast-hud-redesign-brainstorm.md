# Broadcast HUD Redesign

**Date:** 2026-03-20
**Status:** Ready for planning

## What We're Building

A full visual redesign of the Inundate news ticker app, transforming it from a plain black-background text layout into a broadcast HUD (heads-up display) inspired by CNN/Bloomberg TV tickers.

### Key elements:

- **Two-column layout:** Fixed narrow sidebar (~60-80px) with source favicons, tickers filling the remaining viewport width
- **Full viewport height:** 7 source rows divide the screen into equal vertical bands — no scrolling
- **Top branding bar:** "INUNDATE" header with a live clock
- **Per-source accent colors:** Each of the 7 sources gets a unique accent color for visual distinction
- **Subtle gradient row backgrounds:** Adds depth and separation between source rows
- **Monospace font:** Throughout the UI for a data-terminal aesthetic
- **Dark theme only:** No light mode

### Sources (7 total):
1. Associated Press
2. BBC News
3. Bloomberg
4. CNN
5. Fox News
6. The Wall Street Journal
7. The Washington Post

## Why This Approach

The "Full Broadcast HUD" was chosen over simpler alternatives because:
- It's the most visually striking option, matching the app's purpose as a "wall of news"
- Per-source accent colors make it easy to distinguish sources at a glance
- The top bar with branding and clock gives it a professional broadcast-tool feel
- Full viewport usage maximizes information density

## Key Decisions

1. **Logos via favicon URLs** — Grab each source's favicon from their website (e.g., `https://www.bbc.com/favicon.ico`). No local assets to manage, no trademark issues with storing logos.
2. **Fixed sidebar layout** — Logos pinned in a narrow left column, tickers extend to fill the remaining width.
3. **Full viewport rows** — Each source gets `100vh / 7` height. No page scrolling.
4. **News broadcast aesthetic** — Bold accents, per-source colors, gradient backgrounds, monospace font.
5. **Top branding bar** — "INUNDATE" header with live clock, giving it a broadcast-control-room feel.
6. **Monospace font** — Use a monospace font (e.g., `"JetBrains Mono"`, `"Fira Code"`, or system `monospace`) for the terminal/data-feed aesthetic.

## Open Questions

- Which specific monospace font to use (system `monospace`, or import a web font like JetBrains Mono)?
- Exact accent color assignments per source (should they reference the source's brand colors?)
- Should the top bar be sticky/fixed or part of the layout flow?
- How to handle sources with no favicon or broken favicon URLs (fallback to letter monogram?)
