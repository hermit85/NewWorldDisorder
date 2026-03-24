import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { PreRunReadiness } from '@/data/verificationTypes';

interface Props {
  readiness: PreRunReadiness;
}

const statusColors: Record<string, string> = {
  gps_locking: colors.textTertiary,
  weak_signal: colors.orange,
  move_to_start: colors.textSecondary,
  ranked_ready: colors.accent,
  practice_only: colors.blue,
  start_gate_reached: colors.accent,
};

const gpsLabels: Record<string, { label: string; color: string }> = {
  unavailable: { label: 'NO GPS', color: colors.red },
  locking: { label: 'LOCKING', color: colors.textTertiary },
  weak: { label: 'WEAK', color: colors.orange },
  good: { label: 'GOOD', color: colors.accent },
  excellent: { label: 'STRONG', color: colors.accent },
};

export function ReadinessPanel({ readiness }: Props) {
  const statusColor = statusColors[readiness.status] ?? colors.textSecondary;
  const gpsInfo = gpsLabels[readiness.gps.readiness] ?? gpsLabels.locking;

  return (
    <View style={styles.container}>
      {/* GPS indicator */}
      <View style={styles.gpsRow}>
        <View style={[styles.gpsDot, { backgroundColor: gpsInfo.color }]} />
        <Text style={[styles.gpsLabel, { color: gpsInfo.color }]}>
          GPS {gpsInfo.label}
        </Text>
        {readiness.gps.accuracy != null && (
          <Text style={styles.gpsAccuracy}>
            ±{Math.round(readiness.gps.accuracy)}m
          </Text>
        )}
      </View>

      {/* Status message */}
      <Text style={[styles.statusMessage, { color: statusColor }]}>
        {readiness.message}
      </Text>

      {/* Mode indicator */}
      <View style={styles.modeRow}>
        {readiness.rankedEligible ? (
          <View style={styles.rankedBadge}>
            <Text style={styles.rankedText}>RANKED ELIGIBLE</Text>
          </View>
        ) : (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceText}>PRACTICE MODE</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  gpsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  gpsLabel: {
    ...typography.labelSmall,
    letterSpacing: 2,
  },
  gpsAccuracy: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginLeft: 'auto',
  },
  statusMessage: {
    ...typography.body,
    fontFamily: 'Inter_600SemiBold',
  },
  modeRow: {
    flexDirection: 'row',
  },
  rankedBadge: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  rankedText: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 2,
  },
  practiceBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  practiceText: {
    ...typography.labelSmall,
    color: colors.blue,
    letterSpacing: 2,
  },
});
