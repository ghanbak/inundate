# World Clocks in Top Bar Brainstorm

**Date:** 2026-03-31
**Status:** Ready for planning

## What We're Building

Add 5 clocks to the top HUD bar: the user's local time (labeled by their timezone city) plus New York, London, Paris, and Tokyo. All clocks update every second in 24-hour format, matching the existing clock style.

## Why This Approach

**Local detection: Intl.DateTimeFormat timezone** — No API calls, no permission prompts, works instantly. Extract the city name from the timezone ID (e.g., `America/Chicago` -> `Chicago`).

**Layout: Spread across the bar** — Clocks distributed evenly across the full width, with "Inundate" title on the left. This uses the wide viewport effectively and gives the HUD a broadcast-control-room feel.

## Key Decisions

- **Geolocation method:** `Intl.DateTimeFormat().resolvedOptions().timeZone` — zero dependencies, no API calls
- **Label format:** Extract city name from timezone ID (e.g., `America/Chicago` -> `Chicago`)
- **Fixed cities:** New York (NYC), London (LDN), Paris (PAR), Tokyo (TYO)
- **Local clock label:** Derived from browser timezone, shown as city name
- **Layout:** All 5 clocks spread across the top bar with even spacing
- **Time format:** 24-hour, matching current `HH:MM:SS` format
- **Update interval:** Every second (same as current clock)

## Open Questions

- Should the local clock be visually distinguished (e.g., slightly brighter) from the fixed city clocks?
- What abbreviation style for city labels? Full name ("London") vs short ("LDN")?
