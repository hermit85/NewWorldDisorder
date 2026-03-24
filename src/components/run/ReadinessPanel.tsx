import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { PreRunReadiness } from '@/data/verificationTypes';

interface Props {
  readiness: PreRunReadiness;
  onStartPractice?: () => void;
  onRetryGps?: () => void;
  onBack?: () => void;
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

export function ReadinessPanel({ readiness, onStartPractice, onRetryGps, onBack }: Props) {
  const statusColor = statusColors[readiness.status] ?? colors.textSecondary;
  const gpsInfo = gpsLabels[readiness.gps.readiness] ?? gpsLabels.locking;

  // Determine if we're in a blocked/degraded state where fallback actions help
  const showPracticeFallback = !readiness.rankedEligible && readiness.status !== 'gps_locking';
  const isLocationMismatch = readiness.distanceToStartM !== null && readiness.distanceToStartM > 5000;

  return (
    <View style={styles.container}>
      {/* GPS indicator */}
      <View style={styles.gpsRow}>
        <View style={[styles.gpsDot, { backgroundColor: gpsInfo.color }]} />
        <Text style={[styles.gpsLabel, { color: gpsInfo.color }]}>
          GPS {gpsInfo.label}
        </Text>
        {readiness.gps.accuracy != null && readiness.gps.readiness !== 'unavailable' && (
          <Text style={styles.gpsAccuracy}>
            ±{Math.round(readiness.gps.accuracy)}m
          </Text>
        )}
      </View>

      {/* Status message */}
      <Text style={[styles.statusMessage, { color: statusColor }]}>
        {readiness.message}
      </Text>

      {/* Location mismatch hint */}
      {isLocationMismatch && (
        <Text style={styles.hintText}>
          Make sure you're at Słotwiny Arena, or start a practice run from anywhere.
        </Text>
      )}

      {/* Mode indicator */}
      <View style={styles.modeRow}>
        {readiness.rankedEligible ? (
          <View style={styles.rankedBadge}>
            <Text style={styles.rankedText}>✓ RANKED ELIGIBLE</Text>
          </View>
        ) : (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceText}>PRACTICE MODE</Text>
          </View>
        )}
      </View>

      {/* Fallback actions — never leave the user trapped */}
      {showPracticeFallback && (onStartPractice || onBack) && (
        <View style={styles.fallbackRow}>
          {onStartPractice && (
            <Pressable style={styles.fallbackBtn} onPress={onStartPractice}>
              <Text style={styles.fallbackBtnText}>START PRACTICE</Text>
            </Pressable>
          )}
          {onBack && (
            <Pressable style={styles.fallbackBtnGhost} onPress={onBack}>
              <Text style={styles.fallbackGhostText}>BACK TO MAP</Text>
            </Pressable>
          )}
        </View>
      )}
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
  hintText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 12,
    lineHeight: 17,
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
  fallbackRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  fallbackBtn: {
    flex: 1,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  fallbackBtnText: {
    ...typography.labelSmall,
    color: colors.blue,
    letterSpacing: 1,
  },
  fallbackBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  fallbackGhostText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
});
