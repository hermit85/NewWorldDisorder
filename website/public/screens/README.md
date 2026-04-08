# NWD App Screenshots — drop zone

The landing page (`website/app/page.tsx`) reads three real-app
screen captures from this directory at **build time**. When the
files are present, the three phone frames in §03 EKRANY render
the real screenshots. When they are absent, the frames fall back
to the CSS-built mocks.

## Filenames the page expects

- `result.png` — Result / META screen
- `profile.png` — Rider / profile screen
- `leaderboard.png` — Tablica / leaderboard screen

## Recommended capture spec

- iPhone 15 / 16 portrait, **1290 × 2796** (Pro size) or
  1170 × 2532 (non-Pro). Either works.
- Status bar visible, **dark mode**.
- Captures should show a real verified run (e.g. Gałgan, ~02:14)
  so the screen content matches the marketing copy.
- Save as PNG, lossless. Avoid pre-cropping — the phone frame
  in CSS clips to the correct aspect ratio.
- Profile screen should show the app's HUNTER (or higher) rank
  so the rank ladder is visible.
- Leaderboard should show the current user highlighted at #7
  so the visual matches the v3 mock that lives in code.

## How the fallback works

`page.tsx` is a Next.js server component. It uses `fs.existsSync`
at build time to decide which markup to render per phone. No
runtime cost, no broken builds if a file is missing — the page
simply continues to render the CSS mock for that phone until the
real PNG is added.

## After dropping files

```
git add website/public/screens/result.png \
        website/public/screens/profile.png \
        website/public/screens/leaderboard.png
git commit -m "marketing: add real app screenshots to landing"
git push
```

Vercel auto-deploys; the next build will pick up the real screens.
