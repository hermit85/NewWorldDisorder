import { TextStyle } from 'react-native';

// Font families — loaded via expo-font
export const fonts = {
  racing: 'Orbitron_700Bold',
  racingLight: 'Orbitron_400Regular',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const typography = {
  // Racing numerals — for times, positions, scores
  timeHero: {
    fontFamily: fonts.racing,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: 2,
  } satisfies TextStyle,

  timeLarge: {
    fontFamily: fonts.racing,
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: 1.5,
  } satisfies TextStyle,

  timeMedium: {
    fontFamily: fonts.racing,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 1,
  } satisfies TextStyle,

  timeSmall: {
    fontFamily: fonts.racing,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0.5,
  } satisfies TextStyle,

  // Position/rank numbers
  positionHero: {
    fontFamily: fonts.racing,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 0,
  } satisfies TextStyle,

  positionLarge: {
    fontFamily: fonts.racing,
    fontSize: 32,
    lineHeight: 38,
  } satisfies TextStyle,

  // Headings
  h1: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    lineHeight: 34,
  } satisfies TextStyle,

  h2: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 28,
  } satisfies TextStyle,

  h3: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 18,
    lineHeight: 24,
  } satisfies TextStyle,

  // Body
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,

  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,

  // Labels
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  labelSmall: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  // CTA
  cta: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0.5,
  } satisfies TextStyle,

  // Form input — ALWAYS Inter, never Orbitron.
  // Orbitron (Google Fonts build) is missing the Polish Latin Extended
  // characters (ą ć ę ł ń ś ź ż + caps) except for ó/Ó. An Orbitron-styled
  // TextInput will render "Gałgan" as "Ga¬gan" on some iOS renderers
  // because the missing-glyph fallback is not consistent.
  // Reference `typography.input` from every TextInput to guarantee
  // Polish support without per-screen awareness.
  input: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
} as const;
