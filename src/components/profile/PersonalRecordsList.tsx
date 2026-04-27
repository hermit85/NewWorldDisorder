// ─────────────────────────────────────────────────────────────
// PersonalRecordsList — REKORDY OSOBISTE block.
//
// One row per trail where the rider holds a PB. Sorted upstream
// (ranked first, then by PB time). Each row is tappable and
// pushes to the trail ranking screen so the rider can defend or
// improve. Empty state stays truthful: "Pierwszy czysty zjazd
// zapisze Twój rekord."
// ─────────────────────────────────────────────────────────────

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { formatTimeShort } from '@/content/copy';
import type { PassportRecord } from '@/features/profile/passport';

export interface PersonalRecordsListProps {
  records: PassportRecord[];
  onRecordPress: (record: PassportRecord) => void;
}

const PODIUM_COLOR: Record<number, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

export function PersonalRecordsList({ records, onRecordPress }: PersonalRecordsListProps) {
  if (records.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyBody}>
          Pierwszy czysty zjazd zapisze Twój rekord.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {records.map((record) => {
        const podiumColor =
          record.position != null ? PODIUM_COLOR[record.position] ?? null : null;
        return (
          <Pressable
            key={record.trailId}
            onPress={() => onRecordPress(record)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.left}>
              <Text style={styles.trail} numberOfLines={1}>
                {record.trailName.toUpperCase()}
              </Text>
              <Text style={styles.spot} numberOfLines={1}>
                {record.spotName.toUpperCase()}
              </Text>
            </View>
            <View style={styles.right}>
              <Text style={[styles.time, podiumColor ? { color: podiumColor } : null]}>
                {formatTimeShort(record.pbMs)}
              </Text>
              {record.position != null ? (
                <Text
                  style={[
                    styles.position,
                    podiumColor ? { color: podiumColor } : null,
                  ]}
                >
                  #{record.position}
                </Text>
              ) : (
                <Text style={[styles.position, styles.positionMuted]}>—</Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 12,
  },
  rowPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  left: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trail: {
    fontFamily: fonts.racing,
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  spot: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
  right: {
    alignItems: 'flex-end',
    gap: 2,
  },
  time: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  position: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.4,
  },
  positionMuted: {
    color: colors.textTertiary,
  },
  emptyCard: {
    paddingHorizontal: 16,
    paddingVertical: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  emptyBody: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
