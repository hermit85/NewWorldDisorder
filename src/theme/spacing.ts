// ─────────────────────────────────────────────────────────────
// NWD Design System — Spacing & Radii (Compact density)
//
// User-locked configuration: palette = Acid · type = Rajdhani ·
// density = COMPACT. Compact density per design-system/tokens.ts:
//
//   compact:  { pad: 16, gap: 10, radius: 14, cardRadius: 18,
//               fontScale: 0.95 }
//
// We surface compact pad / gap / cardRadius as additional tokens
// alongside our existing 8-step scale so callers can mix freely
// (existing screens read spacing.lg = 16 which already matches
// compact pad). New screens should reach for `spacing.pad` and
// `spacing.gap` to make density-dependence explicit.
// ─────────────────────────────────────────────────────────────
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,

  // ── Density tokens (compact) ───────────────────────────────
  /** Container padding — `compact.pad`. Default screen edge gutter. */
  pad: 16,
  /** Vertical gap between siblings — `compact.gap`. */
  gap: 10,
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 14,           // = compact.radius
  xl: 24,
  full: 999,

  // ── Density-explicit aliases (compact) ─────────────────────
  /** `compact.cardRadius` — cards, modals, tiles. */
  card: 18,
  /** `compact.radius` — buttons (ghost), inputs, generic surfaces. */
  control: 14,
  /** Pill — primary CTAs and state badges. */
  pill: 999,
} as const;
