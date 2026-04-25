// ═══════════════════════════════════════════════════════════
// Game HUD design tokens — recording + trail-create polish layer.
//
// Originally Sprint 3 introduced this as a parallel namespace with
// slightly green-tinted variants of the canonical Acid palette so
// the immersive recording HUD felt like a separate "game mode".
// Sprint 4 design-system pass (per user lock-in: Acid + Rajdhani +
// Compact) flagged that as a § 02 violation — third theme reads as
// visual seam between recording and the rest of the app.
//
// This file now ALIASES the canonical tokens from `@/theme/colors`
// and `@/theme/typography`. The hud* API stays so existing consumers
// (review.tsx, recording.tsx, result.tsx, TrustBadge, PioneerBadge)
// keep compiling — but every value collapses onto the canonical
// palette. Drop sites incrementally migrate their imports to the
// canonical namespace.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, type TextStyle } from 'react-native';
import { colors } from './colors';

export const hudColors = {
  // Ambient surfaces — collapse to the canonical layered scheme.
  // bg (e0) sits behind everything; chrome (e1) for floating frames;
  // panel (e2) for cards. The "terrain*" tokens used to tint each
  // toward green; canonical is neutral dark for visual coherence.
  terrainDark: colors.bg,        // was '#0A0F0A'
  terrainMid:  colors.chrome,    // was '#0F1A12'
  terrainHigh: colors.panel,     // was '#14231A'

  // Timer / displays — canonical text, accent halo applied via
  // shadow rather than tinting the foreground green.
  timerPrimary: colors.textPrimary,         // was '#E8FFF0'
  timerGlow:    'rgba(0, 255, 135, 0.40)',  // tracks accent

  // Status indicators (GPS strength). Map directly onto the race
  // state semantics: strong=verified (accent), medium=pending
  // (warn), weak=invalid (danger). gpsMuted stays as a faint white.
  gpsStrong: colors.accent,                  // was '#00FF8C'
  gpsMedium: colors.warn,                    // was '#FFD93D'
  gpsWeak:   colors.danger,                  // was '#FF4365'
  gpsMuted:  'rgba(255, 255, 255, 0.18)',

  // Difficulty semantic — canonical 4-tone (green/blue/red/black)
  // per § 09 Track lines. The legacy hudColors had only 4 GPS-style
  // amber/orange/red so we map difficulty pretty literally.
  diffEasy:   colors.diffGreen,    // was '#00FF8C'
  diffMedium: colors.diffBlue,     // was '#FFD93D' (amber → blue per § 09)
  diffHard:   colors.diffRed,      // was '#FF8C2B'
  diffExpert: colors.diffBlack,    // was '#FF4365'

  // Action — accent fill / pressed accent / danger.
  actionPrimary:   colors.accent,                       // was '#00FF8C'
  actionPressed:   '#00CC70',                            // tighter accent on press
  actionDanger:    colors.danger,                        // was '#FF4365'
  actionDangerBg:  'rgba(255, 71, 87, 0.15)',

  // Text muted — alpha-on-text canonical.
  textMuted: colors.textSecondary,             // was 'rgba(232,255,240,0.55)'

  // Sprint 4 — Trust badges (ADR-012). Canonical aliases.
  trustVerified:           colors.accent,
  trustCuratorProvisional: colors.warn,
  trustRiderProvisional:   colors.diffBlue,
  trustDisputed:           colors.danger,

  // Pioneer mark — accent (lightning bolt identity).
  pioneerMark: colors.accent,
} as const;

// ADR-011: display font is Rajdhani (was Orbitron). Polish coverage
// requirements drove the swap. Inter for body, JetBrains-style mono
// reserved for canonical typography but absent here on purpose —
// hudTypography is display+input only.
const FONT_DISPLAY = 'Rajdhani_700Bold';
const FONT_BODY = 'Inter_500Medium';

export const hudTypography = {
  displayHuge: {
    fontFamily: FONT_DISPLAY,
    fontSize: 88,
    letterSpacing: 3,
    lineHeight: 88,
  } satisfies TextStyle,

  displayLarge: {
    fontFamily: FONT_DISPLAY,
    fontSize: 56,
    letterSpacing: 2,
  } satisfies TextStyle,

  displayCountdown: {
    fontFamily: FONT_DISPLAY,
    fontSize: 180,
    letterSpacing: 0,
    lineHeight: 180,
  } satisfies TextStyle,

  label: {
    fontFamily: FONT_DISPLAY,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,

  labelSmall: {
    fontFamily: FONT_DISPLAY,
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,

  action: {
    fontFamily: FONT_DISPLAY,
    fontSize: 24,
    letterSpacing: 4,
    textTransform: 'uppercase' as const,
  } satisfies TextStyle,

  input: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
} as const;

export const hudShadows = StyleSheet.create({
  glowGreen: {
    shadowColor: hudColors.gpsStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  glowRed: {
    shadowColor: hudColors.gpsWeak,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  glowTimer: {
    shadowColor: hudColors.gpsStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 12,
  },
});
