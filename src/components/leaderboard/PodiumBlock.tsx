// ─────────────────────────────────────────────────────────────
// PodiumBlock — top-3 racing board.
//
// Renders up to three rows in podium colour (gold/silver/bronze)
// with rider · time · gap-to-leader. The current user's row is
// marked with "TY" so the rider can spot themselves at a glance,
// even when scrolling fast or after a bumpy lap.
// ─────────────────────────────────────────────────────────────

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { PodiumRow } from '@/features/leaderboard/state';

export interface PodiumBlockProps {
  rows: PodiumRow[];
}

const PODIUM_COLOR: Record<number, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

export function PodiumBlock({ rows }: PodiumBlockProps) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.block}>
      {rows.map((row) => {
        const podiumColor = PODIUM_COLOR[row.rank] ?? colors.textPrimary;
        return (
          <View
            key={row.userId}
            style={[styles.row, row.isCurrentUser && styles.rowSelf]}
          >
            <Text style={[styles.rank, { color: podiumColor }]}>#{row.rank}</Text>
            <View style={styles.middle}>
              <Text
                style={[styles.rider, row.isCurrentUser && styles.riderSelf]}
                numberOfLines={1}
              >
                {row.rider}
              </Text>
              {row.isCurrentUser ? <Text style={styles.tyTag}>TY</Text> : null}
            </View>
            <Text style={[styles.time, { color: podiumColor }]}>{row.time}</Text>
            {row.gapText ? (
              <Text style={styles.gap}>{row.gapText}</Text>
            ) : (
              <Text style={[styles.gap, styles.gapEmpty]}>—</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 12,
  },
  rowSelf: {
    borderColor: colors.borderHot,
    backgroundColor: colors.accentDim,
  },
  rank: {
    fontFamily: fonts.racing,
    fontSize: 18,
    fontWeight: '800',
    width: 36,
  },
  middle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rider: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  riderSelf: {
    color: colors.accent,
  },
  tyTag: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentInk,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1.5,
  },
  time: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  gap: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.6,
    width: 52,
    textAlign: 'right',
  },
  gapEmpty: {
    color: colors.textTertiary,
  },
});
