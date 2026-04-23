// ═══════════════════════════════════════════════════════════
// approachNavigator.test.ts — 5-state machine coverage
//
// Strategy: build a synthetic start gate centered at a known lat/lng
// with a known trail bearing, then drive the pure function with
// carefully-placed user positions. Distance assertions use
// toBeCloseTo with loose precision because geodesic math produces
// sub-meter drift at these scales.
// ═══════════════════════════════════════════════════════════

import { computeApproachState } from './approachNavigator';
import type { TrailGateConfig } from './types';

// ── Test fixture ──

const GATE_CENTER = { latitude: 50.0, longitude: 20.0 };
const TRAIL_BEARING = 180; // trail heads south (downhill)

function buildGate(): TrailGateConfig {
  return {
    trailId: 'test-trail',
    trailName: 'Test Trail',
    expectedLengthM: 1000,
    finishUnlockMinTimeSec: 12,
    finishUnlockMinDistanceM: 250,
    minDurationSec: 30,
    minDistanceFraction: 0.7,
    startGate: {
      center: GATE_CENTER,
      trailBearing: TRAIL_BEARING,
      lineWidthM: 4,
      zoneDepthM: 8,
      entryRadiusM: 12,
      headingToleranceDeg: 60,
      minTriggerSpeedKmh: 2,
    },
    finishGate: {
      center: { latitude: 49.99, longitude: 20.0 },
      trailBearing: TRAIL_BEARING,
      lineWidthM: 4,
      zoneDepthM: 10,
      entryRadiusM: 14,
      headingToleranceDeg: 75,
      minTriggerSpeedKmh: 1.5,
    },
  };
}

/** One metre of latitude ≈ 1/111_000 of a degree. Enough precision for
 *  distance-bucket assertions (we use toBeCloseTo with ±2m tolerance). */
const DEG_PER_METER_LAT = 1 / 111_000;

function userNorthOfGate(meters: number) {
  return {
    latitude: GATE_CENTER.latitude + meters * DEG_PER_METER_LAT,
    longitude: GATE_CENTER.longitude,
  };
}

function userSouthOfGate(meters: number) {
  return {
    latitude: GATE_CENTER.latitude - meters * DEG_PER_METER_LAT,
    longitude: GATE_CENTER.longitude,
  };
}

// ── GPS quality gate (highest precedence) ──

describe('computeApproachState — gps_unsure overrides everything', () => {
  it('returns gps_unsure only when accuracy exceeds APPROACH_UNSURE_ACCURACY_M (20m)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1), // on the line
      userHeading: 180,
      userAccuracyM: 25,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('gps_unsure');
    if (state.kind === 'gps_unsure') expect(state.accuracyM).toBe(25);
  });

  it('returns gps_unsure even when user is far (beats FAR state)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(100),
      userHeading: 180,
      userAccuracyM: 40,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('gps_unsure');
  });

  it('urban-GPS accuracy (7m) no longer blocks the navigator UI', () => {
    // Field test B20: riders at GOTOWY with ±7-10m accuracy kept falling
    // through to gps_unsure, which hid the start guidance entirely.
    // Navigator threshold is now 20m; gate engine still uses 5m for its
    // own crossing-quality assessment.
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 180,
      userAccuracyM: 7,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });
    expect(state.kind).toBe('on_line_ready');
  });

  it('boundary: accuracy 20m exactly does NOT trigger gps_unsure', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 180,
      userAccuracyM: 20,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });
    expect(state.kind).toBe('on_line_ready');
  });

  it('boundary: accuracy 20.1m triggers gps_unsure', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 180,
      userAccuracyM: 20.1,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });
    expect(state.kind).toBe('gps_unsure');
  });
});

// ── FAR state ──

