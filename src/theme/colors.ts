export const colors = {
  // Base
  bg: '#0A0A0F',
  bgCard: '#14141C',
  bgElevated: '#1C1C28',
  bgOverlay: 'rgba(10, 10, 15, 0.85)',

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
  textSecondary: '#8E8E9A',
  textTertiary: '#5A5A6A',
  textAccent: '#00FF88',

  // Borders
  border: '#2A2A38',
  borderLight: '#3A3A4A',

  // Rank colors
  rankRookie: '#8E8E9A',
  rankRider: '#007AFF',
  rankHunter: '#FF9500',
  rankSlayer: '#FF3B30',
  rankApex: '#FFD700',
  rankLegend: '#00FF88',

  // Difficulty
  diffEasy: '#00FF88',
  diffMedium: '#FF9500',
  diffHard: '#FF3B30',
  diffExpert: '#FF3B30',
  diffPro: '#FFD700',
} as const;

export type ColorKey = keyof typeof colors;
