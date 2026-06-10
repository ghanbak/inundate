---
title: "refactor: Migrate to Tailwind CSS v4"
type: refactor
date: 2026-04-01
---

# Migrate Inundate to Tailwind CSS v4

## Overview

Replace the project's hand-written CSS (`src/App.css` and `src/index.css`) with Tailwind CSS v4 utility classes. The project uses Vite 7.3 + React 19, which is the ideal target for Tailwind v4's first-party Vite plugin. The migration will eliminate ~60 custom CSS rules across two files and replace them with inline utility classes in JSX, while preserving custom CSS only where Tailwind utilities cannot express the style (keyframe animations, `color-mix()` with CSS variables).

## Problem Statement / Motivation

- The current CSS is a flat list of ~25 BEM-style classes in `App.css` plus base resets in `index.css`. As the app grows, this pattern scales poorly: class names proliferate, specificity conflicts arise, and it becomes harder to tell which styles are actually used.
- Tailwind CSS v4 provides a zero-config Vite plugin, CSS-first theme configuration (no `tailwind.config.js` needed), and utility classes that co-locate style with markup. This is a natural fit for a single-page React app with a small component tree.
- The migration also unlocks Tailwind's responsive and state variants for future features (mobile layout, dark/light mode toggle, hover states).

## Proposed Solution

### Phase 1: Install and Configure Tailwind CSS v4

**Files changed:** `package.json`, `vite.config.js`, `src/index.css`

#### 1a. Install packages

```bash
npm install tailwindcss @tailwindcss/vite
```

Only two packages are needed. Tailwind v4 does **not** require PostCSS, autoprefixer, or a separate `tailwind.config.js` / `postcss.config.js`. The `@tailwindcss/vite` plugin handles everything.

#### 1b. Add the Vite plugin

```js
// vite.config.js
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
  },
});
```

#### 1c. Replace `src/index.css` with Tailwind directives and theme

The current `index.css` contains base resets (margin, height, overflow, font, colors) and a `#root` rule. Replace it entirely:

```css
@import "tailwindcss";

@theme {
  /* Custom colors matching the existing dark theme */
  --color-hud-bg: #0a0a0a;
  --color-hud-bar: #111111;
  --color-hud-border: #222222;
  --color-hud-text: #e0e0e0;
  --color-hud-muted: #888888;
  --color-hud-dim: #666666;
  --color-hud-subtle: #444444;
  --color-hud-separator: #333333;
  --color-hud-error: #ff4444;

  /* Custom font family */
  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;

  /* Custom animation for the ticker */
  --animate-ticker-scroll: ticker-scroll 60s linear infinite;
}

/* Keyframes must live outside @theme (tokens only) */
@keyframes ticker-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

/* Base resets that apply globally */
@layer base {
  html, body {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: var(--color-hud-bg);
    color: var(--color-hud-text);
    font-family: var(--font-mono);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
  }
}
```

**Verification checkpoint:** After Phase 1, run `npm run dev`. The page should load with the dark background and monospace font. Tailwind is active but no utility classes are in use yet, so layout will be broken. That is expected.

---

### Phase 2: Convert Component Styles to Utility Classes

**Files changed:** `src/App.jsx`, `src/App.css` (progressively emptied, then deleted)

This is the core of the migration. Each CSS class is converted to Tailwind utilities on the corresponding JSX element. The strategy is to migrate one component section at a time, deleting the corresponding CSS rule from `App.css` after each conversion, so the app can be tested incrementally.

#### Conversion Order

Migrate top-down through the component tree, verifying each section visually before moving on:

1. `.hud` (App root container)
2. `.hud-bar`, `.hud-bar-title`, `.hud-bar-clocks`, `.hud-bar-clock`, `.hud-clock-label`, `.hud-clock-time` (top bar)
3. `.hud-rows` (source rows wrapper)
4. `.hud-row` (individual source row) -- **requires custom CSS, see below**
5. `.hud-sidebar`, `.hud-favicon`, `.hud-favicon-fallback`, `.hud-source-label` (sidebar)
6. `.hud-ticker`, `.hud-ticker-link`, `.hud-ticker-separator`, `.hud-ticker-empty` (ticker content)
7. `.ticker-scroll`, `.ticker-scroll-inner`, `.ticker-scroll-inner.paused`, `.ticker-scroll-item` (ticker animation)
8. `.hud-ad-row`, `.hud-ad-ticker` (ad row)
9. `.hud-error` (error banner)

#### Detailed Class-to-Utility Mapping

Below is the complete mapping for every CSS class. Classes marked with a wrench need custom CSS or arbitrary values.

