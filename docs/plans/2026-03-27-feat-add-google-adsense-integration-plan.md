---
title: Add Google AdSense Integration
type: feat
date: 2026-03-27
---

# ✨ Add Google AdSense Integration

## Overview

Add Google AdSense site verification and ads.txt for ad serving authorization. Two small changes to existing files/directories.

## Acceptance Criteria

- [ ] `<meta name="google-adsense-account" content="ca-pub-7114488121930728">` is present in the `<head>` of `index.html`
- [ ] `ads.txt` exists in `public/` and is served at the site root (`/ads.txt`)
- [ ] Verify `ads.txt` is accessible after build (`dist/ads.txt`)

## Implementation

### 1. Add meta tag to `index.html`

```html
<!-- index.html — add after line 7 (theme-color meta) -->
<head>
  <meta charset="utf-8" />
  <link rel="shortcut icon" href="/favicon.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#000000" />
  <meta name="google-adsense-account" content="ca-pub-7114488121930728" />
  <link rel="manifest" href="/manifest.json" />
  <title>Inundate</title>
</head>
```

### 2. Create `public/ads.txt`

Vite copies everything in `public/` to the build output (`dist/`) as-is. Create `public/ads.txt` with the Google AdSense publisher entry:

```txt
google.com, pub-7114488121930728, DIRECT, f08c47fec0942fa0
```

**Format:** `<domain>, <publisher-id>, <relationship>, <cert-authority-id>`

- `google.com` — the ad system domain
- `pub-7114488121930728` — your publisher ID (matches the meta tag, without the `ca-` prefix)
- `DIRECT` — you own this account directly
- `f08c47fec0942fa0` — Google's TAG certification authority ID (standard for all AdSense publishers)

### 3. Verify

```bash
npm run build && cat dist/ads.txt
```

Confirm `ads.txt` appears in the build output. After deploy, verify at `https://<your-domain>/ads.txt`.

## Context

- **Framework:** React 19 + Vite 7
- **Deployment:** Vercel (static files in `public/` are served from root)
- **Files touched:** `index.html`, `public/ads.txt` (new)
- **Risk:** None — purely additive, no logic changes

## References

- [Google AdSense ads.txt guide](https://support.google.com/adsense/answer/7532444)
- [Vite static asset handling](https://vitejs.dev/guide/assets#the-public-directory)
