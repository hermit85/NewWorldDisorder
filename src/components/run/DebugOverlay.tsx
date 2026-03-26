// Field-test debug overlay — shows GPS state, trace info, checkpoint status
// Toggle with triple-tap on trail name during run

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { RealRunState } from '@/systems/useRealRun';

interface Props {
  state: RealRunState;
}

export function DebugOverlay({ state }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.header}>DEBUG</Text>

      <Row label="Phase" value={state.phase} />
      <Row label="Mode" value={state.mode} />
      <Row
        label="GPS"
        value={`${state.gps.readiness} ±${state.gps.accuracy?.toFixed(0) ?? '?'}m`}
        color={state.gps.readiness === 'good' || state.gps.readiness === 'excellent'
          ? colors.accent : state.gps.readiness === 'weak' ? colors.orange : colors.red}
      />
      <Row label="Points" value={String(state.pointCount)} />
      <Row
        label="Last pos"
        value={state.lastPoint
          ? `${state.lastPoint.latitude.toFixed(5)}, ${state.lastPoint.longitude.toFixed(5)}`
          : 'none'}
      />
      <Row
        label="Start gate"
        value={state.readiness.inStartGate ? 'IN ZONE' : `${state.readiness.distanceToStartM?.toFixed(0) ?? '?'}m away`}
        color={state.readiness.inStartGate ? colors.accent : colors.orange}
      />

      {/* Checkpoints */}
      <Text style={styles.subHeader}>CHECKPOINTS</Text>
      {state.checkpoints.map((cp) => (
        <Row
          key={cp.id}
          label={cp.label}
          value={cp.passed ? '✓ PASSED' : '○ pending'}
          color={cp.passed ? colors.accent : colors.textTertiary}
        />
      ))}

      {/* Gate Engine v2 */}
      <Text style={styles.subHeader}>GATE ENGINE</Text>
      <Row label="Auto-start" value={state.gateAutoStarted ? '✓ YES' : '○ manual'} color={state.gateAutoStarted ? colors.accent : colors.textTertiary} />
      <Row label="Auto-finish" value={state.gateAutoFinished ? '✓ YES' : '○ no'} color={state.gateAutoFinished ? colors.accent : colors.textTertiary} />
      <Row label="Heading" value={state.gateHeadingDeg !== null ? `${Math.round(state.gateHeadingDeg)}°` : 'n/a'} />
      <Row label="Δ heading" value={state.gateHeadingDeltaDeg !== null ? `${Math.round(state.gateHeadingDeltaDeg)}° off trail` : 'n/a'}
        color={state.gateHeadingDeltaDeg !== null ? (state.gateHeadingDeltaDeg < 60 ? colors.accent : state.gateHeadingDeltaDeg < 90 ? colors.orange : colors.red) : undefined} />
      <Row label="Speed" value={state.gateSpeedKmh !== null ? `${state.gateSpeedKmh.toFixed(1)} km/h` : 'n/a'} />
      <Row label="Distance" value={`${Math.round(state.gateTotalDistanceM)}m`} />
      <Row label="→ Start" value={state.gateDistToStartM !== null ? `${state.gateDistToStartM.toFixed(0)}m ${state.gateDistToStartM > 0 ? 'BEFORE' : 'PAST'}` : 'n/a'}
        color={state.gateDistToStartM !== null ? (Math.abs(state.gateDistToStartM) < 15 ? colors.accent : colors.textTertiary) : undefined} />
      <Row label="→ Finish" value={state.gateDistToFinishM !== null ? `${state.gateDistToFinishM.toFixed(0)}m ${state.gateDistToFinishM > 0 ? 'BEFORE' : 'PAST'}` : 'n/a'}
        color={state.gateDistToFinishM !== null ? (Math.abs(state.gateDistToFinishM) < 25 ? colors.accent : colors.textTertiary) : undefined} />
      {state.runQuality && (
        <>
          <Row label="Quality" value={state.runQuality.quality.toUpperCase()} color={
            state.runQuality.quality === 'perfect' ? colors.accent :
            state.runQuality.quality === 'valid' ? colors.blue : colors.orange
          } />
          <Row label="Eligible" value={state.runQuality.leaderboardEligible ? 'YES' : 'NO'} />
          {state.runQuality.degradationReasons.map((r, i) => (
            <Row key={`qr-${i}`} label={`Reason`} value={r} color={colors.orange} />
          ))}
        </>
      )}

      {/* Verification */}
      {state.verification && (
        <>
          <Text style={styles.subHeader}>VERIFICATION</Text>
          <Row label="Status" value={state.verification.label} />
          <Row label="Eligible" value={state.verification.isLeaderboardEligible ? 'YES' : 'NO'} />
          <Row label="Route" value={`${Math.round(state.verification.corridor.coveragePercent)}% coverage`} />
          {state.verification.issues.map((issue, i) => (
            <Row key={i} label={`Issue ${i + 1}`} value={issue} color={colors.orange} />
          ))}
        </>
      )}
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 100,
    left: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(10, 10, 15, 0.92)',
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  header: {
    ...typography.labelSmall,
    color: colors.red,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  subHeader: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xxs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  rowLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
  },
  rowValue: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
  },
});
