// ═══════════════════════════════════════════════════════════
// Field-test debug overlay — triple-tap trail name to toggle
// Shows gate engine telemetry + post-run summary
// Designed for quick field reading, not desktop debugging
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { RealRunState } from '@/systems/useRealRun';
import { formatTime } from '@/content/copy';

interface Props {
  state: RealRunState;
}

// ── Single primary reason for rejection/downgrade ──

function getPrimaryReason(state: RealRunState): string | null {
  const q = state.runQuality;
  const v = state.verification;

  if (!q && !v) return null;

  // Quality degradation — pick most important
  if (q && q.degradationReasons.length > 0) {
    const PRIORITY: Record<string, number> = {
      suspicious_position_jump: 1,
      wrong_start_side: 2,
      finish_fallback_used: 3,
      low_checkpoint_coverage: 4,
      corridor_deviation_minor: 5,
      weak_gps_accuracy: 6,
      backgrounded_during_run: 7,
      poor_start_heading: 8,
      low_start_speed: 9,
      finish_wrong_side: 10,
    };
    const sorted = [...q.degradationReasons].sort(
      (a, b) => (PRIORITY[a] ?? 99) - (PRIORITY[b] ?? 99)
    );
    return REASON_LABELS[sorted[0]] ?? sorted[0];
  }

  // Legacy verification issues
  if (v && v.issues.length > 0) {
    return v.issues[0];
  }

  return null;
}

const REASON_LABELS: Record<string, string> = {
  suspicious_position_jump: 'GPS jump detected',
  wrong_start_side: 'Wrong start side',
  finish_fallback_used: 'Finish fallback used',
  low_checkpoint_coverage: 'Checkpoints missed',
  corridor_deviation_minor: 'Off-corridor',
  weak_gps_accuracy: 'Weak GPS signal',
  backgrounded_during_run: 'App backgrounded',
  poor_start_heading: 'Start heading off',
  low_start_speed: 'Low start speed',
  finish_wrong_side: 'Finish wrong side',
};

// ── Phase label mapping ──

function phaseTag(phase: string): { label: string; color: string } {
  switch (phase) {
    case 'idle': return { label: 'IDLE', color: colors.textTertiary };
    case 'readiness_check': return { label: 'CHECK', color: colors.blue };
    case 'armed_ranked': return { label: 'ARMED ▲', color: colors.accent };
    case 'armed_practice': return { label: 'ARMED ○', color: colors.blue };
    case 'running_ranked': return { label: 'RUN ▲', color: colors.accent };
    case 'running_practice': return { label: 'RUN ○', color: colors.blue };
    case 'finishing': return { label: 'FINISH', color: colors.gold };
    case 'verifying': return { label: 'VERIFY', color: colors.gold };
    case 'completed_verified': return { label: 'DONE ✓', color: colors.accent };
    case 'completed_unverified': return { label: 'DONE ○', color: colors.blue };
    case 'invalidated': return { label: 'FAIL ✕', color: colors.red };
    default: return { label: phase, color: colors.textTertiary };
  }
}

