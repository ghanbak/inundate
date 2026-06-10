---
title: Add Google AdSense with Ticker-Style Ad Row
type: feat
date: 2026-03-30
---

# ✨ Add Google AdSense with Ticker-Style Ad Row

## Overview

Integrate Google AdSense into the Inundate news HUD by:
1. Adding the AdSense meta verification tag and library script to `<head>`
2. Adding an ad ticker row as the **last row** in the HUD, visually matching the existing news source rows

## Acceptance Criteria

- [ ] AdSense meta verification tag in `<head>` of `index.html`
- [ ] AdSense async script loads in `<head>` of `index.html`
- [ ] Ad row renders as the last (8th) row in the HUD
- [ ] Ad row visually matches existing rows (sidebar + content area, dark theme, distinct accent color)
- [ ] Ad unit initializes exactly once after React mount via `useEffect`
- [ ] Existing 7 news rows are not visually compressed
- [ ] No Cumulative Layout Shift (CLS) — ad row has a fixed height

## Implementation

### 1. Add AdSense meta tag and script to `index.html` `<head>`

```html
<!-- index.html — add before </head> -->
<meta name="google-adsense-account" content="ca-pub-7114488121930728" />
<script
  async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7114488121930728"
  crossorigin="anonymous"
></script>
```

The meta tag handles site verification. The script loads the AdSense library. The ad unit (`<ins>` tag) and `adsbygoogle.push()` call render in the React component tree.

### 2. Create AdRow component in `src/App.jsx`

Add `memo` to the React import. Add a new `AdRow` component that renders the AdSense ad unit inside a HUD row.

```jsx
// src/App.jsx — update import
import { memo, useCallback, useEffect, useRef, useState } from "react";

// src/App.jsx — new component (memo prevents iframe destruction on parent re-renders)
const AdRow = memo(function AdRow() {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div className="hud-row hud-ad-row" style={{ "--accent-color": "#f5c518" }}>
      <div className="hud-sidebar">
        <div className="hud-favicon-fallback" style={{ background: "#f5c518" }}>
          AD
        </div>
        <span className="hud-source-label">Sponsored</span>
      </div>
      <div className="hud-ticker hud-ad-ticker">
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client="ca-pub-7114488121930728"
          data-ad-slot="1029974852"
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    </div>
  );
});
```

### 3. Add AdRow to the layout in `App` component

```jsx
// src/App.jsx — after SOURCES.map(), before closing </div> of .hud-rows
<AdRow />
```

### 4. Add CSS for the ad row

```css
/* src/App.css — ad row styles */
.hud-ad-row {
  flex: none;
  height: 90px;
}

.hud-ad-ticker {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
}
```

### 5. Notes

- **Accent color `#f5c518` (gold)** — visually distinct from all news sources, signals "sponsored" for AdSense policy compliance.
- **`React.memo`** — prevents the AdSense iframe from being destroyed when `App` re-renders (clock every 1s, data every 5m). This is a correctness concern, not a performance optimization.
- **Fixed 90px height** — prevents CLS and avoids compressing the 7 news rows. If the ad fails to load or is blocked, the row remains empty with its gold accent — no fallback UI needed for v1.

## Context

- **Files touched:** `index.html`, `src/App.jsx`, `src/App.css`
- **No new files created** (component added inline, following existing pattern)
- **No new dependencies**
- **Risk:** Low — additive changes only, no logic changes to existing news functionality

## References

- Existing ad setup: `public/ads.txt` (already created)
- [AdSense implementation guide](https://support.google.com/adsense/answer/9274025)
- [React + AdSense patterns](https://support.google.com/adsense/answer/7477845) — SPA considerations
