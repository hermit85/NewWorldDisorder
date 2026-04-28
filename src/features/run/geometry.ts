// ═══════════════════════════════════════════════════════════
// Gate Geometry — line crossing detection, heading calc, etc.
// Anti-frustration first: prefer valid over invalid.
// ═══════════════════════════════════════════════════════════

import { GpsPoint, distanceMeters } from '@/systems/gps';
import { GateDefinition, GateCrossingResult, CrossingFlag, SmoothedPosition } from './types';

// ── Constants ──

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

// ── Heading between two points ──

export function computeHeading(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const dLon = (to.longitude - from.longitude) * DEG_TO_RAD;
  const lat1 = from.latitude * DEG_TO_RAD;
  const lat2 = to.latitude * DEG_TO_RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearing + 360) % 360;
}

// ── Heading difference (smallest angle) ──

export function headingDifference(a: number, b: number): number {
  let diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

// ── Speed between two points, km/h ──

export function computeSpeedKmh(
  from: GpsPoint,
  to: GpsPoint
): number {
  const dist = distanceMeters(from, to);
  const timeSec = Math.abs(to.timestamp - from.timestamp) / 1000;
  if (timeSec < 0.1) return 0;
  return (dist / timeSec) * 3.6; // m/s → km/h
}

// ── GPS Position Smoothing ──
// Rolling average of last N points for stability.

export function smoothPosition(
  buffer: GpsPoint[],
  maxSize: number = 4
): SmoothedPosition | null {
  if (buffer.length === 0) return null;

  const recent = buffer.slice(-maxSize);
  const n = recent.length;

  let lat = 0, lon = 0, alt = 0, acc = 0, spd = 0;
  let altCount = 0, accCount = 0, spdCount = 0;

  for (const p of recent) {
    lat += p.latitude;
    lon += p.longitude;
    if (p.altitude !== null) { alt += p.altitude; altCount++; }
    if (p.accuracy !== null) { acc += p.accuracy; accCount++; }
    if (p.speed !== null) { spd += p.speed; spdCount++; }
  }

  // Compute heading from first to last of buffer
  let heading: number | null = null;
  if (n >= 2) {
    heading = computeHeading(recent[0], recent[n - 1]);
  }

  return {
    latitude: lat / n,
    longitude: lon / n,
    altitude: altCount > 0 ? alt / altCount : null,
    accuracy: accCount > 0 ? acc / accCount : null,
    speed: spdCount > 0 ? (spd / spdCount) * 3.6 : null, // m/s → km/h
    heading,
    timestamp: recent[n - 1].timestamp,
    sampleCount: n,
  };
}

// ── Signed distance from gate line ──
// Positive = on the "correct" side (uphill/before gate)
// Negative = past gate (downhill/after gate)
// The gate line is perpendicular to trailBearing.

export function signedDistanceFromGateLine(
  point: { latitude: number; longitude: number },
  gate: GateDefinition
): number {
  const dist = distanceMeters(point, gate.center);

  // Heading from gate center to point
  const headingToPoint = computeHeading(gate.center, point);

  // Angle relative to trail direction
  const relativeAngle = (headingToPoint - gate.trailBearing + 360) % 360;

  // If relative angle is 90-270, point is "behind" the gate (past it)
  // If 0-90 or 270-360, point is "before" the gate (approaching)
  // For downhill: trail bearing points downhill.
  // Before = uphill = angle near 180 (opposite of trail direction)
  // After = downhill = angle near 0 (same as trail direction)

  // Signed distance along trail axis.
  // Positive means "before the line" (uphill / approaching),
  // negative means "past the line" (downhill / already crossed).
  const signedDist = -dist * Math.cos(relativeAngle * DEG_TO_RAD);

  return signedDist;
}

// ── Perpendicular distance from gate line ──
// How far off-center the crossing is (lateral offset)

export function lateralDistanceFromGateLine(
  point: { latitude: number; longitude: number },
  gate: GateDefinition
): number {
  const dist = distanceMeters(point, gate.center);
  const headingToPoint = computeHeading(gate.center, point);
  const relativeAngle = (headingToPoint - gate.trailBearing + 360) % 360;
  return Math.abs(dist * Math.sin(relativeAngle * DEG_TO_RAD));
}

// ═══════════════════════════════════════════════════════════
// LINE CROSSING DETECTION
// Detects when rider crosses from one side of gate to the other.
// Anti-frustration: uses zone + proximity as fallback.
// ═══════════════════════════════════════════════════════════

export function detectGateCrossing(
  points: GpsPoint[],
  gate: GateDefinition,
  options: {
    /** Search window: only check these indices */
    searchStartIndex?: number;
    searchEndIndex?: number;
    /** Is this a finish gate? Finish is more forgiving. */
    isFinish?: boolean;
    /** Rider heading for heading check (if already known) */
    currentHeading?: number | null;
    /** Total distance covered so far (for finish sanity) */
    totalDistanceM?: number;
    /** Expected trail length for finish % check */
    expectedLengthM?: number;
    /** Run duration so far in seconds */
    durationSec?: number;
    /** Min duration before finish */
    minDurationSec?: number;
    /** Finish-only: allow proximity fallback when no real line crossing was
     *  detected. Practice uses this anti-frustration path; ranked should
     *  pass false so the finish is the actual configured line. */
    allowFinishFallback?: boolean;
    /** Start-only: allow soft start when the first post-arm sample is already
     *  just past the line. The live gate engine pairs this with a separate
     *  post-arm directional-progress check; direct callers keep the stricter
     *  default so wrong-side / lateral unit tests stay honest. */
    allowPostLineSoftStart?: boolean;
  } = {}
): GateCrossingResult {
  const {
    searchStartIndex = 0,
    searchEndIndex = points.length - 1,
    isFinish = false,
  } = options;

  const noCrossing: GateCrossingResult = {
    crossed: false,
    crossingIndex: null,
    crossingTimestamp: null,
    distanceFromCenterM: null,
    riderHeadingDeg: null,
    speedAtCrossingKmh: null,
    correctSide: false,
    flags: [],
  };

  if (points.length < 2) return noCrossing;

  const start = Math.max(0, searchStartIndex);
  const end = Math.min(points.length - 1, searchEndIndex);

  // ── Phase 1: Look for actual line crossing ──
  for (let i = start + 1; i <= end; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const distToCenter = distanceMeters(curr, gate.center);

    // Quick reject: too far from gate
    if (distToCenter > gate.entryRadiusM) continue;

    const prevSigned = signedDistanceFromGateLine(prev, gate);
    const currSigned = signedDistanceFromGateLine(curr, gate);

    // Sign change = crossed the line
    const signChanged = (prevSigned > 0 && currSigned <= 0) || (prevSigned <= 0 && currSigned > 0);

    if (!signChanged) continue;

    // We have a line crossing — evaluate quality
    const flags: CrossingFlag[] = [];
    const lateralDist = lateralDistanceFromGateLine(curr, gate);
    const heading = computeHeading(prev, curr);
    const speedKmh = computeSpeedKmh(prev, curr);

    // Check lateral offset (must be within half line width)
    if (lateralDist > gate.lineWidthM / 2) continue;

    // Check heading
    const headingDiff = headingDifference(heading, gate.trailBearing);
    if (headingDiff > gate.headingToleranceDeg) {
      if (isFinish && headingDiff < 120) {
        // Finish is forgiving: allow wider heading tolerance
        flags.push('poor_heading');
      } else if (!isFinish && headingDiff < 90) {
        // Start allows some deviation
        flags.push('poor_heading');
      } else {
        flags.push('wrong_side');
      }
    }

    // Check speed
    if (speedKmh < gate.minTriggerSpeedKmh) {
      flags.push('low_speed');
    }

    // Check accuracy
    if (curr.accuracy !== null && curr.accuracy > 20) {
      flags.push('weak_accuracy');
    }

    // Check for suspicious jump
    const jumpDist = distanceMeters(prev, curr);
    const jumpTime = Math.abs(curr.timestamp - prev.timestamp) / 1000;
    if (jumpTime > 0 && jumpDist / jumpTime > 30) { // >108 km/h between points
      flags.push('suspicious_jump');
    }

    // Correct side: for start, approaching means coming from uphill
    // For downhill trails, trail bearing points downhill
    // Crossing should be prevSigned > 0 → currSigned <= 0 (entering from uphill)
    const correctSide = !isFinish
      ? (prevSigned > 0 && currSigned <= 0) // start: from uphill to downhill
      : true; // finish: any direction crossing counts

    if (!correctSide && !isFinish) {
      flags.push('wrong_side');
    }

    // Determine overall quality
    const hasSerious = flags.includes('wrong_side') && !isFinish;
    if (!hasSerious) {
      if (flags.length === 0) flags.push('perfect_crossing');

      return {
        crossed: true,
        crossingIndex: i,
        crossingTimestamp: curr.timestamp,
        distanceFromCenterM: distToCenter,
        riderHeadingDeg: heading,
        speedAtCrossingKmh: speedKmh,
        correctSide: !flags.includes('wrong_side'),
        flags,
      };
    }
  }

  // ── Phase 2 (finish only): Soft proximity fallback ──
  if (isFinish && options.allowFinishFallback !== false) {
    return detectFinishFallback(points, gate, options);
  }

  // ── Phase 3 (start only): Zone proximity fallback ──
  // Less forgiving than finish but still allows imprecise crossing.
  //
  // Field test: riders often tap UZBRÓJ while already standing visually
  // on the start pin. The live gate engine opts into a small post-line
  // window here and then applies a separate directional-progress guard.
  // Plain callers keep the historical before-line-only behavior.
  const minSoftSignedDist = options.allowPostLineSoftStart ? -gate.zoneDepthM : 0;
  for (let i = start; i <= end; i++) {
    const p = points[i];
    const dist = distanceMeters(p, gate.center);
    const signedDist = signedDistanceFromGateLine(p, gate);
    const lateralDist = lateralDistanceFromGateLine(p, gate);
    if (
      signedDist >= minSoftSignedDist &&
      signedDist <= gate.zoneDepthM &&
      lateralDist <= (gate.lineWidthM / 2) + 2
    ) {
      const heading = i > 0 ? computeHeading(points[i - 1], p) : null;
      const headingOk = heading !== null
        ? headingDifference(heading, gate.trailBearing) <= gate.headingToleranceDeg
        : true; // no heading info = benefit of doubt

      if (headingOk) {
        const flags: CrossingFlag[] = ['soft_crossing'];
        if (p.accuracy !== null && p.accuracy > 20) flags.push('weak_accuracy');

        return {
          crossed: true,
          crossingIndex: i,
          crossingTimestamp: p.timestamp,
          distanceFromCenterM: dist,
          riderHeadingDeg: heading,
          speedAtCrossingKmh: p.speed !== null ? p.speed * 3.6 : null,
          correctSide: true,
          flags,
        };
      }
    }
  }

  return noCrossing;
}

// ── Finish fallback: very forgiving ──

function detectFinishFallback(
  points: GpsPoint[],
  gate: GateDefinition,
  options: {
    totalDistanceM?: number;
    expectedLengthM?: number;
    durationSec?: number;
    minDurationSec?: number;
    searchStartIndex?: number;
    searchEndIndex?: number;
  }
): GateCrossingResult {
  const {
    totalDistanceM = 0,
    expectedLengthM = 0,
    durationSec = 0,
    minDurationSec = 10,
    searchStartIndex = 0,
    searchEndIndex = points.length - 1,
  } = options;

  const noCrossing: GateCrossingResult = {
    crossed: false,
    crossingIndex: null,
    crossingTimestamp: null,
    distanceFromCenterM: null,
    riderHeadingDeg: null,
    speedAtCrossingKmh: null,
    correctSide: false,
    flags: [],
  };

  // Don't allow finish fallback if too short — require FULL min duration (not half)
  if (durationSec < minDurationSec) return noCrossing;

  // Check distance requirement — must have covered at least 70% of trail
  const distanceFraction = expectedLengthM > 0 ? totalDistanceM / expectedLengthM : 0;
  if (distanceFraction < 0.7) return noCrossing;

  // Look for closest approach to finish in the tail portion
  const start = Math.max(searchStartIndex, Math.floor(points.length * 0.6)); // only check last 40%
  const end = Math.min(searchEndIndex, points.length - 1);

  let closestDist = Infinity;
  let closestIdx = -1;

  for (let i = start; i <= end; i++) {
    const d = distanceMeters(points[i], gate.center);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }

  // Fallback radius: keep this at the configured entry radius. The prior
  // 1.2x multiplier accepted a real field run at 14.27m from the finish
  // center, which felt like the app "crossed out" before the physical meta.
  const fallbackRadius = gate.entryRadiusM;

  if (closestDist <= fallbackRadius && closestIdx >= 0) {
    const p = points[closestIdx];
    const heading = closestIdx > 0 ? computeHeading(points[closestIdx - 1], p) : null;
    const flags: CrossingFlag[] = ['fallback_proximity'];
    if (p.accuracy !== null && p.accuracy > 20) flags.push('weak_accuracy');

    return {
      crossed: true,
      crossingIndex: closestIdx,
      crossingTimestamp: p.timestamp,
      distanceFromCenterM: closestDist,
      riderHeadingDeg: heading,
      speedAtCrossingKmh: p.speed !== null ? p.speed * 3.6 : null,
      correctSide: true, // finish is always "correct" side
      flags,
    };
  }

  return noCrossing;
}
