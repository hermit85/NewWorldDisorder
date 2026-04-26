// ═══════════════════════════════════════════════════════════
// StreakCard — slide 03 streak block.
//
// Big "7" + DNI Z RZĘDU label on the left, 7 horizontal dots
// (last one ARMED via LiveDot) on the right. Outer accent glow
// + 1px accent border @ 0.35.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '../_components/LiveDot';

export interface StreakCardProps {
  days: number;
  totalDays?: number;
}

export const StreakCard = memo(function StreakCard({
  days,
  totalDays = 7,
}: StreakCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.bigNumber}>{days}</Text>
        <View style={styles.copyBlock}>
          <Text style={styles.label}>DNI Z RZĘDU</Text>
          <Text style={styles.body}>Zjedź dziś, żeby utrzymać.</Text>
        </View>
      </View>

      <View style={styles.dotsRow}>
        {Array.from({ length: totalDays }, (_, i) => {
          const isLast = i === totalDays - 1;
          const filled = i < days;
          if (isLast && filled) {
            return <LiveDot key={i} size={5} />;
          }
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.35)',
    backgroundColor: colors.panel,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // Outer accent glow per v8 spec.
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bigNumber: {
    fontFamily: fonts.racing,
    fontSize: 44,
    lineHeight: 48,
    letterSpacing: -1,
    color: colors.accent,
  },
  copyBlock: {
    gap: 2,
    flex: 1,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.4,
    color: colors.accent,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textTertiary,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotFilled: {
    backgroundColor: colors.accent,
  },
  dotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
