import { TextStyle } from 'react-native';

// Font families — loaded via expo-font
// Post-ADR-013 (Ye brutalist): Rajdhani + Inter out, Newsreader serif +
// JetBrains Mono in. Keys kept stable for callers; 'racing'/'body'
// semantics transform — 'racing' is now serif display (hero/times),
// 'body' is monospace. Consumers styled with old 'racing' automatically
// pick up the new serif face.
export const fonts = {
  racing:       'Newsreader_400Regular',
  racingLight:  'Newsreader_400Regular',
  body:         'JetBrainsMono_400Regular',
  bodyMedium:   'JetBrainsMono_400Regular',
  bodySemiBold: 'JetBrainsMono_500Medium',
  bodyBold:     'JetBrainsMono_500Medium',
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

  // Form input — Inter-only, never a display font. Inter has full
  // Polish coverage. The display font is now Rajdhani (ADR-011) which
  // also covers Polish, but inputs still route through Inter for the
  // softer humanist look that reads better at body sizes on iOS.
  input: {
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 22,
  } satisfies TextStyle,
} as const;
