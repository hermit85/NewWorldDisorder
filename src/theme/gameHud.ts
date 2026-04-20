// ═══════════════════════════════════════════════════════════
// Game HUD design tokens — recording + trail-create polish layer.
// Sprint 3 Chunk 4 design pass. Sprint 3.5 full design system
// will promote a larger share of these tokens upstream.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, type TextStyle } from 'react-native';

export const hudColors = {
  // Ambient gradients (dark-terrain base)
  terrainDark: '#0A0F0A',
  terrainMid:  '#0F1A12',
  terrainHigh: '#14231A',

  // Timer / displays
  timerPrimary: '#E8FFF0',
  timerGlow:    'rgba(0, 255, 140, 0.4)',

  // Status indicators (GPS strength)
  gpsStrong: '#00FF8C',
  gpsMedium: '#FFD93D',
  gpsWeak:   '#FF4365',
  gpsMuted:  'rgba(255, 255, 255, 0.18)',

  // Difficulty semantic
  diffEasy:   '#00FF8C',
  diffMedium: '#FFD93D',
  diffHard:   '#FF8C2B',
  diffExpert: '#FF4365',

  // Action
  actionPrimary:   '#00FF8C',
  actionPressed:   '#00CC70',
  actionDanger:    '#FF4365',
  actionDangerBg:  'rgba(255, 67, 101, 0.15)',

  // Text
  textMuted: 'rgba(232, 255, 240, 0.55)',

  // Sprint 4 — Trust badges (ADR-012)
  // Semantic aliases so TrustBadge doesn't piggy-back on GPS colors.
  // If the palette shifts later only these tokens move.
  trustVerified:           '#00FF8C',   // any seed + verified
  trustCuratorProvisional: '#FFD93D',   // curator seed, not yet confirmed
  trustRiderProvisional:   '#4AA5FF',   // rider seed, not yet confirmed
  trustDisputed:           '#FF4365',   // disputed — leaderboard frozen

  // Pioneer mark (lightning bolt identity, independent of trust tier)
  pioneerMark: '#00FF8C',
} as const;

// ADR-011: display font is Rajdhani (was Orbitron). Orbitron's
// Google Fonts build was missing every Polish diacritic except ó/Ó,
// so labels like "ZAKOŃCZ" / "KALIBRACJĘ" / "PIERWSZĄ" / "ODRZUĆ"
// rendered with iOS fallback glyphs ("¬" on some devices). Rajdhani
// has full Latin Extended-A coverage and a similar sci-fi/tech feel.
// All four weights (400/500/600/700) are loaded in app/_layout.tsx.
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

  // Form input style inside HUD screens — Inter, guaranteed Polish.
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
