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

const gpsLabels: Record<string, { label: string; color: string; bars: string }> = {
  unavailable: { label: 'BRAK SYGNAŁU', color: colors.red, bars: '○○○' },
  locking: { label: 'SZUKAM…', color: colors.textTertiary, bars: '◐○○' },
  weak: { label: 'SŁABY', color: colors.orange, bars: '●○○' },
  good: { label: 'GOTOWY', color: colors.accent, bars: '●●○' },
  excellent: { label: 'SILNY', color: colors.accent, bars: '●●●' },
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
        <Text style={[styles.gpsBars, { color: gpsInfo.color }]}>{gpsInfo.bars}</Text>
        <Text style={[styles.gpsLabel, { color: gpsInfo.color }]}>
          {gpsInfo.label}
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
          Ranking wymaga startu z bramki na arenie. Trening możesz jechać z dowolnego miejsca.
        </Text>
      )}

      {/* Mode indicator */}
      <View style={styles.modeRow}>
        {readiness.rankedEligible ? (
          <View style={styles.rankedBadge}>
            <Text style={styles.rankedText}>✓ RANKING DOSTĘPNY</Text>
          </View>
        ) : readiness.status !== 'gps_locking' ? (
          <View style={styles.practiceBadge}>
            <Text style={styles.practiceText}>TYLKO TRENING</Text>
          </View>
        ) : null}
      </View>

      {/* Fallback actions — never leave the user trapped */}
      {showPracticeFallback && (onStartPractice || onBack) && (
        <View style={styles.fallbackRow}>
          {onStartPractice && (
            <Pressable style={styles.fallbackBtn} onPress={onStartPractice}>
              <Text style={styles.fallbackBtnText}>JEDŹ TRENING</Text>
            </Pressable>
          )}
          {onBack && (
            <Pressable style={styles.fallbackBtnGhost} onPress={onBack}>
              <Text style={styles.fallbackGhostText}>WRÓĆ</Text>
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
  gpsBars: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2,
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
