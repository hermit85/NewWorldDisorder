// ═══════════════════════════════════════════════════════════
// Brand Ye Brutalist — design tokens (ADR-013).
//
// Typography:
//   - display = Newsreader (serif) for brand + hero + times
//   - utility = JetBrains Mono for labels/stats/metadata
//   - zero sans-serif in new system
//
// Color rules:
//   - black dominates; bone cream (#F0EBE0) is primary text
//   - emerald #00C26E is THE signal (live/PB/XP/pioneer) — <5% of screen
//   - trust tiers: desaturated amber/blue/green/red
//
// Legacy surface: old `hudColors.gpsStrong` / `hudTypography.displayLarge`
// callers still compile. Flat keys are aliased to the new nested tokens
// so un-rewritten screens pick up the new palette + serif fonts
// automatically. Remove the legacy block once all screens are on
// `hudColors.text.*` / `hudType.*`.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, type TextStyle } from 'react-native';

// ── Canonical palette ─────────────────────────────────────

const SURFACE = {
  base:     '#0A0A0A',
  elevated: '#141414',
  subtle:   '#1A1A1A',
  border:   '#2A2A2A',
} as const;

const TEXT = {
  primary:   '#F0EBE0',
  secondary: '#7A7A7A',
  muted:     '#4A4A4A',
  inverse:   '#0A0A0A',
} as const;

const SIGNAL       = '#00C26E';
const SIGNAL_MUTED = 'rgba(0, 194, 110, 0.06)';
const SIGNAL_GLOW  = 'rgba(0, 194, 110, 0.25)';

const TRUST = {
  curator:  '#C8A838',
  rider:    '#5088C8',
  verified: '#5AA870',
  disputed: '#B84848',
} as const;

const DIFF = {
  easy:   '#5AA870',
  medium: '#C8A838',
  hard:   '#C8762B',
  expert: '#B84848',
} as const;

// ── hudColors (canonical + legacy aliases) ────────────────

export const hudColors = {
  surface: SURFACE,
  text:    TEXT,
  signal:       SIGNAL,
  signalMuted:  SIGNAL_MUTED,
  signalGlow:   SIGNAL_GLOW,
  trust: TRUST,

  // Legacy flat keys — DEPRECATED. Migrate callers to nested tokens.
  terrainDark: SURFACE.base,
  terrainMid:  SURFACE.elevated,
  terrainHigh: SURFACE.subtle,
  timerPrimary: TEXT.primary,
  timerGlow:    SIGNAL_GLOW,
  gpsStrong: SIGNAL,
  gpsMedium: TRUST.curator,
  gpsWeak:   TRUST.disputed,
  gpsMuted:  'rgba(240, 235, 224, 0.18)',
  diffEasy:   DIFF.easy,
  diffMedium: DIFF.medium,
  diffHard:   DIFF.hard,
  diffExpert: DIFF.expert,
  actionPrimary:   SIGNAL,
  actionPressed:   '#00A057',
  actionDanger:    TRUST.disputed,
  actionDangerBg:  'rgba(184, 72, 72, 0.12)',
  textMuted: TEXT.secondary,
  trustVerified:           TRUST.verified,
  trustCuratorProvisional: TRUST.curator,
  trustRiderProvisional:   TRUST.rider,
  trustDisputed:           TRUST.disputed,
  pioneerMark:             SIGNAL,
  statusInfo:    TRUST.rider,
  statusWarning: TRUST.curator,
  statusSuccess: TRUST.verified,
  statusDanger:  TRUST.disputed,
} as const;

// ── Spacing scale ─────────────────────────────────────────

export const hudSpacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32,
  huge: 40, mega: 48, massive: 56, giant: 64,
} as const;

// ── Typography ────────────────────────────────────────────

const FONT_DISPLAY_REGULAR = 'Newsreader_400Regular';
const FONT_DISPLAY_MEDIUM  = 'Newsreader_500Medium';
const FONT_MONO_REGULAR    = 'JetBrainsMono_400Regular';
const FONT_MONO_MEDIUM     = 'JetBrainsMono_500Medium';

export const hudType = {
  heroRider: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 56, letterSpacing: 0, lineHeight: 56,
  } satisfies TextStyle,
  heroTrail: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 64, letterSpacing: 0, lineHeight: 62,
  } satisfies TextStyle,
  heroTime: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 72, letterSpacing: -1,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  heroTimeBig: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 96, letterSpacing: -2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  heroTimeMega: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 112, letterSpacing: -3,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  heroCopy: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 40, letterSpacing: 0.3, lineHeight: 44,
  } satisfies TextStyle,
  displayMd: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 28, letterSpacing: 0.3, lineHeight: 32,
  } satisfies TextStyle,
  displaySm: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 22, letterSpacing: 0.3, lineHeight: 26,
  } satisfies TextStyle,
  displayXs: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 17, letterSpacing: 0.3, lineHeight: 22,
  } satisfies TextStyle,
  navLabel: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 10, letterSpacing: 2,
  } satisfies TextStyle,
  label: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 10, letterSpacing: 3,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,
  labelSm: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 9, letterSpacing: 2,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,
  stat: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 11, letterSpacing: 1,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  statLg: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 13, letterSpacing: 1,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  body: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 11, letterSpacing: 1,
  } satisfies TextStyle,
  caption: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 10, letterSpacing: 1,
  } satisfies TextStyle,
  captionSm: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 9, letterSpacing: 2,
  } satisfies TextStyle,
} as const;

// Legacy shim — pre-ADR-013 imports keep working.
export const hudTypography = {
  displayHuge:      hudType.heroTimeMega,
  displayLarge:     hudType.heroRider,
  displayCountdown: {
    fontFamily: FONT_DISPLAY_REGULAR, fontSize: 180, letterSpacing: 0, lineHeight: 180,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  } satisfies TextStyle,
  label:      hudType.label,
  labelSmall: hudType.labelSm,
  action: {
    fontFamily: FONT_MONO_MEDIUM, fontSize: 13, letterSpacing: 3,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,
  input: {
    fontFamily: FONT_MONO_REGULAR, fontSize: 16, lineHeight: 22,
  } satisfies TextStyle,
} as const;

// ── Shadows ───────────────────────────────────────────────
// Brutalist direction drops glows. Empty objects keep pre-existing
// `...hudShadows.glowGreen` spreads compiling as no-ops.
export const hudShadows = StyleSheet.create({
  glowGreen: {},
  glowRed:   {},
  glowTimer: {},
});

export const HUD_FONTS = {
  displayRegular: FONT_DISPLAY_REGULAR,
  displayMedium:  FONT_DISPLAY_MEDIUM,
  monoRegular:    FONT_MONO_REGULAR,
  monoMedium:     FONT_MONO_MEDIUM,
} as const;