**1. `.hud` -- App root**

```
CSS:  height: 100vh; display: flex; flex-direction: column; background: #0a0a0a;
TW:   className="h-screen flex flex-col bg-hud-bg"
```

**2. `.hud-bar` -- Top bar**

```
CSS:  height: 40px; min-height: 40px; display: flex; align-items: center;
      justify-content: space-between; padding: 0 16px; background: #111;
      border-bottom: 1px solid #222;
TW:   className="h-10 min-h-10 flex items-center justify-between px-4 bg-hud-bar border-b border-hud-border"
```

**3. `.hud-bar-title` -- Title text**

```
CSS:  font-size: 14px; font-weight: 700; letter-spacing: 4px; color: #e0e0e0; text-transform: uppercase;
TW:   className="text-sm font-bold tracking-[4px] text-hud-text uppercase"
```

**4. `.hud-bar-clocks` -- Clocks container**

```
CSS:  flex: 1; display: flex; justify-content: space-evenly; align-items: center;
      overflow: hidden; min-width: 0;
TW:   className="flex-1 flex justify-evenly items-center overflow-hidden min-w-0"
```

**5. `.hud-bar-clock` -- Individual clock**

```
CSS:  display: flex; align-items: center; gap: 6px; font-size: 13px;
      color: #888; letter-spacing: 1px;
TW:   className="flex items-center gap-1.5 text-sm text-hud-muted tracking-[1px]"
```

(13px → `text-sm` / 14px — closest standard Tailwind size, rounds up for readability)

**6. `.hud-clock-label` -- Clock label**

```
CSS:  font-size: 13px; font-weight: 600; color: #666; text-transform: uppercase;
TW:   className="text-sm font-semibold text-hud-dim uppercase"
```

(13px → `text-sm` / 14px)

**7. `.hud-clock-time` -- Clock time**

```
CSS:  font-variant-numeric: tabular-nums;
TW:   className="tabular-nums"
```

**8. `.hud-rows` -- Rows wrapper**

```
CSS:  flex: 1; display: flex; flex-direction: column; margin-bottom: 96px;
TW:   className="flex-1 flex flex-col mb-24"
```

**9. `.hud-row` -- Source row (REQUIRES CUSTOM CSS)**

This class uses `var(--accent-color)` for `border-left` and a `color-mix()` gradient background. These cannot be expressed as pure Tailwind utilities because they depend on a runtime CSS variable set via inline `style`.

```
Tailwind portion:  className="flex-1 flex border-b border-hud-border last:border-b-0 border-l-3 border-l-(--accent-color) overflow-hidden hud-row"
                   style={{ "--accent-color": source.color }}
```

The accent border color is handled by Tailwind v4's `border-l-(--accent-color)` syntax, which reads the runtime CSS variable set via inline `style`. Only the `color-mix()` gradient remains as custom CSS:

```css
@layer components {
  .hud-row {
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent-color) 8%, #111) 0%,
      #0a0a0a 40%
    );
  }
}
```

**10. `.hud-sidebar` -- Sidebar**

```
CSS:  width: 64px; min-width: 64px; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 4px;
      background: rgba(0,0,0,0.3); border-right: 1px solid #222;
TW:   className="w-16 min-w-16 flex flex-col items-center justify-center gap-1 bg-black/30 border-r border-hud-border"
```

**11. `.hud-favicon` -- Favicon image**

```
CSS:  width: 24px; height: 24px; border-radius: 4px;
TW:   className="w-6 h-6 rounded"
```

**12. `.hud-favicon-fallback` -- Favicon fallback**

```
CSS:  width: 24px; height: 24px; border-radius: 4px; display: flex;
      align-items: center; justify-content: center; font-size: 10px;
      font-weight: 700; color: #fff; background: var(--accent-color);
TW:   className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold text-white"
      style={{ background: source.color }}
```

(10px → `text-xs` / 12px — closest standard Tailwind size)

Note: The `background: var(--accent-color)` is already applied via inline `style` in the JSX, so no custom CSS needed.

**13. `.hud-source-label` -- Source name**

```
CSS:  font-size: 9px; color: #888; letter-spacing: 1px; text-transform: uppercase;
TW:   className="text-xs text-hud-muted tracking-[1px] uppercase"
```

(9px → `text-xs` / 12px — significant visual change but closest standard Tailwind size; avoids arbitrary values)

**14. `.hud-ticker` -- Ticker container**

```
CSS:  flex: 1; display: flex; align-items: center; overflow: hidden; padding: 0;
TW:   className="flex-1 flex items-center overflow-hidden"
```

