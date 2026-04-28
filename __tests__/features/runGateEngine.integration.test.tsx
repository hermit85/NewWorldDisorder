// ═══════════════════════════════════════════════════════════
// useRunGateEngine — integration test through the React hook.
//
// The pure-geometry tests in dryWalk.test.ts cover detectGateCrossing
// in isolation. THIS test mounts the full hook and drives it with
// synthetic GPS samples to verify the engine-layer state machine:
//
//   - onStartCrossing fires exactly once when start gate is crossed
//   - onFinishCrossing fires exactly once after start (and only after
//     unlock thresholds are met)
//   - directional progress guard rejects standstill at the gate
//     (B23.2 lineage — iPhone 13 walk-test crash that drove the
//      directional-progress refactor)
//   - reset() returns the engine to idle so a fresh attempt can fire
//
// "Real" dry-walk: closest we get to physical hardware without a
// device. Catches engine-layer regressions that detectGateCrossing
// alone would miss.
// ═══════════════════════════════════════════════════════════

import { renderHook } from '../helpers/renderHook';
import { useRunGateEngine } from '@/features/run/useRunGateEngine';
import type { GateEngineCallbacks } from '@/features/run/useRunGateEngine';
import type { TrailGateConfig, GateCrossingResult } from '@/features/run/types';
import type { GpsPoint } from '@/systems/gps';

// ── Synthetic geometry ──────────────────────────────────────
// 100 m straight south-bound trail. Slotwiny-ish anchor for
// realistic numbers (matches dryWalk.test.ts so we don't drift).

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

const TRAIL_CONFIG: TrailGateConfig = {
  trailId: 'synthetic-trail',
  trailName: 'Synthetic',
  expectedLengthM: 100,
  finishUnlockMinTimeSec: 5,
  finishUnlockMinDistanceM: 50,
  minDurationSec: 5,
  minDistanceFraction: 0.5,
  startGate: {
    center: { latitude: BASE_LAT, longitude: BASE_LNG },
    trailBearing: 180,
    lineWidthM: 6,
    zoneDepthM: 8,
    entryRadiusM: 25,
    headingToleranceDeg: 35,
    minTriggerSpeedKmh: 1,
  },
  finishGate: {
    center: { latitude: BASE_LAT - 100 / M_PER_DEG_LAT, longitude: BASE_LNG },
    trailBearing: 180,
    lineWidthM: 6,
    zoneDepthM: 8,
    entryRadiusM: 25,
    headingToleranceDeg: 35,
    minTriggerSpeedKmh: 1,
  },
};

// ── Helpers ─────────────────────────────────────────────────

interface CallbackSpy {
  startCrossings: GateCrossingResult[];
  finishCrossings: GateCrossingResult[];
  callbacks: GateEngineCallbacks;
}

function makeSpy(): CallbackSpy {
  const startCrossings: GateCrossingResult[] = [];
  const finishCrossings: GateCrossingResult[] = [];
  return {
    startCrossings,
    finishCrossings,
    callbacks: {
      onStartCrossing: (c) => { startCrossings.push(c); },
      onFinishCrossing: (c) => { finishCrossings.push(c); },
    },
  };
}

function mountEngine(spy: CallbackSpy) {
  return renderHook(() => useRunGateEngine(TRAIL_CONFIG, spy.callbacks));
}

// ── Tests ───────────────────────────────────────────────────

describe('useRunGateEngine — integration / dry-walk', () => {
  test('happy path: 5 m/s south, fires onStart then onFinish', () => {
    const spy = makeSpy();
    const { result } = mountEngine(spy);
    const engine = result.current;

    // Simulate the orchestrator: armed before crossing the start
    // line, transitions to running once the start callback fires.
    let isRunning = false;
    let firstCheckpointHit = false;

    // 24 ticks × 5 m/s south. Start at +10m north, end at -110m.
    // Start gate fires around tick 2; finish around tick 22.
    for (let i = 0; i < 24; i++) {
      const point = pointAt(10 - i * 5, 0, i * 1000);
      // Once start crosses, flip the orchestrator into running mode
      // — the hook expects this transition from its parent.
      if (spy.startCrossings.length > 0 && !isRunning) {
        isRunning = true;
        firstCheckpointHit = true;
      }
      engine.processPoint(point, isRunning, !isRunning, firstCheckpointHit);
    }

    expect(spy.startCrossings).toHaveLength(1);
    expect(spy.finishCrossings).toHaveLength(1);

    // Run time = finish.timestamp - start.timestamp ≈ 20s for 100m at 5m/s.
    const runMs =
      (spy.finishCrossings[0].crossingTimestamp ?? 0)
      - (spy.startCrossings[0].crossingTimestamp ?? 0);
    expect(runMs).toBeGreaterThanOrEqual(15_000);
    expect(runMs).toBeLessThanOrEqual(25_000);
  });

  test('standstill at gate: directional progress guard rejects soft crossing', () => {
    const spy = makeSpy();
    const { result } = mountEngine(spy);
    const engine = result.current;

    // 15 ticks parked at +5 m north of start gate, jittery but
    // never moving south. The pure detectGateCrossing returns
    // soft_crossing here (rider in zone), but the engine layer's
    // directional-progress check should reject it.
    for (let i = 0; i < 15; i++) {
      const jitter = Math.sin(i * 1.7) * 1.5;
      const point = pointAt(5 + jitter, jitter, i * 1000, 0, 5);
      engine.processPoint(point, false, true, false);
    }

    expect(spy.startCrossings).toHaveLength(0);
  });

  test('reset() returns engine to idle — next stream can fire again', () => {
    const spy = makeSpy();
    const { result } = mountEngine(spy);
    const engine = result.current;

    // First attempt: cross both gates.
    let isRunning = false;
    for (let i = 0; i < 24; i++) {
      const point = pointAt(10 - i * 5, 0, i * 1000);
      if (spy.startCrossings.length > 0) isRunning = true;
      engine.processPoint(point, isRunning, !isRunning, isRunning);
    }
    expect(spy.startCrossings).toHaveLength(1);
    expect(spy.finishCrossings).toHaveLength(1);

    // Reset — fresh attempt should fire fresh callbacks.
    engine.reset();
    isRunning = false;

    // Second attempt with offset timestamps so they don't dedupe.
    for (let i = 0; i < 24; i++) {
      const point = pointAt(10 - i * 5, 0, 100_000 + i * 1000);
      if (spy.startCrossings.length > 1) isRunning = true;
      engine.processPoint(point, isRunning, !isRunning, isRunning);
    }
    expect(spy.startCrossings).toHaveLength(2);
    expect(spy.finishCrossings).toHaveLength(2);
  });

  test('finish lockout: cannot fire before minDurationSec elapsed', () => {
    const spy = makeSpy();
    const { result } = mountEngine(spy);
    const engine = result.current;

    // Speed-run scenario: rider teleports through both gates with
    // only 2 seconds elapsed (well under the 5s lockout). The hook
    // should fire onStart but NOT onFinish.
    let isRunning = false;
    for (let i = 0; i < 6; i++) {
      // Two-second total span: i * 400ms, going from +5m to -105m.
      // Step is 22m per tick — unrealistic, simulating a cheat.
      const latM = 5 - i * 22;
      const point = pointAt(latM, 0, i * 400, 50, 5);
      if (spy.startCrossings.length > 0) isRunning = true;
      engine.processPoint(point, isRunning, !isRunning, isRunning);
    }

    expect(spy.startCrossings).toHaveLength(1);
    // Finish must be locked out by minDurationSec=5 (we only had 2s).
    expect(spy.finishCrossings).toHaveLength(0);
  });
});
