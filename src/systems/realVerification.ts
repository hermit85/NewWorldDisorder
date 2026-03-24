// ═══════════════════════════════════════════════════════════
// Real Verification — connects GPS trace to trust engine
// Uses actual recorded points to evaluate run integrity
// ═══════════════════════════════════════════════════════════

import { GpsPoint, distanceMeters, isInZone } from './gps';
import {
  VerificationResult,
  VerificationStatus,
  RunMode,
  GateState,
  Checkpoint,
  RouteCorridor,
  RouteDeviation,
  GpsReadiness,
} from '@/data/verificationTypes';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';

// ── Thresholds ──

const CORRIDOR_WIDTH_M = 50; // max distance from official line
const CORRIDOR_COVERAGE_MIN = 0.70; // 70% must be within corridor
const CHECKPOINT_RADIUS_M = 40; // checkpoint detection radius
const GPS_QUALITY_THRESHOLD_M = 20; // accuracy worse than this = weak

// ── Build checkpoints from trail geometry ──

export function buildCheckpoints(geo: TrailGeoSeed): Checkpoint[] {
  const poly = geo.polyline;
  const count = 3; // 3 checkpoints per trail
  return Array.from({ length: count }, (_, i) => {
    const idx = Math.floor(((i + 1) / (count + 1)) * poly.length);
    const coord = poly[Math.min(idx, poly.length - 1)];
    return {
      id: `cp-${i + 1}`,
      label: `CP ${i + 1}`,
      coordinate: coord,
      radiusM: CHECKPOINT_RADIUS_M,
      passed: false,
      passedAt: null,
    };
  });
}

// ── Evaluate gate ──

function evaluateGate(
  points: GpsPoint[],
  zone: { latitude: number; longitude: number; radiusM: number }
): GateState {
  for (const p of points) {
    if (isInZone(p, zone)) {
      return {
        entered: true,
        enteredAt: p.timestamp,
        coordinate: zone,
        radiusM: zone.radiusM,
      };
    }
  }
  return {
    entered: false,
    enteredAt: null,
    coordinate: zone,
    radiusM: zone.radiusM,
  };
}

// ── Evaluate checkpoints ──

function evaluateCheckpoints(
  points: GpsPoint[],
  checkpoints: Checkpoint[]
): Checkpoint[] {
  return checkpoints.map((cp) => {
    for (const p of points) {
      if (distanceMeters(p, cp.coordinate) <= cp.radiusM) {
        return { ...cp, passed: true, passedAt: p.timestamp };
      }
    }
    return cp;
  });
}

// ── Evaluate route corridor ──

function evaluateCorridor(
  points: GpsPoint[],
  officialLine: { latitude: number; longitude: number }[]
): RouteCorridor {
  if (points.length === 0) {
    return { maxDeviationM: 0, coveragePercent: 0, deviations: [] };
  }

  let insideCount = 0;
  let maxDev = 0;
  const deviations: RouteDeviation[] = [];
  let deviationStart: number | null = null;
  let currentMaxDev = 0;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    // Find minimum distance to any segment of official line
    let minDist = Infinity;
    for (const linePoint of officialLine) {
      const d = distanceMeters(p, linePoint);
      if (d < minDist) minDist = d;
    }

    if (minDist <= CORRIDOR_WIDTH_M) {
      insideCount++;
      if (deviationStart !== null) {
        // End deviation segment
        deviations.push({
          startIndex: deviationStart,
          endIndex: i - 1,
          maxDeviationM: currentMaxDev,
          type: currentMaxDev > 150 ? 'shortcut' : currentMaxDev > 80 ? 'major' : 'minor',
        });
        deviationStart = null;
        currentMaxDev = 0;
      }
    } else {
      if (deviationStart === null) deviationStart = i;
      currentMaxDev = Math.max(currentMaxDev, minDist);
    }
    maxDev = Math.max(maxDev, minDist);
  }

  // Close any open deviation
  if (deviationStart !== null) {
    deviations.push({
      startIndex: deviationStart,
      endIndex: points.length - 1,
      maxDeviationM: currentMaxDev,
      type: currentMaxDev > 150 ? 'shortcut' : currentMaxDev > 80 ? 'major' : 'minor',
    });
  }

  return {
    maxDeviationM: maxDev,
    coveragePercent: (insideCount / points.length) * 100,
    deviations,
  };
}

// ── GPS quality assessment ──

function assessTraceQuality(points: GpsPoint[]): { readiness: GpsReadiness; avgAccuracy: number } {
  if (points.length === 0) return { readiness: 'unavailable', avgAccuracy: 999 };

  const accuracies = points
    .map((p) => p.accuracy)
    .filter((a): a is number => a !== null);

  if (accuracies.length === 0) return { readiness: 'weak', avgAccuracy: 30 };

  const avg = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;

  return {
    readiness: avg <= 10 ? 'excellent' : avg <= GPS_QUALITY_THRESHOLD_M ? 'good' : 'weak',
    avgAccuracy: avg,
  };
}

