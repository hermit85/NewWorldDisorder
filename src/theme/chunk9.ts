import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const chunk9Colors = {
  bg: {
    base: colors.chunk9BgBase,
    surface: colors.chunk9BgSurface,
    hairline: colors.chunk9BgHairline,
  },
  text: {
    primary: colors.chunk9TextPrimary,
    secondary: colors.chunk9TextSecondary,
    tertiary: colors.chunk9TextTertiary,
  },
  accent: {
    emerald: colors.chunk9AccentEmerald,
  },
} as const;

export const chunk9Typography = {
  display28: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: 0.56,
  } satisfies TextStyle,
  display56: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 56,
    lineHeight: 58,
    letterSpacing: 0,
  } satisfies TextStyle,
  label13: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    lineHeight: 15,
    letterSpacing: 2.86,
    textTransform: 'uppercase',
  } satisfies TextStyle,
  stat19: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 19,
    lineHeight: 22,
    fontVariant: ['tabular-nums'],
  } satisfies TextStyle,
  body13: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19.5,
  } satisfies TextStyle,
  captionMono10: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  } satisfies TextStyle,
} as const;

export const chunk9Spacing = {
  containerHorizontal: 20,
  sectionVertical: 18,
  cardPadding: 20,
  cardPaddingTight: 18,
  cardChildGap: 12,
  ctaHeight: 52,
  ctaFontSize: 15,
} as const;

export const chunk9Radii = {
  card: 18,
  pill: 999,
  button: 16,
} as const;
