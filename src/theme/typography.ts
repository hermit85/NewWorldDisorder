import { TextStyle } from 'react-native';

// ─────────────────────────────────────────────────────────────
// NWD Design System v1.0 — Typography
//
// Display = Rajdhani (sport condensed). Body = Inter. Mono =
// JetBrains Mono — not yet loaded in app/_layout.tsx; until then
// label/micro fall back to Inter Bold with wide letterSpacing.
//
// Numbers ALWAYS use `fontVariant: ['tabular-nums']` so race
// times don't jitter as digits change. § 13 Handoff non-negotiable.
//
// 7-step scale (§ 03 Typography):
//   hero    56/800/0.95 -0.02em   race-time hero
//   title   32/700/1.05 -0.01em   screen titles
//   lead    22/600/1.20 -0.005em  section heads
//   body    15/400/1.50           paragraphs
//   caption 13/500/1.40           secondary copy
//   label   11/800 mono +0.24em   kicker, pill (CAPS)
//   micro    9/700 mono +0.32em   chrome / tags (CAPS)
//
// React Native letterSpacing is absolute px, not em — converted at
// the canonical font sizes: 0.24em@11px ≈ 2.64, 0.32em@9px ≈ 2.88.
// ─────────────────────────────────────────────────────────────

// Font families — loaded via expo-font in app/_layout.tsx
export const fonts = {
  racing: 'Rajdhani_700Bold',
  racingLight: 'Rajdhani_400Regular',
  racingMedium: 'Rajdhani_500Medium',
  racingSemiBold: 'Rajdhani_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  // Mono — JetBrains Mono not yet bundled. Inter_700Bold with
  // wide tracking + uppercase is an acceptable substitute for
  // label / micro until the font ships in a TestFlight build.
  mono: 'Inter_700Bold',
} as const;

export const typography = {
  // ═════════════════════════════════════════════════════════
  // 7-STEP SCALE — design system canonical
  // ═════════════════════════════════════════════════════════

  hero: {
    fontFamily: fonts.racing,
    fontSize: 56,
    lineHeight: 56 * 0.95,        // 53.2 — tight for big display
    letterSpacing: -1,             // ≈ -0.02em at 56px
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  title: {
    fontFamily: fonts.racing,
    fontSize: 32,
    lineHeight: 32 * 1.05,
    letterSpacing: -0.32,          // ≈ -0.01em at 32px
  } satisfies TextStyle,

  lead: {
    fontFamily: fonts.racingSemiBold,
    fontSize: 22,
    lineHeight: 22 * 1.20,
    letterSpacing: -0.11,          // ≈ -0.005em at 22px
  } satisfies TextStyle,

  body: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 15 * 1.50,
  } satisfies TextStyle,

  caption: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 13 * 1.40,
  } satisfies TextStyle,

  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 2.64,           // 0.24em @ 11px
    textTransform: 'uppercase',
    fontWeight: '800',
  } satisfies TextStyle,

  micro: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: 2.88,           // 0.32em @ 9px
    textTransform: 'uppercase',
    fontWeight: '700',
  } satisfies TextStyle,

  // ═════════════════════════════════════════════════════════
  // TELEMETRY — numbers only, always tabular-nums
  // ═════════════════════════════════════════════════════════

  /** Final time on result screens. */
  timerHero: {
    fontFamily: fonts.racing,
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -0.56,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** Widget-size time (cards, list rows). */
  timerWidget: {
    fontFamily: fonts.racing,
    fontSize: 28,
    lineHeight: 28,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** Split times under elevation profile gates. */
  timerSplit: {
    fontFamily: fonts.racing,
    fontSize: 26,
    lineHeight: 26,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** ±X.XX delta — PB / split delta. */
  delta: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 18,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** Leaderboard hero rank — "07" big mode. */
  positionRank: {
    fontFamily: fonts.racing,
    fontSize: 88,
    lineHeight: 88 * 0.85,
    letterSpacing: -3.52,          // ≈ -0.04em at 88px
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  // ═════════════════════════════════════════════════════════
  // BACKWARD-COMPAT ALIASES
  // Older code reads typography.timeHero / .h1 / .label / etc.
  // Map them to the new scale so we don't break call sites in
  // a single drop. New code should reach for the canonical
  // names above.
  // ═════════════════════════════════════════════════════════

  /** @deprecated use `typography.hero` */
  timeHero: {
    fontFamily: fonts.racing,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.timerWidget` */
  timeLarge: {
    fontFamily: fonts.racing,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 1.5,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.timerWidget` */
  timeMedium: {
    fontFamily: fonts.racing,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.timerSplit` */
  timeSmall: {
    fontFamily: fonts.racing,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.positionRank` */
  positionHero: {
    fontFamily: fonts.racing,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.title` */
  positionLarge: {
    fontFamily: fonts.racing,
    fontSize: 32,
    lineHeight: 38,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,

  /** @deprecated use `typography.title` */
  h1: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    lineHeight: 34,
  } satisfies TextStyle,

  /** @deprecated use `typography.lead` */
  h2: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 28,
  } satisfies TextStyle,

  /** @deprecated use `typography.lead` */
  h3: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 24,
  } satisfies TextStyle,

  /** @deprecated use `typography.caption` */
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,

  /** @deprecated use `typography.label` */
  labelSmall: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  /** CTA — Rajdhani heavy, used by primary buttons. */
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.5,
  } satisfies TextStyle,

  /** Form input — Inter for humanist body feel; full Polish coverage. */
  input: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
} as const;
