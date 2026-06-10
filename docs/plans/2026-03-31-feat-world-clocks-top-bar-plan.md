---
title: Add World Clocks to Top Bar
type: feat
date: 2026-03-31
---

# Add World Clocks to Top Bar

## Overview

Replace the single clock in `.hud-bar` with 5 clocks spread evenly across the bar: the user's local time (labeled by their browser timezone city) plus New York, London, Paris, and Tokyo. All 24-hour format, updating every second.

**Brainstorm:** `docs/brainstorms/2026-03-31-world-clocks-brainstorm.md`

## Acceptance Criteria

- [x] 5 clocks displayed in the top bar: local (first) + NYC, LDN, PAR, TYO
- [x] Local clock labeled with city name extracted from `Intl.DateTimeFormat().resolvedOptions().timeZone`
- [x] Each clock shows correct time for its timezone in `HH:MM:SS` 24-hour format
- [x] All clocks update every second
- [x] Clocks spread evenly across the bar with "Inundate" on the left
- [x] Per-second re-renders isolated to clock component only (not full App)
- [x] Layout works on typical desktop viewports (1280px+), degrades gracefully on narrower

## Files to Change

| File | Change |
|------|--------|
| `src/App.jsx` | Extract `WorldClocks` component, remove old clock state/formatTime |
| `src/App.css` | Update `.hud-bar` and clock styles for multi-clock layout |

## Implementation

### 1. Module-level constants and formatter in `src/App.jsx`

All clock config is static — compute at module scope, no hooks needed.

```js
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
```

Key decisions from review:
- Local clock is **first** in the array (most relevant to the user)
- Real timezone string passed for all clocks (no `undefined` special case)
- `CLOCKS` array includes all 5 entries — single `.map()` render, no special-case JSX

### 2. Extract `WorldClocks` component

Owns the `setInterval` and `now` state, isolating per-second re-renders from the rest of `App`. Without this, `setNow(new Date())` would re-render all 7 ticker rows every second.

```jsx
function WorldClocks() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hud-bar-clocks">
      {CLOCKS.map((c) => (
        <span key={c.timeZone} className="hud-bar-clock">
          <span className="hud-clock-label">{c.label}</span>
          <span className="hud-clock-time">{formatTime(now, c.timeZone)}</span>
        </span>
      ))}
    </div>
  );
}
```

### 3. Update `App` component

Remove `clock` state, `setClock` interval, and the old `formatTime` function. Replace the clock `<span>` in the JSX:

```jsx
<div className="hud-bar">
  <span className="hud-bar-title">Inundate</span>
  <WorldClocks />
</div>
```

### 4. Update CSS in `src/App.css`

Replace old `.hud-bar-clock` rule with:

```css
.hud-bar-clocks {
  display: flex;
  gap: 24px;
  align-items: center;
  overflow: hidden;
  min-width: 0;
}

.hud-bar-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #888;
  letter-spacing: 1px;
}

.hud-clock-label {
  font-size: 10px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.hud-clock-time {
  font-variant-numeric: tabular-nums;
}
```

## Context

- Current clock: `src/App.jsx:54` (setInterval), `src/App.jsx:62` (render), `src/App.jsx:210-217` (formatTime)
- Current clock CSS: `src/App.css:28-32` (`.hud-bar-clock`)