// ── Main verification function ──

export function verifyRealRun(
  mode: RunMode,
  points: GpsPoint[],
  geo: TrailGeoSeed
): VerificationResult {
  const issues: string[] = [];

  // Practice runs skip ranked verification
  if (mode === 'practice') {
    const checkpoints = evaluateCheckpoints(points, buildCheckpoints(geo));
    const corridor = evaluateCorridor(points, geo.polyline);
    const { readiness, avgAccuracy } = assessTraceQuality(points);

    return {
      status: 'practice_only',
      runMode: 'practice',
      isLeaderboardEligible: false,
      startGate: evaluateGate(points, geo.startZone),
      finishGate: evaluateGate(points, geo.finishZone),
      checkpoints,
      checkpointsPassed: checkpoints.filter((c) => c.passed).length,
      checkpointsTotal: checkpoints.length,
      corridor,
      routeClean: corridor.deviations.length === 0,
      gpsQuality: readiness,
      avgAccuracyM: avgAccuracy,
      label: 'Practice Only',
      explanation: 'Practice run. Not submitted to leaderboard.',
      issues: [],
    };
  }

  // Ranked verification
  const startGate = evaluateGate(points.slice(0, Math.min(20, points.length)), geo.startZone);
  const finishGate = evaluateGate(points.slice(-Math.min(20, points.length)), geo.finishZone);
  const checkpoints = evaluateCheckpoints(points, buildCheckpoints(geo));
  const corridor = evaluateCorridor(points, geo.polyline);
  const { readiness: gpsQuality, avgAccuracy } = assessTraceQuality(points);

  let status: VerificationStatus = 'verified';

  // Check start gate
  if (!startGate.entered) {
    issues.push('Start gate not entered');
    status = 'outside_start_gate';
  }

  // Check finish gate
  if (!finishGate.entered) {
    issues.push('Finish gate not reached');
    if (status === 'verified') status = 'outside_finish_gate';
  }

  // Check checkpoints
  const passed = checkpoints.filter((c) => c.passed).length;
  const total = checkpoints.length;
  if (passed < total) {
    issues.push(`${total - passed} checkpoint${total - passed > 1 ? 's' : ''} missed`);
    if (status === 'verified') status = 'missing_checkpoint';
  }

  // Check corridor
  const hasShortcut = corridor.deviations.some((d) => d.type === 'shortcut');
  const hasMajor = corridor.deviations.some((d) => d.type === 'major');
  if (hasShortcut) {
    issues.push('Shortcut detected');
    if (status === 'verified') status = 'shortcut_detected';
  } else if (hasMajor) {
    issues.push('Significant off-route section');
    if (status === 'verified') status = 'invalid_route';
  }

  if (corridor.coveragePercent < CORRIDOR_COVERAGE_MIN * 100) {
    issues.push(`Only ${Math.round(corridor.coveragePercent)}% route coverage`);
    if (status === 'verified') status = 'invalid_route';
  }

  // Check GPS quality
  if (gpsQuality === 'weak') {
    issues.push('Weak GPS signal during run');
    if (status === 'verified') status = 'weak_signal';
  }

  // Check trace completeness
  if (points.length < 10) {
    issues.push('Trace too short');
    if (status === 'verified') status = 'invalid_route';
  }

  const isVerified = status === 'verified';

  return {
    status,
    runMode: mode,
    isLeaderboardEligible: isVerified,
    startGate,
    finishGate,
    checkpoints,
    checkpointsPassed: passed,
    checkpointsTotal: total,
    corridor,
    routeClean: corridor.deviations.length === 0,
    gpsQuality,
    avgAccuracyM: avgAccuracy,
    label: isVerified ? 'Verified' : statusLabel(status),
    explanation: isVerified
      ? `Clean line. ${passed}/${total} checkpoints.`
      : issues.join('. ') + '.',
    issues,
  };
}

function statusLabel(s: VerificationStatus): string {
  const labels: Record<VerificationStatus, string> = {
    verified: 'Verified',
    practice_only: 'Practice Only',
    invalid_route: 'Route Broken',
    weak_signal: 'Weak Signal',
    missing_checkpoint: 'Checkpoint Missed',
    outside_start_gate: 'No Start Gate',
    outside_finish_gate: 'No Finish Gate',
    shortcut_detected: 'Shortcut Detected',
    pending: 'Verifying...',
  };
  return labels[s] ?? 'Unknown';
}