**15. `.ticker-scroll` -- Scroll wrapper**

```
CSS:  overflow: hidden; width: 100%;
TW:   className="overflow-hidden w-full"
```

**16. `.ticker-scroll-inner` -- Scrolling track**

```
CSS:  display: inline-flex; white-space: nowrap;
      animation: ticker-scroll 60s linear infinite;
TW:   className="inline-flex whitespace-nowrap animate-ticker-scroll"
```

The animation duration is set dynamically via inline `style={{ animationDuration: ... }}` in the JSX. The `animate-ticker-scroll` utility comes from the `@theme` definition in Phase 1.

**17. `.ticker-scroll-inner.paused` -- Paused state**

The `paused` class toggles `animation-play-state: paused`. Tailwind does not have a built-in utility for `animation-play-state`. Use the custom `@utility ticker-paused` defined in `index.css`:

```
className={`inline-flex whitespace-nowrap animate-ticker-scroll ${paused ? "ticker-paused" : ""}`}
```

**18. `.ticker-scroll-item` -- Individual ticker item**

```
CSS:  flex-shrink: 0;
TW:   className="shrink-0"
```

**19. `.hud-ticker-link` -- Article link**

```
CSS:  font-weight: 600; color: var(--accent-color); text-decoration: none;
      font-size: 13px; filter: brightness(1.4);
TW:   className="font-semibold no-underline text-sm brightness-150 hover:underline"
      style={{ color: "var(--accent-color)" }}
```

(13px → `text-sm` / 14px; `brightness(1.4)` → `brightness-150` is the closest standard Tailwind filter — 1.5 vs 1.4)

The color uses `var(--accent-color)` which is set on the parent `.hud-row`. Since this is a runtime variable, apply it via inline style.

**20. `.hud-ticker-separator` -- Pipe separator**

```
CSS:  padding: 0 24px; color: #333;
TW:   className="px-6 text-hud-separator"
```

**21. `.hud-ticker-empty` -- Empty/loading text**

```
CSS:  color: #444; font-size: 12px; font-style: italic;
TW:   className="text-hud-subtle text-xs italic"
```

**22. `.hud-ad-row` -- Fixed ad container**

```
CSS:  position: fixed; bottom: 0; left: 0; right: 0; height: 96px;
      z-index: 10; border-top: 1px solid #222;
TW:   className="fixed bottom-0 left-0 right-0 h-24 z-10 border-t border-hud-border"
```

Combined with the shared `.hud-row` class styles, the full className becomes:

```
className="flex hud-row fixed bottom-0 left-0 right-0 h-24 z-10 border-t border-hud-border"
```

**23. `.hud-ad-ticker` -- Ad ticker content**

```
CSS:  display: flex; align-items: center; justify-content: center; padding: 8px 16px;
TW:   className="flex items-center justify-center px-4 py-2"
```

(Note: removed erroneous `flex-1` — the current CSS does not have `flex: 1` on this element)

**24. `.hud-error` -- Error text**

```
CSS:  color: #ff4444; font-size: 11px; padding: 0 12px; display: flex; align-items: center;
TW:   className="text-hud-error text-xs px-3 flex items-center"
```

(11px → `text-xs` / 12px)

---

### Phase 3: Clean Up and Delete `App.css`

**Files changed:** `src/App.jsx` (remove import), `src/App.css` (delete)

1. Remove the `import "./App.css"` line from `App.jsx`
2. Delete `src/App.css` entirely
3. Ensure the remaining custom CSS (`.hud-row` gradient/border and `@utility ticker-paused`) lives in `src/index.css` within the appropriate layers

#### Final `src/index.css` structure

```css
@import "tailwindcss";

@theme {
  --color-hud-bg: #0a0a0a;
  --color-hud-bar: #111111;
  --color-hud-border: #222222;
  --color-hud-text: #e0e0e0;
  --color-hud-muted: #888888;
  --color-hud-dim: #666666;
  --color-hud-subtle: #444444;
  --color-hud-separator: #333333;
  --color-hud-error: #ff4444;

  --font-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;

  --animate-ticker-scroll: ticker-scroll 60s linear infinite;
}

/* Keyframes must live outside @theme (tokens only) */
@keyframes ticker-scroll {
  0% {
    transform: translateX(0);
  }
  100% {
    transform: translateX(-50%);
  }
}

@layer base {
  html, body {
    margin: 0;
    height: 100%;
    overflow: hidden;
    background: var(--color-hud-bg);
    color: var(--color-hud-text);
    font-family: var(--font-mono);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  #root {
    height: 100%;
  }
}

@layer components {
  .hud-row {
    /* Only the gradient needs custom CSS — color-mix() has no Tailwind utility.
       The border-left is handled via Tailwind: border-l-3 border-l-(--accent-color) */
    background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--accent-color) 8%, #111) 0%,
      #0a0a0a 40%
    );
  }
}

@utility ticker-paused {
  animation-play-state: paused;
}
```

