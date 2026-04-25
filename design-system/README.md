# NWD Design System

> Handoff package for Claude Code. Read in this order: README → tokens → theme → components → patterns → voice → icons.

## Product DNA

NWD = **New World Disorder**. Mobile app that turns real downhill MTB tracks into a verified racing league. Three core states define everything:

| State | Meaning | Visual |
|---|---|---|
| **Training** | Ride for fun, doesn't count | Muted gray, no animation |
| **Armed** | Riding for ranking, GPS verified | Accent green, fast pulse (1.2s) |
| **Verified** | Run accepted into league | Accent green, slow breathe (2.4s) |
| **Pending** | Validating GPS / line / gates | Amber, 0.6s blink |
| **Invalid** | DNF/DSQ — line broken, gate missed | Red, solid |

Every screen, button, badge inherits from this. The state hierarchy IS the brand.

## Visual identity in one paragraph

Race-game DNA, not fitness-app DNA. Forza/Trials, not Strava/Whoop. Dense game-HUD chrome (corner brackets, scan lines, race-number watermarks, system text in mono), holographic accent on near-black, big tabular telemetry numbers, brutal mono labels. Display font condensed (Rajdhani), mono geometric (JetBrains Mono). Three palettes available — Acid (canonical), Forge (orange), Arctic (blue) — all dark, never light mode.

## File map

```
design-system/
├── README.md         ← you are here
├── tokens.ts         ← typed token bag, single source of truth
├── theme.css         ← CSS variables + keyframes (drop into global)
├── components.md     ← Btn / Pill / HudPanel / RaceTime / etc specs
├── patterns.md       ← race state pattern, run flow, leaderboard
├── voice.md          ← copywriting rules, forbidden phrases
└── icons.md          ← 12 glyphs with SVG paths
```

## Implementation order for Claude Code

1. **Drop `theme.css` into global stylesheet.** All CSS vars become available.
2. **Import `tokens.ts` as single source.** Use `tokens.color.accent` not `'#00FF87'`. Never hardcode.
3. **Build base components from `components.md`.** Btn, Pill, HudPanel, RaceTime, IconGlyph.
4. **Wire up race-state badges from `patterns.md`.** This is the most-reused pattern.
5. **Audit existing copy against `voice.md`.** Replace anything that breaks rules.
6. **Replace ad-hoc icons with `icons.md` set.** 12 glyphs cover the product.

## Non-negotiables

- **Numbers are tabular-nums.** Always. `font-variant-numeric: tabular-nums`. Race times must not jitter.
- **Race state owns color.** Don't use `accent` for non-state UI elements (links, decorations) — use `text` or `textMuted`.
- **Reduce motion is honored.** All animations gated on `prefers-reduced-motion: no-preference`.
- **No light mode.** Product is night-of-race energy. Light theme dilutes.
- **No emoji in UI.** Use `<IconGlyph>` from icon set.
- **CTA = CAPS + imperative.** Never "Click here", never "Continue?". Always "WEJDŹ", "ARM", "WYŚLIJ".

## What changed from prototype

The current prototype (`NWD Prototype.html`) ships an early version of these tokens but with gaps audited in `NWD Audit.html`. This DS closes those gaps:

- Race-state colors split from generic `accent`
- 7-step type scale (was: 12 ad-hoc sizes)
- Telemetry-specific number tokens (timer, split, delta, position)
- 6 named motion tokens (was: hardcoded durations)
- 5-layer elevation (was: 2)
- 6 chrome primitives extracted as components
- 6 voice tokens with forbidden-list
- 12-glyph icon system with consistent stroke

Prototype will be refactored after DS lands.
