import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { VerificationResult } from '@/data/verificationTypes';

interface Props {
  verification: VerificationResult;
  onShowTruthMap?: () => void;
}

const statusStyle: Record<string, { color: string; bg: string; icon: string }> = {
  verified: { color: colors.accent, bg: colors.accentDim, icon: '✓' },
  practice_only: { color: colors.blue, bg: 'rgba(0, 122, 255, 0.15)', icon: '○' },
  weak_signal: { color: colors.orange, bg: 'rgba(255, 149, 0, 0.15)', icon: '!' },
  missing_checkpoint: { color: colors.orange, bg: 'rgba(255, 149, 0, 0.15)', icon: '!' },
  invalid_route: { color: colors.red, bg: colors.redDim, icon: '✕' },
  shortcut_detected: { color: colors.red, bg: colors.redDim, icon: '✕' },
  outside_start_gate: { color: colors.red, bg: colors.redDim, icon: '✕' },
  outside_finish_gate: { color: colors.red, bg: colors.redDim, icon: '✕' },
  pending: { color: colors.textTertiary, bg: colors.bgElevated, icon: '…' },
};

export function ResultVerificationStatus({ verification, onShowTruthMap }: Props) {
  const style = statusStyle[verification.status] ?? statusStyle.pending;
  const v = verification;

  return (
    <View style={styles.container}>
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: style.bg, borderColor: style.color }]}>
        <Text style={[styles.statusIcon, { color: style.color }]}>{style.icon}</Text>
        <Text style={[styles.statusLabel, { color: style.color }]}>{v.label}</Text>
      </View>

      {/* Details */}
      <View style={styles.details}>
        <Text style={styles.explanation}>{v.explanation}</Text>

        {/* Checkpoint count */}
        {v.checkpointsTotal > 0 && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>CHECKPOINTS</Text>
            <Text style={[
              styles.detailValue,
              { color: v.checkpointsPassed === v.checkpointsTotal ? colors.accent : colors.orange },
            ]}>
              {v.checkpointsPassed}/{v.checkpointsTotal}
            </Text>
          </View>
        )}

        {/* Route */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>ROUTE</Text>
          <Text style={[
            styles.detailValue,
            { color: v.routeClean ? colors.accent : colors.orange },
          ]}>
            {v.routeClean ? 'Clean' : `${Math.round(v.corridor.coveragePercent)}% coverage`}
          </Text>
        </View>

        {/* Leaderboard status */}
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>LEADERBOARD</Text>
          <Text style={[
            styles.detailValue,
            { color: v.isLeaderboardEligible ? colors.accent : colors.textTertiary },
          ]}>
            {v.isLeaderboardEligible ? 'Submitted' : 'Not counted'}
          </Text>
        </View>

        {/* Issues */}
        {v.issues.length > 0 && (
          <View style={styles.issuesList}>
            {v.issues.map((issue, i) => (
              <Text key={i} style={styles.issueText}>• {issue}</Text>
            ))}
          </View>
        )}
      </View>

      {/* Truth map link */}
      {onShowTruthMap && (
        <Pressable style={styles.truthMapBtn} onPress={onShowTruthMap}>
          <Text style={styles.truthMapBtnText}>VIEW ROUTE DETAIL</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statusIcon: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusLabel: {
    ...typography.label,
    letterSpacing: 2,
  },
  details: {
    gap: spacing.sm,
  },
  explanation: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  detailValue: {
    ...typography.bodySmall,
    fontFamily: 'Inter_600SemiBold',
  },
  issuesList: {
    marginTop: spacing.xs,
    gap: spacing.xxs,
  },
  issueText: {
    ...typography.bodySmall,
    color: colors.orange,
    fontSize: 13,
  },
  truthMapBtn: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  truthMapBtnText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
