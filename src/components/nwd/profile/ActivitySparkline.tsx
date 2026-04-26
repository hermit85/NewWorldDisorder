// ═══════════════════════════════════════════════════════════
// ActivitySparkline — 30-day bar chart of rider activity.
//
// One bar per day, height proportional to runs/zjazdy that day.
// Bars over the median get accent color; today's bar pulses if
// rider already rode today (engagement hook). Empty days render
// as a 1px hairline at the baseline so the rider can see the
// pattern of break days vs ride days.
//
// The data layer owns aggregation; this primitive expects an
// already-bucketed counts array (oldest first → newest last).
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface ActivitySparklineProps {
  /** Daily run counts, oldest first → newest last. Length determines
   *  bar count; default brief is 30 days. */
  counts: number[];
  /** Total label, e.g. "47 zjazdów · 30 dni". Optional. */
  totalLabel?: string;
  /** Mark today's bar (last bar) as live-pulsing if rider rode today. */
  todayActive?: boolean;
  /** Override max bar height in px. Default 56. */
  maxHeight?: number;
}

export function ActivitySparkline({
  counts,
  totalLabel,
  todayActive,
  maxHeight = 56,
}: ActivitySparklineProps) {
  if (counts.length === 0) return null;
  const peak = Math.max(...counts, 1);
  // Median used as the accent threshold — riders see "above-median
  // days" as their high-effort streak
  const sorted = [...counts].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  return (
    <View style={styles.root}>
      <View style={styles.label}>
        <Text style={styles.kicker}>AKTYWNOŚĆ · {counts.length} DNI</Text>
        {totalLabel ? <Text style={styles.total}>{totalLabel}</Text> : null}
      </View>

      <View style={[styles.chart, { height: maxHeight }]}>
        {counts.map((c, i) => {
          const isToday = i === counts.length - 1;
          const isAboveMedian = c > median;
          const heightPct = c === 0 ? 0 : Math.max((c / peak) * 100, 6);
          const isEmpty = c === 0;
          return (
            <View
              key={i}
              style={[
                styles.barSlot,
                {
                  height: maxHeight,
                },
              ]}
            >
              {isEmpty ? (
                <View style={styles.emptyBar} />
              ) : (
                <View
                  style={[
                    styles.bar,
                    {
                      height: `${heightPct}%`,
                      backgroundColor: isAboveMedian
                        ? colors.accent
                        : colors.textSecondary,
                    },
                    isToday && todayActive && styles.barToday,
                  ]}
                />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  label: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  total: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barSlot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: 1,
    minHeight: 2,
  },
  barToday: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyBar: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-end',
  },
});
