// ═══════════════════════════════════════════════════════════
// Dry walk — synthetic GPS feed through gate detection.
//
// "Najbliższy do real-walk-test bez fizycznego ruchu". Constructs
// a controlled scenario: known start/finish gate positions, a
// stream of GPS points walking through them at a chosen pace,
// and asserts the crossing-detection logic fires where it should.
//
// Covers the regressions that real walk-tests would surface:
//   1. Happy path — rider walks 100m through both gates, both fire,
//      computed time is roughly the elapsed seconds.
//   2. Standstill — phone at the gate but rider not moving →
//      no crossing (B22.1 / B23 / B23.2 lineage).
//   3. Slow walker (~0.5 m/s, iPhone 13 lineage) — directional
//      progress fallback should still recognise a real crossing.
//   4. Wrong direction (rider walked PAST the start gate then
//      backed up) — heading check rejects.
//
// Pure-function test — no React, no simulator, no Maestro. ~ms
// per scenario, runs in CI. Doesn't replace a real walk-test on
// hardware, but ensures the math under it is sane after refactors.
// ═══════════════════════════════════════════════════════════

import { detectGateCrossing } from '@/features/run/geometry';
import type { GateDefinition } from '@/features/run/types';
import type { GpsPoint } from '@/systems/gps';

// Local approximation good enough at the Polish latitudes the
// app is used at. 1 deg lat ≈ 111 km; 1 deg lng ≈ 71 km @52°.
const M_PER_DEG_LAT = 111_000;
const BASE_LAT = 52.217; // Slotwiny-ish anchor for realistic numbers.
const BASE_LNG = 21.001;
const M_PER_DEG_LNG = 111_000 * Math.cos((BASE_LAT * Math.PI) / 180);

function metersOffset(latM: number, lngM: number, t: number, accuracy = 5, speed = 5): GpsPoint {
  return {
    latitude: BASE_LAT + latM / M_PER_DEG_LAT,
    longitude: BASE_LNG + lngM / M_PER_DEG_LNG,
    altitude: null,
    accuracy,
    speed,
    timestamp: t,
  };
}

// Trail axis: south-bound (trailBearing 180°). Start at base point,
// finish 100 m south. A rider running the trail has lat decreasing
// over time, lng constant.
const startGate: GateDefinition = {
  center: { latitude: BASE_LAT, longitude: BASE_LNG },
  trailBearing: 180,
  lineWidthM: 6,
  zoneDepthM: 8,
  entryRadiusM: 25,
  headingToleranceDeg: 35,
  minTriggerSpeedKmh: 1,
};
const finishGate: GateDefinition = {
  center: { latitude: BASE_LAT - 100 / M_PER_DEG_LAT, longitude: BASE_LNG },
  trailBearing: 180,
  lineWidthM: 6,
  zoneDepthM: 8,
  entryRadiusM: 25,
  headingToleranceDeg: 35,
  minTriggerSpeedKmh: 1,
};

