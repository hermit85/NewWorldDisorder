// ─────────────────────────────────────────────────────────────
// DorobekGrid — four-card permanent-record grid.
//
// JA's "co zdobyłem na zawsze" block. Each card is a chunky
// number with a small mono label. Tone:
//   - PIONIER TRAS / REKORDY PB → gold (rare, hard-earned)
//   - BIKE PARKI / PASSA        → green (active progress)
//
// Cards stay quiet when value === 0 (textPrimary stays bright,
// but the gold/green accent fades to muted) so a fresh rider
// doesn't see four blank "achievements".
// ─────────────────────────────────────────────────────────────

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type DorobekTone = 'gold' | 'green';

export interface DorobekStat {
  label: string;
  value: string | number;
  /** Optional small caption under the number (e.g. "dni"). */
  unit?: string;
  tone: DorobekTone;
}

export interface DorobekGridProps {
  stats: DorobekStat[];
}

const TONE_COLOR: Record<DorobekTone, string> = {
  gold: colors.gold,
  green: colors.accent,
};

export function DorobekGrid({ stats }: DorobekGridProps) {
  return (
    <View style={styles.grid}>
      {stats.map((stat) => {
        const isZero = stat.value === 0 || stat.value === '0';
        const valueColor = isZero ? colors.textTertiary : TONE_COLOR[stat.tone];
        return (
          <View key={stat.label} style={styles.card}>
            <Text style={styles.label} numberOfLines={1}>
              {stat.label}
            </Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
                {stat.value}
              </Text>
              {stat.unit ? <Text style={styles.unit}>{stat.unit}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    gap: 8,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  value: {
    fontFamily: fonts.racing,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  unit: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
});
