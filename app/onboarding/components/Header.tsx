// ═══════════════════════════════════════════════════════════
// Onboarding Header — left brand stamp + right page counter.
//
// Counter must render as a SINGLE Text node with two children
// (accent for "01", muted for " / 03"). Two adjacent Text
// components nudge each other 1-2px on mount and re-render,
// which makes the counter visibly twitch on slide change.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface OnboardingHeaderProps {
  pageIndex: number; // 0-based
  pageCount: number;
}

export const OnboardingHeader = memo(function OnboardingHeader({
  pageIndex,
  pageCount,
}: OnboardingHeaderProps) {
  const current = String(pageIndex + 1).padStart(2, '0');
  const total = String(pageCount).padStart(2, '0');

  return (
    <View style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>NWD</Text>
        <Text style={styles.brandSub}>NEW WORLD DISORDER</Text>
      </View>

      <Text style={styles.counter}>
        <Text style={styles.counterCurrent}>{current}</Text>
        <Text style={styles.counterRest}>{` / ${total}`}</Text>
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  brandBlock: {
    gap: 2,
  },
  brand: {
    fontFamily: fonts.racing,
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
    letterSpacing: 3,
  },
  brandSub: {
    fontFamily: fonts.mono,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.6,
    color: colors.textTertiary,
  },
  counter: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.6,
  },
  counterCurrent: {
    color: colors.accent,
    fontFamily: fonts.mono,
  },
  counterRest: {
    color: colors.textTertiary,
    fontFamily: fonts.mono,
  },
});