export function DebugOverlay({ state }: Props) {
  const phase = phaseTag(state.phase);
  const isRunning = state.phase === 'running_ranked' || state.phase === 'running_practice';
  const isArmed = state.phase === 'armed_ranked' || state.phase === 'armed_practice';
  const isDone = state.phase.startsWith('completed') || state.phase === 'invalidated';
  const cpPassed = state.checkpoints.filter(c => c.passed).length;
  const cpTotal = state.checkpoints.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── STATUS BAR ── */}
      <View style={styles.statusBar}>
        <Text style={[styles.phaseTag, { color: phase.color, borderColor: phase.color }]}>
          {phase.label}
        </Text>
        <Text style={styles.gpsTag}>
          GPS {state.gps.readiness === 'excellent' ? '●●●' :
               state.gps.readiness === 'good' ? '●●○' :
               state.gps.readiness === 'weak' ? '●○○' : '○○○'}
          {state.gps.accuracy !== null ? ` ±${state.gps.accuracy.toFixed(0)}m` : ''}
        </Text>
      </View>

      {/* ── LIVE TELEMETRY (during run / armed) ── */}
      {(isRunning || isArmed) && (
        <View style={styles.section}>
          <View style={styles.grid}>
            <Cell label="SPD" value={state.gateSpeedKmh !== null ? `${state.gateSpeedKmh.toFixed(0)}` : '—'} unit="km/h" />
            <Cell label="HDG" value={state.gateHeadingDeg !== null ? `${Math.round(state.gateHeadingDeg)}` : '—'} unit="°" />
            <Cell label="Δ HDG" value={state.gateHeadingDeltaDeg !== null ? `${Math.round(state.gateHeadingDeltaDeg)}` : '—'} unit="°"
              color={state.gateHeadingDeltaDeg !== null ? (state.gateHeadingDeltaDeg < 60 ? colors.accent : state.gateHeadingDeltaDeg < 90 ? colors.orange : colors.red) : undefined} />
            <Cell label="DIST" value={`${Math.round(state.gateTotalDistanceM)}`} unit="m" />
          </View>

          <View style={styles.gateRow}>
            <GateCell
              label="START"
              distM={state.gateDistToStartM}
              crossed={state.gateAutoStarted}
              fallback={false}
            />
            <GateCell
              label="FINISH"
              distM={state.gateDistToFinishM}
              crossed={state.gateAutoFinished}
              fallback={false}
            />
          </View>

          <Row label="CP" value={`${cpPassed}/${cpTotal}`} color={cpPassed === cpTotal && cpTotal > 0 ? colors.accent : colors.textTertiary} />
          <Row label="PTS" value={String(state.pointCount)} />
        </View>
      )}

      {/* ── PRE-RUN (readiness) ── */}
      {state.phase === 'readiness_check' && (
        <View style={styles.section}>
          <Row label="Status" value={state.readiness.status} />
          <Row label="In gate" value={state.readiness.inStartGate ? 'YES' : 'NO'} color={state.readiness.inStartGate ? colors.accent : colors.textTertiary} />
          <Row label="Dist" value={`${state.readiness.distanceToStartM?.toFixed(0) ?? '?'}m`} />
          <Row label="Ranked" value={state.readiness.rankedEligible ? 'YES' : 'NO'} color={state.readiness.rankedEligible ? colors.accent : colors.textTertiary} />
        </View>
      )}

      {/* ── POST-RUN SUMMARY ── */}
      {isDone && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RUN SUMMARY</Text>

          {/* Quality + eligibility */}
          {state.runQuality && (
            <View style={styles.summaryBlock}>
              <View style={styles.summaryRow}>
                <Text style={[styles.qualityBadge, {
                  color: state.runQuality.quality === 'perfect' ? colors.accent :
                         state.runQuality.quality === 'valid' ? colors.blue : colors.orange,
                  borderColor: state.runQuality.quality === 'perfect' ? colors.accent :
                               state.runQuality.quality === 'valid' ? colors.blue : colors.orange,
                }]}>
                  {state.runQuality.quality.toUpperCase()}
                </Text>
                <Text style={[styles.eligibleBadge, {
                  color: state.runQuality.leaderboardEligible ? colors.accent : colors.red,
                }]}>
                  {state.runQuality.leaderboardEligible ? 'RANKED' : 'NOT RANKED'}
                </Text>
              </View>

              {/* Primary reason */}
              {(() => {
                const reason = getPrimaryReason(state);
                return reason ? (
                  <Row label="Reason" value={reason} color={colors.orange} />
                ) : null;
              })()}
            </View>
          )}

          {/* Gate crossing details */}
          <Row label="Start" value={
            state.gateAutoStarted ? '✓ auto-crossing' :
            state.phase === 'completed_verified' ? '✓ manual' : '○ no crossing'
          } color={state.gateAutoStarted ? colors.accent : colors.textTertiary} />
          <Row label="Finish" value={
            state.gateAutoFinished ? '✓ auto-crossing' :
            state.phase === 'completed_verified' ? '✓ manual' : '○ no crossing'
          } color={state.gateAutoFinished ? colors.accent : colors.textTertiary} />

          {/* Checkpoints + corridor */}
          <Row label="CP" value={`${cpPassed}/${cpTotal}`} color={cpPassed === cpTotal ? colors.accent : colors.orange} />
          {state.verification && (
            <Row label="Corridor" value={`${Math.round(state.verification.corridor.coveragePercent)}%`}
              color={state.verification.corridor.coveragePercent >= 70 ? colors.accent : colors.orange} />
          )}

          {/* Distance + time */}
          <Row label="Distance" value={`${Math.round(state.gateTotalDistanceM)}m`} />
          <Row label="Time" value={formatTime(state.elapsedMs)} />
          <Row label="Points" value={String(state.pointCount)} />
        </View>
      )}
    </ScrollView>
  );
}

// ── Compact cell for grid layout ──

function Cell({ label, value, unit, color }: { label: string; value: string; unit: string; color?: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, color ? { color } : undefined]}>
        {value}<Text style={styles.cellUnit}>{unit}</Text>
      </Text>
    </View>
  );
}

// ── Gate distance cell ──

function GateCell({ label, distM, crossed, fallback }: {
  label: string;
  distM: number | null;
  crossed: boolean;
  fallback: boolean;
}) {
  const near = distM !== null && Math.abs(distM) < 25;
  return (
    <View style={[styles.gateCell, crossed && styles.gateCellCrossed]}>
      <Text style={styles.gateCellLabel}>{label}</Text>
      {crossed ? (
        <Text style={[styles.gateCellValue, { color: colors.accent }]}>
          {fallback ? '✓ FB' : '✓'}
        </Text>
      ) : distM !== null ? (
        <Text style={[styles.gateCellValue, near && { color: colors.gold }]}>
          {distM > 0 ? `${Math.round(distM)}m ▸` : `◂ ${Math.round(Math.abs(distM))}m`}
        </Text>
      ) : (
        <Text style={styles.gateCellValue}>—</Text>
      )}
    </View>
  );
}

// ── Simple row ──

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
    top: 90,
    left: spacing.sm,
    right: spacing.sm,
    maxHeight: 380,
    backgroundColor: 'rgba(8, 8, 12, 0.94)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 100,
  },
  content: {
    padding: spacing.md,
  },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  phaseTag: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  gpsTag: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
  },

  // Section
  section: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 3,
    fontSize: 8,
    marginBottom: spacing.sm,
  },

  // Grid (4 cells in a row)
  grid: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
  },
  cellLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 7,
    letterSpacing: 1,
  },
  cellValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: colors.textSecondary,
  },
  cellUnit: {
    fontSize: 8,
    color: colors.textTertiary,
  },

  // Gate cells
  gateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gateCell: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gateCellCrossed: {
    borderColor: colors.accent + '40',
    backgroundColor: colors.accentDim,
  },
  gateCellLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 8,
    letterSpacing: 2,
  },
  gateCellValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: colors.textSecondary,
  },

  // Summary
  summaryBlock: {
    marginBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  qualityBadge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  eligibleBadge: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    paddingVertical: 2,
  },

  // Row
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
