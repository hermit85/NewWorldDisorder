// Truth Map — verification recap visualization
// Shows official line vs rider line, checkpoints, gates, deviations
// Web-compatible version using styled View layout

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { TruthMapData, Checkpoint } from '@/data/verificationTypes';

interface Props {
  data: TruthMapData;
}

export function TruthMap({ data }: Props) {
  const v = data.verification;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>ROUTE VERIFICATION</Text>

      {/* Visual route representation */}
      <View style={styles.routeViz}>
        {/* Start gate */}
        <View style={styles.gateRow}>
          <View style={[styles.gateDot, data.startGate.entered ? styles.gatePass : styles.gateFail]} />
          <Text style={[styles.gateLabel, { color: data.startGate.entered ? colors.accent : colors.red }]}>
            START GATE {data.startGate.entered ? '✓' : '✕'}
          </Text>
        </View>

        {/* Route line with checkpoints */}
        <View style={styles.routeLine}>
          {/* Official line indicator */}
          <View style={styles.officialLine} />

          {/* Rider line indicator */}
          <View style={[
            styles.riderLine,
            { backgroundColor: v.routeClean ? colors.accent : colors.orange },
          ]} />

          {/* Checkpoints along the route */}
          {data.checkpoints.map((cp, i) => (
            <View
              key={cp.id}
              style={[
                styles.checkpointMarker,
                { top: `${((i + 1) / (data.checkpoints.length + 1)) * 100}%` },
              ]}
            >
              <View style={[
                styles.cpDot,
                cp.passed ? styles.cpPass : styles.cpFail,
              ]} />
              <Text style={[
                styles.cpLabel,
                { color: cp.passed ? colors.accent : colors.red },
              ]}>
                {cp.label} {cp.passed ? '✓' : '✕'}
              </Text>
            </View>
          ))}

          {/* Deviations */}
          {data.deviations.map((dev, i) => (
            <View
              key={i}
              style={[
                styles.deviationMarker,
                {
                  top: `${(dev.startIndex / data.officialLine.length) * 100}%`,
                  height: `${((dev.endIndex - dev.startIndex) / data.officialLine.length) * 100}%`,
                },
              ]}
            >
              <Text style={styles.deviationLabel}>
                {dev.type === 'shortcut' ? '⚠ SHORTCUT' : dev.type === 'major' ? '⚠ OFF-ROUTE' : '~ deviation'}
              </Text>
            </View>
          ))}
        </View>

        {/* Finish gate */}
        <View style={styles.gateRow}>
          <View style={[styles.gateDot, data.finishGate.entered ? styles.gatePass : styles.gateFail]} />
          <Text style={[styles.gateLabel, { color: data.finishGate.entered ? colors.accent : colors.red }]}>
            FINISH GATE {data.finishGate.entered ? '✓' : '✕'}
          </Text>
        </View>
      </View>

      {/* Summary stats */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {v.checkpointsPassed}/{v.checkpointsTotal}
          </Text>
          <Text style={styles.summaryLabel}>CHECKPOINTS</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            {Math.round(v.corridor.coveragePercent)}%
          </Text>
          <Text style={styles.summaryLabel}>ROUTE MATCH</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>
            ±{v.avgAccuracyM.toFixed(0)}m
          </Text>
          <Text style={styles.summaryLabel}>GPS ACC</Text>
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: colors.textTertiary }]} />
          <Text style={styles.legendText}>Official</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendLine, { backgroundColor: v.routeClean ? colors.accent : colors.orange }]} />
          <Text style={styles.legendText}>Your line</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
  },
  header: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 3,
    textAlign: 'center',
  },
  routeViz: {
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  gateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gateDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  gatePass: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  gateFail: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  gateLabel: {
    ...typography.labelSmall,
    letterSpacing: 2,
  },
  routeLine: {
    marginLeft: 7,
    borderLeftWidth: 2,
    borderLeftColor: colors.textTertiary,
    minHeight: 200,
    paddingLeft: spacing.xl,
    position: 'relative',
  },
  officialLine: {
    position: 'absolute',
    left: -2,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: colors.textTertiary,
  },
  riderLine: {
    position: 'absolute',
    left: 1,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    opacity: 0.7,
  },
  checkpointMarker: {
    position: 'absolute',
    left: -spacing.xl - 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cpDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
  },
  cpPass: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  cpFail: {
    borderColor: colors.red,
    backgroundColor: colors.redDim,
  },
  cpLabel: {
    ...typography.labelSmall,
    fontSize: 10,
  },
  deviationMarker: {
    position: 'absolute',
    left: spacing.sm,
    right: 0,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: radii.sm,
    justifyContent: 'center',
    paddingLeft: spacing.sm,
  },
  deviationLabel: {
    ...typography.labelSmall,
    color: colors.red,
    fontSize: 9,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  summaryValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 16,
  },
  summaryLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 8,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  legendText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
  },
});
