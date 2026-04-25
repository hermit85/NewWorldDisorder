# Components

Specs for the core components. Build these once, use everywhere. Each spec lists: purpose, props, anatomy, states, sample markup.

---

## Btn

CTA button. CAPS label, accent fill or outline.

**Props**

| prop | type | default | notes |
|---|---|---|---|
| variant | `'primary' \| 'ghost' \| 'danger'` | `'primary'` | primary = accent fill; ghost = bordered; danger = red fill |
| size | `'sm' \| 'md' \| 'lg'` | `'md'` | lg = full-width 56h; md = 44h; sm = 32h |
| icon | `IconName` | — | left side, 16-20px |
| disabled | `boolean` | false | reduces opacity to 0.4, blocks pointer |

**Anatomy**

```
[Icon?]  LABEL TEXT
```

- Padding: `0 var(--nwd-space-lg)` (lg), `0 var(--nwd-space-md)` (md/sm)
- Radius: `var(--nwd-radius-pill)` for primary, `var(--nwd-radius-lg)` for ghost
- Label: `.nwd-label` (mono caps, 11px, +0.24em tracking)
- Primary fill: `var(--nwd-accent)` bg, `var(--nwd-accent-ink)` text, `var(--nwd-glow-soft)` shadow on hover

**States**

- default → glow-soft shadow
- hover → glow-hot shadow, scale(1.01)
- active → scale(0.98)
- disabled → opacity 0.4, no shadow

**Sample**

```tsx
<Btn variant="primary" size="lg">ARM</Btn>
<Btn variant="ghost" icon="gate">WYBIERZ TRASĘ</Btn>
<Btn variant="danger">PORZUĆ PRZEJAZD</Btn>
```

---

## Pill

Status badge. CAPS label, optional dot indicator, color-coded by state.

**Props**

| prop | type | notes |
|---|---|---|
| state | `'training' \| 'armed' \| 'verified' \| 'pending' \| 'invalid' \| 'neutral'` | maps to `--nwd-state-*` |
| dot | `boolean` | shows leading dot (animated for armed/pending) |
| children | string | always rendered uppercase |

**Anatomy**

```
[●]  LABEL
```

- Height: 22px
- Padding: `4px 10px`
- Radius: `var(--nwd-radius-pill)`
- Border: 1px solid color@40%
- Background: color@14%
- Label: `.nwd-micro`, color = state color
- Dot: 6×6, full color, if `state === 'armed'` → `.nwd-anim-armed`, if `pending` → `.nwd-anim-pending`

---

## HudPanel

Game-HUD card. Used for telemetry, leaderboard sections, validation readouts.

**Props**

| prop | type | notes |
|---|---|---|
| title | string | shown as `.nwd-label` in top-left |
| status | string \| Pill | top-right |
| accent | boolean | adds left-border accent strip (3px) |
| corners | boolean | adds 4 corner brackets |

**Anatomy**

```
┌─ [LABEL] ──────────────── [STATUS] ─┐
│                                      │
│           {children}                 │
│                                      │
└──────────────────────────────────────┘
```

- Background: `var(--nwd-panel)` (e2)
- Border: 1px `var(--nwd-border)` or `var(--nwd-border-hot)` if accent
- Padding: `var(--nwd-space-md)`
- Optional accent strip: 3px tall on left edge, full height, `var(--nwd-accent)`
- Optional corner brackets: 14×14 inset 8px, stroke 1.5 accent

---

## RaceTime

The hero number. Used for run times in review/leaderboard hero/widget.

**Props**

| prop | type | notes |
|---|---|---|
| value | string | format `MM:SS.ms` or `M:SS.ms` |
| size | `'hero' \| 'split' \| 'widget'` | maps to telemetry tokens |
| dimMs | boolean | dim the centiseconds (e.g. 02:14.<span dim>83</span>) — default true for hero |
| delta | string | optional `−1.42 PB` shown after, mono |

**Sample**

```tsx
<RaceTime value="02:14.83" size="hero" delta="−1.42 PB" />
```

- Always `font-variant-numeric: tabular-nums`
- Hero: 56px display 800, lh 1.0, tracking -0.01em
- Split: 26px display 700
- Widget: 28px display 700
- Delta: 18px mono 800 in `--nwd-state-armed` if negative (faster = better), `--nwd-state-invalid` if positive

---

## LeaderboardRow

One row in a leaderboard. Position + rider + time + delta.

**Anatomy**

```
[##]  [Avatar] Rider Name        02:14.83  −1.42
                Bike Park · Trail
```

- Layout: grid `48px 1fr auto auto`, gap `var(--nwd-space-md)`
- Position: `telemetry.positionRow` (22px display 700), color = `--nwd-text` (or gold/silver/bronze for top 3)
- Rider name: `.nwd-lead` (22px) — but truncate at 1 line
- Sub-meta: `.nwd-caption` `--nwd-text-muted`
- Time: `.nwd-num` 22px display 700
- Delta: `.nwd-num` 13px mono 800 in state color

**States**

- default → `var(--nwd-row)` (e3)
- self (current user) → `var(--nwd-row-hot)` + `var(--nwd-border-hot)` + `var(--nwd-glow-soft)` (e4)
- new entry → flash `nwd-anim-pending` once on insert

---

## IconGlyph

Wraps the 12-glyph set from `icons.md`.

**Props**

| prop | type | notes |
|---|---|---|
| name | `IconName` | one of the 12 glyphs |
| size | number | px, default 24 |
| variant | `'default' \| 'accent' \| 'filled'` | default = stroke text; accent = stroke accent; filled = fill |

```tsx
<IconGlyph name="gate" size={28} variant="accent" />
```

- viewBox 0 0 24 24
- stroke 1.6 (square caps, miter joins)
- fill: variant === 'filled' uses fill, otherwise none

---

## Chrome primitives (utility components)

These are not "components" in the data sense — they are pure decorative wrappers. Build them as small SFCs.

### `<HudFrame>`
Combines: 4 corner brackets + scan lines overlay + optional race-number watermark. Wraps any content.

### `<CornerBrackets size weight color />`
4 corner brackets via SVG. Independent — use when you don't need full HudFrame.

### `<ScanLines opacity />`
Overlay div with `repeating-linear-gradient(0deg, var(--nwd-text) 0 0.5px, transparent 0.5px 3px)`. Pointer-events: none.

### `<RaceNumber n>`
Big number watermark in background. Uses `font-display`, weight 900, opacity 0.04. Position: absolute right/top.

### `<SystemText slot=tl|tr|bl|br>`
Mono caption pinned to a corner. 9px micro size, 0.24em tracking.

### `<HudPanel>` (see above)

---

## Implementation note for Claude Code

Build these in `src/components/nwd/` as separate files (`Btn.tsx`, `Pill.tsx`, `HudPanel.tsx`, `RaceTime.tsx`, `LeaderboardRow.tsx`, `IconGlyph.tsx`, `chrome/HudFrame.tsx`, etc). Export from `src/components/nwd/index.ts`. Storybook each one with all variants.
