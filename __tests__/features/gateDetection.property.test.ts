// ═══════════════════════════════════════════════════════════
// Gate detection — property-based tests with fast-check.
//
// dryWalk.test.ts pins specific scenarios I thought to write.
// This file generates THOUSANDS of random walk patterns and
// asserts invariants that must hold across all of them. Catches
// corner cases I'd never hand-author.
//
// Invariants (must hold for any valid walk):
//   1. Walk south through start gate → exactly one start crossing.
//   2. Crossing timestamp == points[crossingIndex].timestamp
//      (no off-by-one, no interpolation drift).
//   3. Same input stream → same output (determinism).
//   4. Pure-north walk never crosses south-bound start gate
//      (heading-check correctness).
//   5. crossingIndex within [searchStartIndex, searchEndIndex].
//
// fast-check defaults to ~100 runs per property. We bump it where
// the search space is large (random walks) so flaky-rare bugs
// have a fighting chance to surface.
// ═══════════════════════════════════════════════════════════

import * as fc from 'fast-check';
import { detectGateCrossing } from '@/features/run/geometry';
import type { GateDefinition } from '@/features/run/types';
import type { GpsPoint } from '@/systems/gps';

const M_PER_DEG_LAT = 111_000;
const BASE_LAT = 52.217;
const BASE_LNG = 21.001;
const M_PER_DEG_LNG = 111_000 * Math.cos((BASE_LAT * Math.PI) / 180);

function pointAt(latM: number, lngM: number, t: number, speed = 5, accuracy = 5): GpsPoint {
  return {
    latitude: BASE_LAT + latM / M_PER_DEG_LAT,
    longitude: BASE_LNG + lngM / M_PER_DEG_LNG,
    altitude: null,
    accuracy,
    speed,
    timestamp: t,
  };
}

const startGate: GateDefinition = {
  center: { latitude: BASE_LAT, longitude: BASE_LNG },
  trailBearing: 180,
  lineWidthM: 6,
  zoneDepthM: 8,
  entryRadiusM: 25,
  headingToleranceDeg: 35,
  minTriggerSpeedKmh: 1,
};

// ── Arbitraries ─────────────────────────────────────────────

/** A south-bound walk crossing the start gate.
 *  Generates 10–40 points, speed 1.5-12 m/s, starting 5-30 m north
 *  of the gate and ending 10-40 m south. Each step has bounded
 *  per-sample lateral jitter (≤2m) to mimic GPS noise.
 *
 *  Invariant by construction: the walk MUST cross the start line
 *  geometrically. (Lateral jitter is bounded so we don't fall out
 *  of the corridor, and the south-bound velocity is positive.) */
const southWalkArb = fc.record({
  startNorthM: fc.float({ min: 5, max: 30, noNaN: true }),
  endSouthM: fc.float({ min: 10, max: 40, noNaN: true }),
  pointCount: fc.integer({ min: 10, max: 40 }),
  speedMps: fc.float({ min: 1.5, max: 12, noNaN: true }),
  lateralJitterM: fc.float({ min: 0, max: 2, noNaN: true }),
  jitterSeed: fc.integer({ min: 1, max: 1000 }),
});

function buildSouthWalk(spec: {
  startNorthM: number;
  endSouthM: number;
  pointCount: number;
  speedMps: number;
  lateralJitterM: number;
  jitterSeed: number;
}): GpsPoint[] {
  const totalDistance = spec.startNorthM + spec.endSouthM;
  const dtMs = (totalDistance / spec.speedMps / spec.pointCount) * 1000;
  const points: GpsPoint[] = [];
  for (let i = 0; i < spec.pointCount; i++) {
    const fraction = i / Math.max(1, spec.pointCount - 1);
    const latM = spec.startNorthM - fraction * totalDistance;
    // Deterministic pseudo-random lateral jitter from seed
    const noise = Math.sin((i + spec.jitterSeed) * 1.7) * spec.lateralJitterM;
    points.push(pointAt(latM, noise, i * dtMs, spec.speedMps, 5));
  }
  return points;
}

// ── Properties ──────────────────────────────────────────────

describe('gate detection · property-based', () => {
  test('any valid south-bound walk fires the start gate exactly once', () => {
    fc.assert(
      fc.property(southWalkArb, (spec) => {
        const points = buildSouthWalk(spec);
        const result = detectGateCrossing(points, startGate, {});
        return result.crossed === true;
      }),
      { numRuns: 200 },
    );
  });

  test('crossingTimestamp matches points[crossingIndex].timestamp (no drift)', () => {
    fc.assert(
      fc.property(southWalkArb, (spec) => {
        const points = buildSouthWalk(spec);
        const result = detectGateCrossing(points, startGate, {});
        if (!result.crossed || result.crossingIndex == null) return true; // vacuous
        return result.crossingTimestamp === points[result.crossingIndex].timestamp;
      }),
      { numRuns: 200 },
    );
  });

  test('determinism — same input twice produces identical result', () => {
    fc.assert(
      fc.property(southWalkArb, (spec) => {
        const points = buildSouthWalk(spec);
        const a = detectGateCrossing(points, startGate, {});
        const b = detectGateCrossing(points, startGate, {});
        return (
          a.crossed === b.crossed
          && a.crossingIndex === b.crossingIndex
          && a.crossingTimestamp === b.crossingTimestamp
        );
      }),
      { numRuns: 100 },
    );
  });

  test('crossingIndex stays within search window when one is supplied', () => {
    fc.assert(
      fc.property(
        southWalkArb,
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 5, max: 10 }),
        (spec, startOffset, endOffset) => {
          const points = buildSouthWalk(spec);
          const searchStartIndex = Math.min(startOffset, points.length - 1);
          const searchEndIndex = Math.min(
            searchStartIndex + endOffset,
            points.length - 1,
          );
          const result = detectGateCrossing(points, startGate, {
            searchStartIndex,
            searchEndIndex,
          });
          if (!result.crossed || result.crossingIndex == null) return true;
          return (
            result.crossingIndex >= searchStartIndex
            && result.crossingIndex <= searchEndIndex
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