---

## Technical Considerations

### What Maps Cleanly to Tailwind

The vast majority of styles (22 out of 25 classes) convert directly to Tailwind utility classes. Layout (flex, grid), spacing (padding, margin, gap), typography (font-size, font-weight, letter-spacing, text-transform), colors, borders, and overflow are all well-supported.

### What Requires Custom CSS

Two patterns cannot be expressed as pure Tailwind utilities:

1. **`color-mix()` with CSS variables** -- The `.hud-row` gradient background uses `color-mix(in srgb, var(--accent-color) 8%, #111)`. Tailwind has no utility for `color-mix()`. This stays as a `.hud-row` component class.

2. **`animation-play-state: paused`** -- Tailwind v4 has no built-in utility for animation play state. Defined as `@utility ticker-paused`.

### Resolved from Review

- **`border-left: 3px solid var(--accent-color)`** -- Handled via `border-l-3 border-l-(--accent-color)`. Tailwind v4 supports this syntax for runtime CSS variables set via inline style. The `.hud-row` custom CSS is now reduced to just the gradient.
- **`@keyframes` placement** -- Moved out of `@theme` (which is for design tokens only) to top-level scope.
- **Font sizes** -- All arbitrary font sizes (`text-[13px]`, `text-[9px]`, etc.) replaced with closest standard Tailwind classes (`text-sm`, `text-xs`). This introduces minor visual differences (e.g., 9px→12px for source labels, 13px→14px for clock/ticker text) but eliminates arbitrary value brackets throughout.
- **`.hud-ad-ticker` `flex-1`** -- Removed. The current CSS does not have `flex: 1` on this element; it was erroneously added in the original plan.
- **Paused state approach** -- Committed to `@utility ticker-paused` instead of the arbitrary property `[animation-play-state:paused]` class.

### Performance

- Tailwind v4's Vite plugin does JIT compilation with no separate PostCSS step, so build performance should be equivalent or better than the current plain CSS setup.
- No runtime cost: all classes are compiled at build time.

### Testing

- The existing test (`App.test.jsx`) tests that the app renders without crashing. It does not test CSS classes, so it should pass without modification.
- Visual verification is the primary testing strategy. Check each section after migration.

## Acceptance Criteria

- [x] `tailwindcss` and `@tailwindcss/vite` are installed and configured in `vite.config.js`
- [x] `src/index.css` contains Tailwind import, `@theme` configuration, base layer resets, and minimal custom CSS
- [x] `src/App.css` is deleted
- [x] `src/App.jsx` uses Tailwind utility classes on all elements (no `className` references to deleted CSS classes)
- [ ] The app renders identically to the pre-migration version (dark theme, top bar with clocks, source rows with accent colors, scrolling tickers, fixed ad row)
- [ ] The ticker scroll animation works (infinite horizontal scroll, pauses on hover)
- [ ] The accent color gradient and border-left render correctly for each source row
- [x] `npm run build` completes without errors
- [ ] `npm run test` passes

## Dependencies and Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `color-mix()` browser support | Low | Already in use; Tailwind v4 requires the same browser versions (Chrome 111+, Safari 16.4+, Firefox 128+) |
| `@tailwindcss/vite` incompatibility with Vite 7.3 | Low | Tailwind v4 targets Vite 5+; verify plugin version supports Vite 7 |
| Ticker animation timing changes | Low | Animation is defined identically in `@theme`; `animationDuration` override via inline style is preserved |
| AdSense `<ins>` element styling conflicts | Low | AdSense styles are inline and isolated; no Tailwind preflight should affect them |

## References

- [Tailwind CSS v4 Installation (Vite)](https://tailwindcss.com/docs/installation) -- `npm install tailwindcss @tailwindcss/vite`
- [Tailwind CSS v4 Theme Configuration](https://tailwindcss.com/docs/configuration) -- `@theme` directive, CSS-first config
- [Tailwind CSS v4 Adding Custom Styles](https://tailwindcss.com/docs/adding-custom-styles) -- `@layer`, `@utility`, arbitrary values
- [Tailwind CSS v4 Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide) -- Breaking changes from v3, new syntax
- Source files: `src/App.jsx`, `src/App.css`, `src/index.css`, `vite.config.js`
