// ═══════════════════════════════════════════════════════════
// Verification Engine v1
// MVP route-trust system — mock-ready, GPS-ready architecture
// ═══════════════════════════════════════════════════════════

import {
  VerificationResult,
  VerificationStatus,
  RunMode,
  GateState,
  Checkpoint,
  RouteCorridor,
  RouteDeviation,
  GpsReadiness,
  PreRunReadiness,
  ReadinessStatus,
  GpsState,
} from '@/data/verificationTypes';

// ── Pre-run readiness check ──

export function computeReadiness(
  gps: GpsState,
  distanceToStartM: number | null,
  startGateRadiusM: number = 30
): PreRunReadiness {
  const inStartGate = distanceToStartM !== null && distanceToStartM <= startGateRadiusM;
  const gpsGood = gps.readiness === 'good' || gps.readiness === 'excellent';
  const gpsWeak = gps.readiness === 'weak';
  const gpsLocking = gps.readiness === 'locking' || gps.readiness === 'unavailable';

  if (gpsLocking) {
    return {
      status: 'gps_locking',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Acquiring GPS signal...',
      ctaLabel: 'WAITING FOR GPS',
      ctaEnabled: false,
    };
  }

  if (gpsWeak && !inStartGate) {
    return {
      status: 'weak_signal',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Weak GPS. Practice runs only.',
      ctaLabel: 'START PRACTICE RUN',
      ctaEnabled: true,
    };
  }

  if (!inStartGate && distanceToStartM !== null) {
    return {
      status: 'move_to_start',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: `${Math.round(distanceToStartM)}m to start gate`,
      ctaLabel: 'MOVE TO START GATE',
      ctaEnabled: false,
    };
  }

  if (inStartGate && gpsGood) {
    return {
      status: 'ranked_ready',
      gps,
      inStartGate: true,
      rankedEligible: true,
      distanceToStartM,
      message: 'Start gate reached. Ranked run ready.',
      ctaLabel: 'ARM RANKED RUN',
      ctaEnabled: true,
    };
  }

  if (inStartGate && gpsWeak) {
    return {
      status: 'practice_only',
      gps,
      inStartGate: true,
      rankedEligible: false,
      distanceToStartM,
      message: 'In start gate. Weak signal — practice only.',
      ctaLabel: 'START PRACTICE RUN',
      ctaEnabled: true,
    };
  }

  // Start gate reached but GPS just okay
  return {
    status: 'start_gate_reached',
    gps,
    inStartGate: true,
    rankedEligible: gpsGood,
    distanceToStartM,
    message: 'Start gate reached.',
    ctaLabel: gpsGood ? 'ARM RANKED RUN' : 'START PRACTICE RUN',
    ctaEnabled: true,
  };
}

// ── Post-run verification ──

export function verifyRun(
  mode: RunMode,
  startGate: GateState,
  finishGate: GateState,
  checkpoints: Checkpoint[],
  corridor: RouteCorridor,
  gpsQuality: GpsReadiness,
  avgAccuracyM: number
): VerificationResult {
  const issues: string[] = [];
  let status: VerificationStatus = 'verified';

  // Practice runs skip ranked verification
  if (mode === 'practice') {
    return buildResult({
      status: 'practice_only',
      mode,
      startGate,
      finishGate,
      checkpoints,
      corridor,
      gpsQuality,
      avgAccuracyM,
      issues: [],
      label: 'Practice Only',
      explanation: 'Practice run. Not submitted to leaderboard.',
      isLeaderboardEligible: false,
    });
  }

  // Check start gate
  if (!startGate.entered) {
    issues.push('Did not enter start gate');
    status = 'outside_start_gate';
  }

  // Check finish gate
  if (!finishGate.entered) {
    issues.push('Did not reach finish gate');
    status = status === 'verified' ? 'outside_finish_gate' : status;
  }

  // Check checkpoints
  const passed = checkpoints.filter((c) => c.passed).length;
  const total = checkpoints.length;
  if (passed < total) {
    issues.push(`${total - passed} checkpoint${total - passed > 1 ? 's' : ''} missed`);
    if (status === 'verified') status = 'missing_checkpoint';
  }

  // Check route corridor
  const hasShortcut = corridor.deviations.some((d) => d.type === 'shortcut');
  const hasMajorDeviation = corridor.deviations.some((d) => d.type === 'major');
  if (hasShortcut) {
    issues.push('Shortcut detected');
    if (status === 'verified') status = 'shortcut_detected';
  } else if (hasMajorDeviation) {
    issues.push('Off-route section detected');
    if (status === 'verified') status = 'invalid_route';
  }

  if (corridor.coveragePercent < 80) {
    issues.push(`Only ${Math.round(corridor.coveragePercent)}% route coverage`);
    if (status === 'verified') status = 'invalid_route';
  }

  // Check GPS quality
  if (gpsQuality === 'weak' || avgAccuracyM > 15) {
    issues.push('Weak GPS signal during run');
    if (status === 'verified') status = 'weak_signal';
  }

  const isVerified = status === 'verified';
  const label = isVerified ? 'Verified' : statusToLabel(status);
  const explanation = isVerified
    ? `Clean line. ${passed}/${total} checkpoints.`
    : issues.join('. ') + '.';

  return buildResult({
    status,
    mode,
    startGate,
    finishGate,
    checkpoints,
    corridor,
    gpsQuality,
    avgAccuracyM,
    issues,
    label,
    explanation,
    isLeaderboardEligible: isVerified,
  });
}

function statusToLabel(status: VerificationStatus): string {
  switch (status) {
    case 'verified': return 'Verified';
    case 'practice_only': return 'Practice Only';
    case 'invalid_route': return 'Route Broken';
    case 'weak_signal': return 'Weak Signal';
    case 'missing_checkpoint': return 'Checkpoint Missed';
    case 'outside_start_gate': return 'No Start Gate';
    case 'outside_finish_gate': return 'No Finish Gate';
    case 'shortcut_detected': return 'Shortcut Detected';
    case 'pending': return 'Verifying...';
    default: return 'Unknown';
  }
}

interface BuildParams {
  status: VerificationStatus;
  mode: RunMode;
  startGate: GateState;
  finishGate: GateState;
  checkpoints: Checkpoint[];
  corridor: RouteCorridor;
  gpsQuality: GpsReadiness;
  avgAccuracyM: number;
  issues: string[];
  label: string;
  explanation: string;
  isLeaderboardEligible: boolean;
}

function buildResult(p: BuildParams): VerificationResult {
  return {
    status: p.status,
    runMode: p.mode,
    isLeaderboardEligible: p.isLeaderboardEligible,
    startGate: p.startGate,
    finishGate: p.finishGate,
    checkpoints: p.checkpoints,
    checkpointsPassed: p.checkpoints.filter((c) => c.passed).length,
    checkpointsTotal: p.checkpoints.length,
    corridor: p.corridor,
    routeClean: p.corridor.deviations.length === 0,
    gpsQuality: p.gpsQuality,
    avgAccuracyM: p.avgAccuracyM,
    label: p.label,
    explanation: p.explanation,
    issues: p.issues,
  };
}
