# Iconography

12 glyphs. 24×24 grid. Stroke 1.6px. Square caps. Miter joins. That's the entire spec.

## Why these 12

These cover everything in the product. Don't add more without auditing first — every new icon dilutes recognition.

| name | role | when |
|---|---|---|
| `gate` | start gate | run flow start, race intro |
| `flag` | finish flag | run end, leaderboard |
| `split` | section/segment | between gates, intermediate splits |
| `podium` | leaderboard, ranking | profile, season stats |
| `verified` | run accepted | post-validation, trust marks |
| `lock` | armed / locked-in | arm CTA, ranked-only zones |
| `lift` | lift / cable car | spot detail, infrastructure |
| `line` | trail / track line | spot detail, line preview |
| `spot` | location pin | spot list, map markers |
| `bike` | bike / ride | training mode, bike fit |
| `timer` | clock / time | upcoming, history, scheduled |
| `rec` | recording dot | live indicator, GPS active |

## Spec

```
viewBox: 0 0 24 24
stroke: 1.6
stroke-linecap: square
stroke-linejoin: miter
fill: none (default) | currentColor (filled variant)
color: var(--nwd-text) (default) | var(--nwd-accent) (accent) | inherit
```

## Variants

| variant | use |
|---|---|
| `default` | stroke `currentColor`, fill none — most uses |
| `accent` | stroke `var(--nwd-accent)` — for armed/active state |
| `filled` | fill currentColor, no stroke — only for `rec` and the verified-badge background |

## SVG paths

Drop these into a single `IconGlyph` component. Keys map to `name` prop.

```tsx
const PATHS: Record<IconName, JSX.Element> = {
  gate: (
    <>
      <path d="M5 4 L5 20 M19 4 L19 20"/>
      <path d="M5 8 L19 8 M5 12 L19 12 M5 16 L19 16"/>
    </>
  ),
  flag: (
    <>
      <path d="M5 21 L5 4"/>
      <path d="M5 5 L19 5 L17 9 L19 13 L5 13"/>
    </>
  ),
  split: (
    <path d="M4 12 L20 12 M4 12 L8 8 M4 12 L8 16 M20 12 L16 8 M20 12 L16 16"/>
  ),
  podium: (
    <path d="M3 21 L21 21 M9 21 L9 11 L15 11 L15 21 M3 21 L3 15 L9 15 M21 21 L21 17 L15 17"/>
  ),
  verified: (
    <path d="M3 12 L9 18 L21 6"/>
  ),
  lock: (
    <path d="M6 11 L18 11 L18 21 L6 21 Z M9 11 L9 7 A3 3 0 0 1 15 7 L15 11"/>
  ),
  lift: (
    <path d="M3 6 L21 14 M5 5 L7 7 M11 8 L13 10 M17 11 L19 13"/>
  ),
  line: (
    <path d="M3 18 C8 4, 16 20, 21 6"/>
  ),
  spot: (
    <>
      <circle cx="12" cy="10" r="4"/>
      <path d="M12 14 L12 21 M8 21 L16 21"/>
    </>
  ),
  bike: (
    <>
      <circle cx="6" cy="16" r="4"/>
      <circle cx="18" cy="16" r="4"/>
      <path d="M6 16 L11 8 L18 16 M11 8 L8 8 M11 8 L13 5"/>
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7"/>
      <path d="M12 13 L12 9 M9 4 L15 4"/>
    </>
  ),
  rec: (
    <>
      <circle cx="12" cy="12" r="4" fill="var(--nwd-accent)" stroke="none"/>
      <circle cx="12" cy="12" r="9"/>
    </>
  ),
};
```

## Component

```tsx
type IconName = 'gate' | 'flag' | 'split' | 'podium' | 'verified' | 'lock' |
                'lift' | 'line' | 'spot' | 'bike' | 'timer' | 'rec';

export function IconGlyph({
  name,
  size = 24,
  variant = 'default',
}: {
  name: IconName;
  size?: number;
  variant?: 'default' | 'accent' | 'filled';
}) {
  const stroke = variant === 'accent' ? 'var(--nwd-accent)' : 'currentColor';
  const fill = variant === 'filled' ? 'currentColor' : 'none';
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         fill={fill} stroke={stroke} strokeWidth="1.6"
         strokeLinecap="square" strokeLinejoin="miter">
      {PATHS[name]}
    </svg>
  );
}
```

## Don't

- Don't add line caps/joins — square + miter is the entire visual identity. Round = wrong app.
- Don't use stroke-width below 1.4 or above 2 — breaks consistency.
- Don't bring in icon libraries (Lucide, Heroicons, etc) — they round their corners.
- Don't draw new icons ad-hoc in screens — add to this set or reject.
