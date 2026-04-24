// ═══════════════════════════════════════════════════════════
// Route Verification — corridor, checkpoint, GPS quality
//
// RESPONSIBILITIES (after gate engine consolidation):
// - Checkpoint coverage (are checkpoints hit?)
// - Corridor adherence (is rider on the official line?)
// - GPS trace quality (average accuracy)
// - Trace completeness (enough points?)
//
// NOT RESPONSIBLE FOR (gate engine owns these):
// - Start gate crossing
// - Finish gate crossing
// - Gate fallbacks
// - Run quality tiers (PERFECT/VALID/ROUGH)
// ═══════════════════════════════════════════════════════════

import { GpsPoint, distanceMeters } from './gps';
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
import { TrailGeoSeed } from '@/data/venueConfig';

// ── Thresholds ──

const CORRIDOR_WIDTH_M = 50;
const CORRIDOR_COVERAGE_MIN = 0.70; // 70%
const CHECKPOINT_RADIUS_M = 40;
const GPS_QUALITY_THRESHOLD_M = 20;

// ── Build checkpoints from trail geometry ──

export function buildCheckpoints(geo: TrailGeoSeed): Checkpoint[] {
  const poly = geo.polyline;
  const count = 3;
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

// ── Evaluate checkpoints ──

export function evaluateCheckpoints(
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

export function evaluateCorridor(
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
    let minDist = Infinity;
    if (officialLine.length === 1) {
      minDist = distanceMeters(p, officialLine[0]);
    } else {
      // Point-to-segment: vertex-only distance overstates deviation between
      // widely-spaced polyline points — a rider exactly on the line can read
      // tens of metres off from the nearest vertex.
      for (let j = 0; j < officialLine.length - 1; j++) {
        const d = distanceToSegmentM(p, officialLine[j], officialLine[j + 1]);
        if (d < minDist) minDist = d;
      }
    }

    if (minDist <= CORRIDOR_WIDTH_M) {
      insideCount++;
      if (deviationStart !== null) {
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

// Local planar projection around the segment midpoint. Meters-per-degree
// adjusted for latitude — accurate to <1m within a few-km polyline segment,
// which is more than enough for 50m corridor checks.
function distanceToSegmentM(
  p: { latitude: number; longitude: number },
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const latRef = (a.latitude + b.latitude) / 2;
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((latRef * Math.PI) / 180);
  const bx = (b.longitude - a.longitude) * mPerLng;
  const by = (b.latitude - a.latitude) * mPerLat;
  const px = (p.longitude - a.longitude) * mPerLng;
  const py = (p.latitude - a.latitude) * mPerLat;
  const lenSq = bx * bx + by * by;
  if (lenSq < 1e-6) return Math.hypot(px, py);
  let t = (px * bx + py * by) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - t * bx, py - t * by);
}

// ── GPS quality assessment ──

export function assessTraceQuality(points: GpsPoint[]): { readiness: GpsReadiness; avgAccuracy: number } {
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

// ── Gate state passed in from gate engine ──

export interface GateTruth {
  startCrossed: boolean;
  finishCrossed: boolean;
  startFallback: boolean;
  finishFallback: boolean;
}

// ── Main verification function ──
// Gate truth comes from gateEngine. This function validates route/corridor/checkpoints.

export function verifyRealRun(
  mode: RunMode,
  points: GpsPoint[],
  geo: TrailGeoSeed,
  gateTruth?: GateTruth,
): VerificationResult {
  const issues: string[] = [];

  // Evaluate route-level checks (always, for both practice and ranked)
  const checkpoints = evaluateCheckpoints(points, buildCheckpoints(geo));
  const corridor = evaluateCorridor(points, geo.polyline);
  const { readiness: gpsQuality, avgAccuracy } = assessTraceQuality(points);
  const passed = checkpoints.filter((c) => c.passed).length;
  const total = checkpoints.length;

  // Build gate state objects for VerificationResult compatibility
  // Gate truth comes from gateEngine; we just format it for the result interface
  const startGate: GateState = {
    entered: gateTruth?.startCrossed ?? false,
    enteredAt: null,
    coordinate: geo.startZone,
    radiusM: geo.startZone.radiusM,
  };
  const finishGate: GateState = {
    entered: gateTruth?.finishCrossed ?? false,
    enteredAt: null,
    coordinate: geo.finishZone,
    radiusM: geo.finishZone.radiusM,
  };

  // Practice runs — skip ranked checks
  if (mode === 'practice') {
    return {
      status: 'practice_only',
      runMode: 'practice',
      isLeaderboardEligible: false,
      acceptedVia: 'manual',
      startGate,
      finishGate,
      checkpoints,
      checkpointsPassed: passed,
      checkpointsTotal: total,
      corridor,
      routeClean: corridor.deviations.length === 0,
      gpsQuality,
      avgAccuracyM: avgAccuracy,
      label: 'Practice Only',
      explanation: 'Practice run. Not submitted to leaderboard.',
      issues: [],
    };
  }

  // ── Ranked verification ──
  // Gate crossing is owned by gateEngine — we just check route integrity here

  let status: VerificationStatus = 'verified';

  // Gate checks — from gateEngine truth (not re-computed)
  if (gateTruth && !gateTruth.startCrossed) {
    issues.push('Start gate not crossed');
    status = 'outside_start_gate';
  }
  if (gateTruth && !gateTruth.finishCrossed) {
    issues.push('Finish gate not crossed');
    if (status === 'verified') status = 'outside_finish_gate';
  }

  // Checkpoint coverage
  if (passed < total) {
    issues.push(`${total - passed} checkpoint${total - passed > 1 ? 's' : ''} missed`);
    if (status === 'verified') status = 'missing_checkpoint';
  }

  // Corridor adherence
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

  // GPS quality
  if (gpsQuality === 'weak') {
    issues.push('Weak GPS signal during run');
    if (status === 'verified') status = 'weak_signal';
  }

  // Trace completeness
  if (points.length < 10) {
    issues.push('Trace too short');
    if (status === 'verified') status = 'invalid_route';
  }

  const isVerified = status === 'verified';

  return {
    status,
    runMode: mode,
    isLeaderboardEligible: isVerified,
    acceptedVia: isVerified ? 'gate_cross' : null,
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