describe('computeApproachState — far', () => {
  it('returns far when user is well beyond NEAR threshold', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(100),
      userHeading: 180,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('far');
    if (state.kind === 'far') {
      expect(state.distanceM).toBeCloseTo(100, -1); // within 10m
      // User is north of gate, so bearing to gate (which is south) ≈ 180°
      expect(state.bearingToStart).toBeCloseTo(180, 0);
    }
  });

  it('returns far at 31m (just past NEAR threshold of 30)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(31),
      userHeading: 180,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('far');
  });

  it('transitions to near just inside the 30m boundary (29.5m lat offset)', () => {
    // Use 0.5m safety margin — great-circle distance from a lat-only
    // offset drifts sub-meter past the nominal distance we dialed in,
    // so "exactly 30m" can read as 30.005m and flip to far. 29.5m gives
    // us a reliable "just inside" probe.
    const state = computeApproachState({
      userPosition: userNorthOfGate(29.5),
      userHeading: 180,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('near');
  });

  it('bearing points roughly east when user is west of gate', () => {
    const state = computeApproachState({
      userPosition: {
        latitude: GATE_CENTER.latitude,
        longitude: GATE_CENTER.longitude - 100 * DEG_PER_METER_LAT,
      },
      userHeading: null,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('far');
    if (state.kind === 'far') {
      // User west of gate → bearing to gate ≈ 90° (east). Allow 5° slack.
      expect(state.bearingToStart).toBeGreaterThan(85);
      expect(state.bearingToStart).toBeLessThan(95);
    }
  });
});

// ── NEAR state ──

describe('computeApproachState — near', () => {
  it('returns near at 15m with aligned heading', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(15),
      userHeading: 180, // aligned with trail bearing
      userAccuracyM: 3,
      userVelocityMps: 0.5,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('near');
    if (state.kind === 'near') {
      expect(state.distanceM).toBeCloseTo(15, -1);
      expect(state.headingDeltaDeg).toBeCloseTo(0, 0);
    }
  });

  it('returns near when compass is null (heading delta defaults to 0)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(10),
      userHeading: null,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('near');
    if (state.kind === 'near') expect(state.headingDeltaDeg).toBe(0);
  });

  it('reports large headingDelta when user faces against the trail', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(10),
      userHeading: 0, // opposite of 180 trailBearing → delta 180
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('near');
    if (state.kind === 'near') expect(state.headingDeltaDeg).toBeCloseTo(180, 0);
  });

  it('transitions to on_line_ready just inside the 3m boundary (2.5m lat offset)', () => {
    // Same sub-meter great-circle drift rationale as the 30m boundary
    // test — 2.5m gives us a reliable "just inside" probe.
    const state = computeApproachState({
      userPosition: userNorthOfGate(2.5),
      userHeading: 180,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('on_line_ready');
  });
});

// ── ON_LINE_READY state ──

describe('computeApproachState — on_line_ready', () => {
  it('arms when inside 3m with heading aligned and good accuracy', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(2),
      userHeading: 180,
      userAccuracyM: 4,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('on_line_ready');
    if (state.kind === 'on_line_ready') expect(state.accuracyM).toBe(4);
  });

  it('arms when heading is unknown (optimistic at <3m)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: null,
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('on_line_ready');
  });

  it('arms at boundary heading delta of exactly 60° (tolerance inclusive)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 120, // 120 vs 180 = delta 60
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    // 60 > 60 is false → not wrong_side → on_line_ready
    expect(state.kind).toBe('on_line_ready');
  });

  it('is not gated by velocity (velocity is a downstream gate engine concern)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 180,
      userAccuracyM: 3,
      userVelocityMps: 0, // stationary rider
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('on_line_ready');
  });
});

// ── WRONG_SIDE state ──

describe('computeApproachState — wrong_side', () => {
  it('detects wrong side when facing directly opposite trail direction', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 0, // facing north, trail heads south (180) → delta 180
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('wrong_side');
    if (state.kind === 'wrong_side') {
      expect(state.bearingExpected).toBe(180);
      expect(state.headingActual).toBe(0);
    }
  });

  it('detects wrong side at exactly 61° delta (just past tolerance)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 119, // 119 vs 180 = delta 61
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('wrong_side');
  });

  it('wrong side arming requires being inside the 3m radius (fails at 4m)', () => {
    const state = computeApproachState({
      userPosition: userNorthOfGate(4),
      userHeading: 0, // definitely wrong way
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    // At 4m we're in NEAR, not inside the wrong_side check
    expect(state.kind).toBe('near');
  });
});

// ── Cross-cutting sanity ──

describe('computeApproachState — cross-cutting', () => {
  it('handles user approaching from the downhill side (south of gate)', () => {
    // User south of gate, trail bearing 180 (also south). User is "past"
    // the gate geographically. Distance matters more than side here —
    // approach navigator does not preclude approaching from downhill;
    // gate engine's correct-side check handles that case later.
    const state = computeApproachState({
      userPosition: userSouthOfGate(50),
      userHeading: 0, // facing north (uphill)
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: buildGate(),
    });

    expect(state.kind).toBe('far');
  });

  it('reacts to new gate bearing when trail geometry differs', () => {
    const gate = buildGate();
    gate.startGate.trailBearing = 90; // trail heads east instead of south

    const state = computeApproachState({
      userPosition: userNorthOfGate(1),
      userHeading: 90, // aligned with new east bearing
      userAccuracyM: 3,
      userVelocityMps: 0,
      trailGate: gate,
    });

    expect(state.kind).toBe('on_line_ready');
  });
});
