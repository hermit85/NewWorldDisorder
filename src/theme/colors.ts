// ─────────────────────────────────────────────────────────────
// Contrast pass:
//   - bgCard / bgElevated nudged up so cards separate from bg
//     on real OLED iPhone screens.
//   - textSecondary / textTertiary brightened so muted labels
//     stay readable without becoming grey iOS chrome.
//   - border / borderLight raised to be visible on dark cards.
//   - mutedSurface added as the official locked/disabled fill.
// ─────────────────────────────────────────────────────────────
export const colors = {
  // Base
  bg: '#0A0A0F',
  bgCard: '#181822',
  bgElevated: '#22222F',
  bgOverlay: 'rgba(10, 10, 15, 0.85)',

  // Locked / disabled surfaces — tuned for visible-but-quiet on OLED
  mutedSurface: 'rgba(255, 255, 255, 0.05)',
  mutedBorder: 'rgba(255, 255, 255, 0.14)',

  // Primary accent — electric green (speed, PB, success)
  accent: '#00FF88',
  accentDim: 'rgba(0, 255, 136, 0.15)',
  accentGlow: 'rgba(0, 255, 136, 0.4)',

  // Secondary accents
  gold: '#FFD700',
  goldDim: 'rgba(255, 215, 0, 0.15)',
  goldGlow: 'rgba(255, 215, 0, 0.4)',

  red: '#FF3B30',
  redDim: 'rgba(255, 59, 48, 0.15)',

  orange: '#FF9500',
  blue: '#007AFF',

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#B4B4C2',
  textTertiary: '#82828F',
  textDisabled: '#5C5C68',
  textAccent: '#00FF88',

  // Borders
  border: '#34344A',
  borderLight: '#44445A',

  // Rank colors
  rankRookie: '#B4B4C2',
  rankRider: '#007AFF',
  rankSender: '#FF9500',
  rankRipper: '#FF3B30',
  rankCharger: '#FFD700',
  rankLegend: '#00FF88',

  // Difficulty
  diffEasy: '#00FF88',
  diffMedium: '#FF9500',
  diffHard: '#FF3B30',
  diffExpert: '#FF3B30',
  diffPro: '#FFD700',
} as const;

export type ColorKey = keyof typeof colors;