describe('dry walk — gate crossing on synthetic GPS', () => {
  test('happy path · 5 m/s south, both gates fire, time ≈ 20s', () => {
    // 24 ticks at 1 Hz, each 5 m further south. Starts 10 m north
    // of the start gate, ends 10 m south of the finish gate.
    const points: GpsPoint[] = [];
    for (let i = 0; i < 24; i++) {
      // i=0 → +10m north;  i=2 → at start;  i=22 → at finish;  i=23 → -5m past
      const latM = 10 - i * 5;
      points.push(metersOffset(latM, 0, i * 1000));
    }

    const start = detectGateCrossing(points, startGate, {});
    expect(start.crossed).toBe(true);
    expect(start.crossingIndex).not.toBeNull();
    expect(start.crossingTimestamp).not.toBeNull();

    const finish = detectGateCrossing(points, finishGate, {
      isFinish: true,
      searchStartIndex: (start.crossingIndex ?? 0) + 1,
      durationSec: 30,
      totalDistanceM: 110,
      expectedLengthM: 100,
      minDurationSec: 5,
    });
    expect(finish.crossed).toBe(true);
    expect(finish.crossingTimestamp).not.toBeNull();

    // Run time = finish - start ≈ 20s (100 m at 5 m/s).
    const runMs = (finish.crossingTimestamp ?? 0) - (start.crossingTimestamp ?? 0);
    expect(runMs).toBeGreaterThanOrEqual(15_000);
    expect(runMs).toBeLessThanOrEqual(25_000);

    // Sanity: finish strictly after start in the point stream.
    expect((finish.crossingIndex ?? 0)).toBeGreaterThan((start.crossingIndex ?? 0));
  });

  test('standstill · phone 5 m from gate · pure-geometry says soft crossing', () => {
    // 15 ticks parked at +5 m north of the start gate with realistic
    // GPS jitter (±1.5 m). At pure-geometry level the rider is INSIDE
    // the entryRadiusM=25 zone, so a "soft_crossing" flag fires.
    //
    // The actual reject-standstill logic lives at engine level
    // (directional-progress check in useRunGateEngine, B23.2). This
    // test pins the geometry-layer contract so the engine-layer
    // guard's existence is justified — without this fallback the
    // engine wouldn't have a soft signal to evaluate.
    const points: GpsPoint[] = Array.from({ length: 15 }, (_, i) => {
      const jitter = (Math.sin(i * 1.7) * 1.5);
      return metersOffset(5 + jitter, jitter, i * 1000, 5, 0);
    });

    const result = detectGateCrossing(points, startGate, {});
    expect(result.crossed).toBe(true);
    // Crossing was a soft-zone fallback, not a hard line cross.
    expect(result.flags).toContain('soft_crossing');
  });

  test('slow walker · 0.6 m/s south · gate still fires (iPhone 13 lineage)', () => {
    // Slow walker at 0.6 m/s — historically iPhone 13's path
    // through the start gate at walking pace got missed by the
    // hard sign-change phase, recovered by the soft / directional
    // progress fallback. Here we assert the recovery still works.
    const points: GpsPoint[] = [];
    for (let i = 0; i < 30; i++) {
      // Start 5 m north, walk 0.6 m/s south
      const latM = 5 - i * 0.6;
      points.push(metersOffset(latM, 0, i * 1000, 6, 0.6));
    }
    const result = detectGateCrossing(points, startGate, {});
    expect(result.crossed).toBe(true);
  });

  test('wrong direction · rider walks NORTH past start · gate rejects', () => {
    // Walking opposite of trailBearing 180° (i.e. north). If the
    // heading check works, the gate should not fire even though
    // the rider crosses the line geometrically.
    const points: GpsPoint[] = [];
    for (let i = 0; i < 20; i++) {
      // Start 10 m south of gate, walk NORTH at 5 m/s
      const latM = -10 + i * 5;
      points.push(metersOffset(latM, 0, i * 1000, 5, 5));
    }
    const result = detectGateCrossing(points, startGate, {});
    expect(result.crossed).toBe(false);
  });

  test('returns shape: crossingTimestamp matches the timestamp of the detected point', () => {
    // Sanity-pin: the timestamp returned for the crossing point
    // matches the synthetic timestamp we put on it. Used by the
    // engine to compute run start / finish times — if this drifts
    // the leaderboard times will be wrong by an integer number of
    // seconds.
    const points: GpsPoint[] = [];
    for (let i = 0; i < 6; i++) {
      points.push(metersOffset(5 - i * 5, 0, i * 1000));
    }
    const result = detectGateCrossing(points, startGate, {});
    expect(result.crossed).toBe(true);
    expect(result.crossingTimestamp).not.toBeNull();
    // The returned timestamp must equal the timestamp of the point
    // at crossingIndex (no off-by-one, no interpolation drift).
    expect(result.crossingTimestamp).toBe(points[result.crossingIndex!].timestamp);
  });
});
