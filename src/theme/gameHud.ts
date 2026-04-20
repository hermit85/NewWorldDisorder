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
} as const;

// Note: Orbitron_600SemiBold is not loaded in _layout.tsx (only 400 + 700).
// For semi-bold labels we fall back to 700Bold — visually identical at
// the 10–12pt sizes we use here.
const FONT_DISPLAY = 'Orbitron_700Bold';

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
