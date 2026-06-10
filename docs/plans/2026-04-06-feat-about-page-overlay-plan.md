---
title: "feat: Add about page overlay"
type: feat
date: 2026-04-06
---

# Add About Page Overlay

## Overview

Add a full-screen overlay "about" page accessible via a Lucide `CircleHelp` icon in the top bar. The page explains the ethos of Inundate in a dry, sardonic tone — a commentary on how the 24-hour news cycle demands your attention while having virtually no impact on your daily life.

## Content Direction

The core message: **"You're watching news that doesn't matter, and you know it."**

The name "Inundate" is the thesis — you're being flooded with information that feels urgent but isn't. The about page should lean into that irony. Suggested angles to expand the message:

### Threads to pull on

1. **The attention tax.** Every headline is engineered to feel like it matters right now. Almost none of them will matter tomorrow. The news cycle is a machine that converts your attention into ad revenue, and the exchange rate is terrible.

2. **The illusion of being informed.** Reading 50 headlines doesn't make you more informed — it makes you more anxious. The person who reads zero news and the person who reads all of it make the same decisions about what to have for dinner.

3. **Nothing here is actionable.** If a headline required you to do something, you'd already know. The things that actually affect your life — your relationships, your work, your health — aren't scrolling across a ticker.

4. **The site as proof.** Inundate exists to make the point viscerally. Seven sources, hundreds of headlines, all updating constantly. Stare at it long enough and they blur together. That's the point.

5. **Permission to look away.** You don't need to keep up. The news will happen whether you watch it or not.

### Suggested copy (draft)

> **Inundate** /ˈɪn.ʌn.deɪt/ — to overwhelm with things to be dealt with.
>
> This is a wall of news. Seven sources. Hundreds of headlines. All updating constantly. None of it will change what you do today.
>
> The modern news cycle is a machine that converts your attention into revenue. Every headline is engineered to feel urgent. Almost none of them are. The person who reads every story and the person who reads none of them will make the same decisions about what to have for dinner.
>
> Inundate exists to make this visible. Stare at it long enough and the headlines blur together. That's not a bug.
>
> You don't need to keep up. The news will happen whether you watch it or not.
>
> Close this and go do something that matters.
>
> Begrudgingly crafted by [ghanbak](https://ghanbak.com)

The "ghanbak" link opens in a new tab (`target="_blank" rel="noopener noreferrer"`).

## Acceptance Criteria

- [x] `lucide-react` installed as dependency
- [x] `CircleHelp` icon displayed in the top bar (right side, before clocks or after title)
- [x] Clicking the icon opens a full-screen overlay with the about content
- [x] Overlay uses the existing dark theme (`bg-hud-bg`, monospace font)
- [x] Clicking a close button or pressing Escape dismisses the overlay
- [x] The overlay prevents scrolling of the ticker content behind it
- [x] Copy is sardonic in tone, covering the core themes above
- [x] Sign-off at the bottom: "Begrudgingly crafted by ghanbak" linking to https://ghanbak.com (opens in new tab)

## Files to Change

| File | Change |
|------|--------|
| `package.json` | Add `lucide-react` dependency |
| `src/App.jsx` | Add `CircleHelp` icon to top bar, add `AboutOverlay` component with state toggle |

## Implementation

### 1. Install lucide-react

```bash
npm install lucide-react
```

### 2. Add state and icon to top bar (`src/App.jsx`)

```jsx
import { CircleHelp, X } from "lucide-react";

// Inside App component:
const [showAbout, setShowAbout] = useState(false);

// In the top bar div, after the title span:
<button
  onClick={() => setShowAbout(true)}
  className="text-hud-dim hover:text-hud-text transition-colors"
  aria-label="About Inundate"
>
  <CircleHelp size={16} />
</button>
```

### 3. Add AboutOverlay component (inside `src/App.jsx`)

A simple full-screen overlay component. Uses `fixed inset-0` positioning, dark background, centered content with max-width for readability. Close on button click or Escape key.

```jsx
function AboutOverlay({ onClose }) {
  useEffect(() => {
    const handleEsc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-hud-bg/95 flex items-center justify-center p-8">
      <button onClick={onClose} className="absolute top-4 right-4 text-hud-dim hover:text-hud-text">
        <X size={20} />
      </button>
      <div className="max-w-xl text-hud-muted leading-relaxed space-y-6">
        {/* About content here */}
      </div>
    </div>
  );
}
```

### 4. Render conditionally in App

```jsx
{showAbout && <AboutOverlay onClose={() => setShowAbout(false)} />}
```

## Context

- No React Router in the project — this is a state-based overlay, not a route
- The existing app is a single component file (`App.jsx`) with inline components
- Design tokens are defined in `src/index.css` via Tailwind `@theme`
- The top bar currently has: title (left), WorldClocks (right)
