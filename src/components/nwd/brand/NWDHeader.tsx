// ═══════════════════════════════════════════════════════════
// NWDHeader — left brand stamp + right context slot.
//
// Right context has 3 shapes:
//   pagination   — "01 / 03" (accent / muted) for stepped flows
//   label        — single uppercase mono kicker for static screens
//   none         — empty (default)
//
// Counter is rendered as a SINGLE Text node with two children to
// stop the digit from twitching 1-2px on slide change (RN re-mounts
// adjacent <Text> siblings independently).
//
// Defaults are calibrated to match the shipped onboarding header
// 1:1 (alignItems center, brandBlock gap 2, lineHeight 22/10,
// brandSub letterSpacing 1.6) — the pagination case is bit-perfect
// with the previous app/onboarding/_components/Header.tsx.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type NWDHeaderRightContext =
  | { type: 'pagination'; current: number; total: number }
  | { type: 'label'; text: string }
  | { type: 'none' };

export interface NWDHeaderProps {
  rightContext?: NWDHeaderRightContext;
}

export const NWDHeader = memo(function NWDHeader({
  rightContext = { type: 'none' },
}: NWDHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.brandBlock}>
        <Text style={styles.brand}>NWD</Text>
        <Text style={styles.brandSub}>NEW WORLD DISORDER</Text>
      </View>

      {rightContext.type === 'pagination' && (
        <Text style={styles.counter}>
          <Text style={styles.counterCurrent}>
            {String(rightContext.current).padStart(2, '0')}
          </Text>
          <Text style={styles.counterRest}>
            {` / ${String(rightContext.total).padStart(2, '0')}`}
          </Text>
        </Text>
      )}

      {rightContext.type === 'label' && (
        <Text style={styles.label}>{rightContext.text}</Text>
      )}
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
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.6,
  },
});
