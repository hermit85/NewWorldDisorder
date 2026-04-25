import React, { forwardRef, useImperativeHandle } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { buildTrailGateConfigFromPioneer, buildTrailGeoFromPioneer } from '@/features/run/gates';
import { detectGateCrossing, headingDifference } from '@/features/run/geometry';
import { GateEngine, getFinishGateLockoutReason, useRunGateEngine } from '@/features/run/useRunGateEngine';
import { TrailGateConfig } from '@/features/run/types';
import { PioneerGeometry, normalizeRunRow } from '@/lib/api';
import { finalizeRun } from '@/systems/runFinalization';
import { distanceMeters, GpsPoint } from '@/systems/gps';
import { RunTrace } from '@/systems/traceCapture';
import { DbRun } from '@/lib/database.types';

type MeterPoint = { eastM: number; northM: number; alt: number };

const A_TO_B_FIRST = { t: 6.36, alt: 147.26, lat: 52.21722027, lng: 21.00130304 };
const A_TO_B_LAST = { t: 102.27, alt: 147.01, lat: 52.21735155, lng: 21.00358976 };

const LOOP_FIRST = { t: 0.05, alt: 151.52, lat: 52.21778034, lng: 21.00120678 };
const LOOP_LAST = { t: 189.99, alt: 148.18, lat: 52.21783255, lng: 21.00123494 };

const EARTH_METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return EARTH_METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

function toLatLng(origin: { lat: number; lng: number }, eastM: number, northM: number) {
  return {
    lat: origin.lat + northM / EARTH_METERS_PER_DEG_LAT,
    lng: origin.lng + eastM / metersPerDegLng(origin.lat),
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function interpolatePolyline(
  origin: { lat: number; lng: number },
  anchors: MeterPoint[],
  count: number,
  tStart: number,
  tEnd: number,
): PioneerGeometry['points'] {
  const segments = anchors.length - 1;
  const points: PioneerGeometry['points'] = [];

  for (let i = 0; i < count; i++) {
    const progress = count === 1 ? 0 : i / (count - 1);
    const scaled = progress * segments;
    const segmentIndex = Math.min(segments - 1, Math.floor(scaled));
    const localT = scaled - segmentIndex;
    const from = anchors[segmentIndex];
    const to = anchors[segmentIndex + 1];
    const baseEast = lerp(from.eastM, to.eastM, localT);
    const baseNorth = lerp(from.northM, to.northM, localT);
    const dx = to.eastM - from.eastM;
    const dy = to.northM - from.northM;
    const length = Math.hypot(dx, dy) || 1;
    const normalEast = -dy / length;
    const normalNorth = dx / length;
    const jitter = i === 0 || i === count - 1 ? 0 : Math.sin(i * 0.67) * 1.6;
    const { lat, lng } = toLatLng(
      origin,
      baseEast + normalEast * jitter,
      baseNorth + normalNorth * jitter,
    );

    points.push({
      t: Number(lerp(tStart, tEnd, progress).toFixed(2)),
      alt: Number(lerp(from.alt, to.alt, localT).toFixed(2)),
      lat,
      lng,
    });
  }

  return points;
}

function computeTotalDistanceM(points: PioneerGeometry['points']): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += distanceMeters(
      { latitude: points[i - 1].lat, longitude: points[i - 1].lng },
      { latitude: points[i].lat, longitude: points[i].lng },
    );
  }
  return total;
}

function makeGeometryFixture(
  first: typeof A_TO_B_FIRST,
  last: typeof A_TO_B_LAST,
  anchors: MeterPoint[],
  pointCount: number,
): PioneerGeometry {
  const points = interpolatePolyline(
    { lat: first.lat, lng: first.lng },
    anchors,
    pointCount,
    first.t,
    last.t,
  );
  points[0] = { ...first };
  points[points.length - 1] = { ...last };

  return {
    version: 1,
    points,
    meta: {
      totalDistanceM: Number(computeTotalDistanceM(points).toFixed(1)),
      totalDescentM: Number(Math.max(0, (first.alt ?? 0) - (last.alt ?? 0)).toFixed(1)),
      durationS: Number((last.t - first.t).toFixed(2)),
      medianAccuracyM: 6,
    },
  };
}

const aToBGeometry = makeGeometryFixture(
  A_TO_B_FIRST,
  A_TO_B_LAST,
  [
    { eastM: 0, northM: 0, alt: A_TO_B_FIRST.alt },
    { eastM: 45, northM: 4, alt: 147.22 },
    { eastM: 95, northM: -3, alt: 147.18 },
    { eastM: 145, northM: 12, alt: 147.09 },
    {
      eastM: (A_TO_B_LAST.lng - A_TO_B_FIRST.lng) * metersPerDegLng(A_TO_B_FIRST.lat),
      northM: (A_TO_B_LAST.lat - A_TO_B_FIRST.lat) * EARTH_METERS_PER_DEG_LAT,
      alt: A_TO_B_LAST.alt,
    },
  ],
  28,
);

const loopGeometry = makeGeometryFixture(
  LOOP_FIRST,
  LOOP_LAST,
  [
    { eastM: 0, northM: 0, alt: LOOP_FIRST.alt },
    { eastM: 50, northM: 4, alt: 151.2 },
    { eastM: 95, northM: -45, alt: 150.4 },
    { eastM: 55, northM: -110, alt: 149.4 },
    { eastM: -25, northM: -120, alt: 148.9 },
    { eastM: -10, northM: -70, alt: 148.5 },
    {
      eastM: (LOOP_LAST.lng - LOOP_FIRST.lng) * metersPerDegLng(LOOP_FIRST.lat),
      northM: (LOOP_LAST.lat - LOOP_FIRST.lat) * EARTH_METERS_PER_DEG_LAT,
      alt: LOOP_LAST.alt,
    },
  ],
  55,
);

function buildGpsPointsFromGeometry(
  geometry: PioneerGeometry,
  accuracy = 8,
): GpsPoint[] {
  return geometry.points.map((point) => ({
    latitude: point.lat,
    longitude: point.lng,
    altitude: point.alt ?? null,
    accuracy,
    speed: 6,
    timestamp: Math.round(point.t * 1000),
  }));
}

function pointFromGate(
  gate: TrailGateConfig['startGate'],
  alongM: number,
  lateralM: number,
  timestamp: number,
): GpsPoint {
  const bearingRad = (gate.trailBearing * Math.PI) / 180;
  const eastM = Math.sin(bearingRad) * alongM + Math.sin(bearingRad + Math.PI / 2) * lateralM;
  const northM = Math.cos(bearingRad) * alongM + Math.cos(bearingRad + Math.PI / 2) * lateralM;
  const { lat, lng } = toLatLng(
    { lat: gate.center.latitude, lng: gate.center.longitude },
    eastM,
    northM,
  );

  return {
    latitude: lat,
    longitude: lng,
    altitude: null,
    accuracy: 5,
    speed: 5,
    timestamp,
  };
}

function clonePoint(point: GpsPoint, overrides: Partial<GpsPoint>): GpsPoint {
  return { ...point, ...overrides };
}

function offsetTracePoint(
  point: GpsPoint,
  prev: GpsPoint | null,
  next: GpsPoint | null,
  offsetM: number,
): GpsPoint {
  const refNext = next ?? prev ?? point;
  const eastM = (refNext.longitude - point.longitude) * metersPerDegLng(point.latitude);
  const northM = (refNext.latitude - point.latitude) * EARTH_METERS_PER_DEG_LAT;
  const length = Math.hypot(eastM, northM) || 1;
  const normalEast = -northM / length;
  const normalNorth = eastM / length;
  const { lat, lng } = toLatLng(
    { lat: point.latitude, lng: point.longitude },
    normalEast * offsetM,
    normalNorth * offsetM,
  );

  return {
    ...point,
    latitude: lat,
    longitude: lng,
  };
}

function makeTrace(
  trailId: string,
  trailName: string,
  mode: RunTrace['mode'],
  points: GpsPoint[],
): RunTrace {
  const lastPoint = points[points.length - 1];
  return {
    id: `trace-${trailId}-${mode}`,
    trailId,
    trailName,
    mode,
    startedAt: points[0]?.timestamp ?? 0,
    finishedAt: lastPoint?.timestamp ?? 0,
    durationMs: (lastPoint?.timestamp ?? 0) - (points[0]?.timestamp ?? 0),
    points,
    verification: null,
    createdAt: points[0]?.timestamp ?? 0,
  };
}

function makeDbRun(
  verificationStatus: DbRun['verification_status'],
  verificationSummary: Record<string, unknown>,
): DbRun {
  return {
    id: 'run-1',
    user_id: 'user-1',
    trail_id: 'trail-1',
    spot_id: 'spot-1',
    mode: 'ranked',
    started_at: new Date(0).toISOString(),
    finished_at: new Date(1000).toISOString(),
    duration_ms: 1000,
    verification_status: verificationStatus,
    verification_summary: verificationSummary as DbRun['verification_summary'],
    gps_trace: null,
    counted_in_leaderboard: verificationStatus === 'verified',
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
    xp_awarded: 0,
    is_pb: false,
    // Added when leaderboard_entries got version-pinned
    // (mig 20260428000000). Tests don't exercise the version path here,
    // but the field is non-null in the new Row type so we keep parity.
    trail_version_id: null,
  } as DbRun;
}

const GateEngineHarness = forwardRef<
  GateEngine,
  {
    config: TrailGateConfig;
    onStartCrossing: (payload: unknown) => void;
    onFinishCrossing: (payload: unknown) => void;
  }
>(({ config, onStartCrossing, onFinishCrossing }, ref) => {
  const engine = useRunGateEngine(config, {
    onStartCrossing,
    onFinishCrossing,
  });
  useImperativeHandle(ref, () => engine, [engine]);
  return null;
});

function renderGateEngine(config: TrailGateConfig) {
  const startCalls: unknown[] = [];
  const finishCalls: unknown[] = [];
  const ref = React.createRef<GateEngine>();
  let renderer: TestRenderer.ReactTestRenderer;

  act(() => {
    renderer = TestRenderer.create(React.createElement(GateEngineHarness, {
      ref,
      config,
      onStartCrossing: (payload: unknown) => startCalls.push(payload),
      onFinishCrossing: (payload: unknown) => finishCalls.push(payload),
    }));
  });

  return {
    engine: ref.current!,
    startCalls,
    finishCalls,
    unmount: () => {
      act(() => {
        renderer!.unmount();
      });
    },
  };
}

describe('Chunk 8 gate unification', () => {
  describe('Group 1 — buildTrailGateConfigFromGeom', () => {
    test('1.1 A→B trail generates valid runtime geo + gate config', () => {
      const geo = buildTrailGeoFromPioneer('linia-test-v1', aToBGeometry);
      const config = buildTrailGateConfigFromPioneer('linia-test-v1', 'Linia test v1', aToBGeometry);

      expect(geo).not.toBeNull();
      expect(geo?.startZone).toBeDefined();
      expect(geo?.finishZone).toBeDefined();
      expect(geo?.polyline.length).toBeGreaterThanOrEqual(10);
      expect(config).not.toBeNull();
      expect(Number.isFinite(config?.startGate.trailBearing)).toBe(true);
      expect(Number.isFinite(config?.finishGate.trailBearing)).toBe(true);
      expect(config!.startGate.trailBearing).toBeGreaterThan(70);
      expect(config!.startGate.trailBearing).toBeLessThan(110);
      expect(config!.finishGate.trailBearing).toBeGreaterThan(70);
      expect(config!.finishGate.trailBearing).toBeLessThan(110);
      expect(config!.finishUnlockMinDistanceM).toBe(
        Math.max(80, config!.expectedLengthM * 0.25),
      );
    });

    test('1.2 loop trail derives different start/finish bearings from entry/exit segments', () => {
      const geo = buildTrailGeoFromPioneer('test-background-v1', loopGeometry);
      const config = buildTrailGateConfigFromPioneer('test-background-v1', 'Test background v1', loopGeometry);

      expect(geo).not.toBeNull();
      expect(config).not.toBeNull();
      expect(Number.isFinite(config?.startGate.trailBearing)).toBe(true);
      expect(Number.isFinite(config?.finishGate.trailBearing)).toBe(true);
      expect(
        headingDifference(config!.startGate.trailBearing, config!.finishGate.trailBearing),
      ).toBeGreaterThan(40);
      expect(distanceMeters(geo!.startZone, geo!.finishZone)).toBeLessThan(8);
    });

    test('1.3 empty or malformed geometry returns null safely', () => {
      expect(buildTrailGeoFromPioneer('empty', null)).toBeNull();
      expect(buildTrailGateConfigFromPioneer('empty', 'Empty', null)).toBeNull();
      expect(
        buildTrailGateConfigFromPioneer('empty-points', 'Empty', {
          version: 1,
          points: [],
          meta: { totalDistanceM: 0, totalDescentM: 0, durationS: 0, medianAccuracyM: 0 },
        }),
      ).toBeNull();
      expect(
        buildTrailGateConfigFromPioneer('single-point', 'Single', {
          version: 1,
          points: [{ lat: 52.2, lng: 21.0, t: 1 }],
          meta: { totalDistanceM: 0, totalDescentM: 0, durationS: 0, medianAccuracyM: 0 },
        }),
      ).toBeNull();
      expect(
        buildTrailGateConfigFromPioneer('malformed', 'Malformed', {
          version: 1,
          points: [
            { lat: 52.2, lng: 21.0, t: 1 },
            { lat: Number.NaN, lng: 21.1, t: 2 },
            { lat: 52.2001, lng: 21.1001, t: 3 },
          ],
          meta: { totalDistanceM: 0, totalDescentM: 0, durationS: 0, medianAccuracyM: 0 },
        }),
      ).not.toBeNull();
      expect(
        buildTrailGateConfigFromPioneer('malformed-null', 'Malformed', {
          version: 1,
          points: [
            { lat: 52.2, lng: 21.0, t: 1 },
            { lat: Number.NaN, lng: 21.1, t: 2 },
          ],
          meta: { totalDistanceM: 0, totalDescentM: 0, durationS: 0, medianAccuracyM: 0 },
        }),
      ).toBeNull();
    });

    test('1.4 literal DB geometry works without static registry entries', () => {
      const config = buildTrailGateConfigFromPioneer('db-only-trail', 'DB only trail', {
        version: 1,
        points: [...aToBGeometry.points],
        meta: { ...aToBGeometry.meta },
      });

      expect(config).not.toBeNull();
      expect(config?.trailId).toBe('db-only-trail');
    });
  });

  describe('Group 2 — line crossing detection', () => {
    const config = buildTrailGateConfigFromPioneer('linia-test-v1', 'Linia test v1', aToBGeometry)!;
    const startGate = config.startGate;

    test('2.1 approach from correct side crosses start line', () => {
      const points = [
        pointFromGate(startGate, -5, 0, 1_000),
        pointFromGate(startGate, 5, 0, 2_000),
      ];

      const crossing = detectGateCrossing(points, startGate);

      expect(crossing.crossed).toBe(true);
      expect(crossing.correctSide).toBe(true);
      expect(crossing.crossingTimestamp).toBe(2_000);
    });

    test('2.2 approach from wrong side does not trigger start', () => {
      const points = [
        pointFromGate(startGate, 5, 0, 1_000),
        pointFromGate(startGate, -5, 0, 2_000),
      ];

      const crossing = detectGateCrossing(points, startGate);

      expect(crossing.crossed).toBe(false);
    });

    test('2.3 lateral glance near line does not trigger', () => {
      const points = [
        pointFromGate(startGate, 3, -4, 1_000),
        pointFromGate(startGate, 3, 4, 2_000),
      ];

      const crossing = detectGateCrossing(points, startGate);

      expect(crossing.crossed).toBe(false);
    });

    test('2.4 heading misalignment is flagged on an oblique crossing', () => {
      // Narrow gate (lineWidthM: 4) means the crossing has to stay
      // within ±2 m lateral to count as crossed. Tighten `along`
      // to 0.5 m so the vector's angle against the trail bearing
      // (≈63°) still trips poor_heading while both endpoints sit
      // comfortably inside the ±2 m line window.
      //
      // B22: the shared DEFAULT_START_GATE now uses 90° tolerance to
      // permit walk-test crossings, which is wider than the 63° oblique
      // angle here — the flag would no longer fire with production
      // thresholds. Override locally to the pre-B22 60° tolerance; the
      // intent of this test is to verify the flag mechanism, not the
      // threshold value (that's a separate production knob).
      const tightStartGate = { ...startGate, headingToleranceDeg: 60 };
      const points = [
        pointFromGate(tightStartGate, -0.5, -1, 1_000),
        pointFromGate(tightStartGate, 0.5, 1, 2_000),
      ];

      const crossing = detectGateCrossing(points, tightStartGate);

      expect(crossing.crossed).toBe(true);
      expect(crossing.flags).toContain('poor_heading');
    });
  });

  describe('Group 3 — loop finish lockout', () => {
    const config = buildTrailGateConfigFromPioneer('test-background-v1', 'Test background v1', loopGeometry)!;

    function startRun(engine: GateEngine) {
      act(() => {
        engine.processPoint(pointFromGate(config.startGate, -5, 0, 0), false, true, false);
        engine.processPoint(pointFromGate(config.startGate, 5, 0, 1_000), false, true, false);
      });
    }

    test('3.1 finish before 12s is blocked', () => {
      expect(getFinishGateLockoutReason(config, 8, 160, true)).toBe('time');

      const harness = renderGateEngine(config);
      startRun(harness.engine);

      act(() => {
        harness.engine.processPoint(pointFromGate(config.finishGate, 5, 0, 7_000), true, false, true);
        harness.engine.processPoint(pointFromGate(config.finishGate, -5, 0, 8_000), true, false, true);
      });

      expect(harness.startCalls).toHaveLength(1);
      expect(harness.finishCalls).toHaveLength(0);
      harness.unmount();
    });

    test('3.2 finish before minimum distance is blocked', () => {
      expect(getFinishGateLockoutReason(config, 15, 50, true)).toBe('distance');

      const harness = renderGateEngine(config);
      startRun(harness.engine);

      act(() => {
        harness.engine.processPoint(pointFromGate(config.finishGate, 4, 0, 14_000), true, false, true);
        harness.engine.processPoint(pointFromGate(config.finishGate, -4, 0, 15_000), true, false, true);
      });

      expect(harness.finishCalls).toHaveLength(0);
      harness.unmount();
    });

    test('3.3 finish before CP1 is blocked', () => {
      expect(getFinishGateLockoutReason(config, 15, 120, false)).toBe('checkpoint');

      const harness = renderGateEngine(config);
      startRun(harness.engine);

      act(() => {
        harness.engine.processPoint(pointFromGate(config.startGate, -40, 0, 7_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.startGate, -80, 0, 12_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.finishGate, 5, 0, 14_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.finishGate, -5, 0, 15_000), true, false, false);
      });

      expect(harness.finishCalls).toHaveLength(0);
      harness.unmount();
    });

    test('3.4 all 3 conditions met triggers finish', () => {
      expect(getFinishGateLockoutReason(config, 20, 150, true)).toBeNull();

      const harness = renderGateEngine(config);
      startRun(harness.engine);

      act(() => {
        harness.engine.processPoint(pointFromGate(config.startGate, -50, 0, 8_000), true, false, true);
        harness.engine.processPoint(pointFromGate(config.startGate, -100, 0, 14_000), true, false, true);
        harness.engine.processPoint(pointFromGate(config.finishGate, 5, 0, 19_000), true, false, true);
        harness.engine.processPoint(pointFromGate(config.finishGate, -5, 0, 20_000), true, false, true);
      });

      expect(harness.finishCalls).toHaveLength(1);
      harness.unmount();
    });

    test('3.5 loop insta-finish wobble near start is prevented', () => {
      const harness = renderGateEngine(config);
      startRun(harness.engine);

      act(() => {
        harness.engine.processPoint(pointFromGate(config.finishGate, 3, 2, 2_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.finishGate, -3, -2, 3_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.finishGate, 2, -1, 4_000), true, false, false);
        harness.engine.processPoint(pointFromGate(config.finishGate, -2, 1, 5_000), true, false, false);
      });

      expect(harness.finishCalls).toHaveLength(0);
      harness.unmount();
    });
  });

  describe('Group 4 — corridor_rescue strictness', () => {
    const lineGeo = buildTrailGeoFromPioneer('linia-test-v1', aToBGeometry)!;
    const lineGateConfig = buildTrailGateConfigFromPioneer('linia-test-v1', 'Linia test v1', aToBGeometry)!;
    const lineBasePoints = buildGpsPointsFromGeometry(aToBGeometry, 8);
    const loopGeoSeed = buildTrailGeoFromPioneer('test-background-v1', loopGeometry)!;
    const loopGateConfig = buildTrailGateConfigFromPioneer('test-background-v1', 'Test background v1', loopGeometry)!;
    const loopBasePoints = buildGpsPointsFromGeometry(loopGeometry, 8);

    function finalize(
      points: GpsPoint[],
      mode: RunTrace['mode'],
      gateStartCrossed: boolean,
      gateFinishCrossed: boolean,
      geo = lineGeo,
      gateConfig = lineGateConfig,
      trailId = 'linia-test-v1',
      trailName = 'Linia test v1',
    ) {
      return finalizeRun({
        trace: makeTrace(trailId, trailName, mode, points),
        geo,
        gateConfig,
        trailId,
        sessionId: 'session-1',
        gateStartCrossing: { crossed: gateStartCrossed, flags: [] },
        gateFinishCrossing: { crossed: gateFinishCrossed, flags: [] },
        assessQuality: () => ({
          quality: 'valid',
          degradationReasons: [],
          leaderboardEligible: true,
          summary: 'ok',
        }),
      });
    }

    test('4.1 happy path rescue upgrades missed gate to corridor_rescue', () => {
      const result = finalize(lineBasePoints, 'ranked', false, true);

      expect(result.verification.acceptedVia).toBe('corridor_rescue');
      expect(result.verification.status).toBe('verified');
      expect(result.finalEligible).toBe(true);
    });

    test('4.2 coverage 91% is blocked', () => {
      const degraded = loopBasePoints.map((point, index, all) => (
        index >= 20 && index <= 24
          ? offsetTracePoint(point, all[index - 1] ?? null, all[index + 1] ?? null, 60)
          : point
      ));
      const result = finalize(
        degraded,
        'ranked',
        false,
        true,
        loopGeoSeed,
        loopGateConfig,
        'test-background-v1',
        'Test background v1',
      );

      expect(result.verification.acceptedVia).toBeNull();
      expect(result.verification.status).toBe('outside_start_gate');
      expect(result.finalEligible).toBe(false);
    });

    test('4.3 max deviation 13m is blocked', () => {
      const degraded = lineBasePoints.map((point, index, all) => (
        index === Math.floor(all.length / 2)
          ? offsetTracePoint(point, all[index - 1] ?? null, all[index + 1] ?? null, 13)
          : point
      ));
      const result = finalize(degraded, 'ranked', false, true);

      expect(result.verification.acceptedVia).toBeNull();
      expect(result.finalEligible).toBe(false);
    });

    test('4.4 missing checkpoint is blocked', () => {
      const sparse = [lineBasePoints[0], lineBasePoints[7], lineBasePoints[21], lineBasePoints[27]];
      const result = finalize(sparse, 'ranked', false, true);

      expect(result.verification.checkpointsPassed).toBe(2);
      expect(result.verification.acceptedVia).toBeNull();
      expect(result.finalEligible).toBe(false);
    });

    test('4.5 distance ratio 1.2 is blocked', () => {
      const baseLastTimestamp = lineBasePoints[lineBasePoints.length - 1]!.timestamp;
      const extended = [...lineBasePoints, ...lineBasePoints.slice(-12, -1).reverse().map((point, index) => (
        clonePoint(point, { timestamp: baseLastTimestamp + ((index + 1) * 1_000) })
      ))];
      const result = finalize(extended, 'ranked', false, true);

      expect(result.verification.acceptedVia).toBeNull();
      expect(result.finalEligible).toBe(false);
    });

    test('4.6 rescue applies only to ranked mode', () => {
      const result = finalize(lineBasePoints, 'practice', false, true);

      expect(result.verification.acceptedVia).toBe('manual');
      expect(result.finalEligible).toBe(false);
    });

    test('4.7 rescue does not override route failure', () => {
      const shortcut = lineBasePoints.map((point, index, all) => (
        index === Math.floor(all.length / 2)
          ? offsetTracePoint(point, all[index - 1] ?? null, all[index + 1] ?? null, 180)
          : point
      ));
      const result = finalize(shortcut, 'ranked', true, true);

      expect(result.verification.status).toBe('shortcut_detected');
      expect(result.verification.acceptedVia).toBeNull();
      expect(result.finalEligible).toBe(false);
    });
  });

  describe('Group 5 — legacy runs backward compat', () => {
    test('5.1 legacy verified run defaults to gate_cross', () => {
      const normalized = normalizeRunRow(
        makeDbRun('verified', { startGate: { entered: true }, finishGate: { entered: true } }),
      );

      expect((normalized.verification_summary as Record<string, unknown>).acceptedVia).toBe('gate_cross');
    });

    test('5.2 legacy practice run defaults to manual', () => {
      const normalized = normalizeRunRow(
        makeDbRun('practice_only', { startGate: { entered: false }, finishGate: { entered: false } }),
      );

      expect((normalized.verification_summary as Record<string, unknown>).acceptedVia).toBe('manual');
    });

    test('5.3 explicit acceptedVia is preserved', () => {
      const normalized = normalizeRunRow(
        makeDbRun('verified', {
          startGate: { entered: false },
          finishGate: { entered: true },
          acceptedVia: 'corridor_rescue',
        }),
      );

      expect((normalized.verification_summary as Record<string, unknown>).acceptedVia).toBe('corridor_rescue');
    });
  });

  describe('Group 6 — B23.2 soft_crossing directional-progress guard', () => {
    // All three scenarios use only Phase 3 (soft_crossing). None of the
    // pre-arm or arm-phase samples cross the gate line (signedDist stays
    // positive the whole time), so Phase 1 cannot fire — Phase 3 is the
    // only path that could trigger a start.
    const config = buildTrailGateConfigFromPioneer(
      'linia-test-v1',
      'Linia test v1',
      aToBGeometry,
    )!;
    const startGate = config.startGate;
    const PROGRESS_THRESHOLD_M = 2;

    test('6.1 walk-in to gate then arm-and-stand does NOT trigger start (Codex P1: pre-arm samples excluded)', () => {
      // The bug before B23.2 final: rider walks to the gate, arms near the
      // line, stands still. The walk-in displacement leaked into the
      // motion-proof window, so soft_crossing fired as if the rider were
      // moving. B23.2 scopes the window to timestamps >= armedAt.
      const harness = renderGateEngine(config);

      act(() => {
        // Walk-in phase (isArmed=false): -10m → -2m over 3s
        harness.engine.processPoint(pointFromGate(startGate, -10, 0, 0), false, false, false);
        harness.engine.processPoint(pointFromGate(startGate, -7, 0, 1_000), false, false, false);
        harness.engine.processPoint(pointFromGate(startGate, -4, 0, 2_000), false, false, false);
        harness.engine.processPoint(pointFromGate(startGate, -2, 0, 3_000), false, false, false);
      });

      act(() => {
        // Arm at t=4000 and stand at -2m for 5s (well past the 3s window
        // minimum, so the guard definitely evaluates and sees zero progress).
        harness.engine.processPoint(pointFromGate(startGate, -2, 0, 4_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -2, 0, 5_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -2, 0, 6_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -2, 0, 9_000), false, true, false);
      });

      expect(harness.startCalls).toHaveLength(0);
      const diag = harness.engine.getDiagnostics().lastStartAttempt;
      expect(diag).not.toBeNull();
      expect(diag!.crossingType).toBe('soft');
      expect(diag!.directionalProgressM).not.toBeNull();
      // Exactly zero — all post-arm samples sit at alongM=-2, so signed
      // distance endpoints are identical (no jitter in these fixtures).
      expect(Math.abs(diag!.directionalProgressM!)).toBeLessThan(PROGRESS_THRESHOLD_M);
      harness.unmount();
    });

    test('6.2 stand then arm then slow walk-through with sparse samples DOES trigger start (iPhone 13 case)', () => {
      // This is the regression B23.1 introduced when it blocked Phase 3
      // entirely. Weak-GPS phones only get samples every ~3s at walking
      // speed; Phase 1 sign-change can't catch that. The walker is
      // legitimately crossing — we just have to prove the motion is
      // post-arm and directional, not standstill jitter.
      const harness = renderGateEngine(config);

      act(() => {
        // Pre-arm stand at -10m (outside the 6m soft-crossing zone)
        harness.engine.processPoint(pointFromGate(startGate, -10, 0, 0), false, false, false);
        harness.engine.processPoint(pointFromGate(startGate, -10, 0, 1_000), false, false, false);
      });

      act(() => {
        // Arm at t=2000, then sparse slow walk: 2m per 3s ≈ 0.67 m/s
        harness.engine.processPoint(pointFromGate(startGate, -10, 0, 2_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -7, 0, 5_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -4, 0, 8_000), false, true, false);
      });

      expect(harness.startCalls).toHaveLength(1);
      const diag = harness.engine.getDiagnostics().lastStartAttempt;
      expect(diag!.crossingType).toBe('soft');
      expect(diag!.directionalProgressM).not.toBeNull();
      expect(diag!.directionalProgressM!).toBeGreaterThanOrEqual(PROGRESS_THRESHOLD_M);
      harness.unmount();
    });

    test('6.4 hard crossing from a pre-arm → post-arm pair is REJECTED (Codex 2nd review)', () => {
      // Rider walks across the gate line while still disarmed, then
      // taps UZBRÓJ. Before the post-arm scope fix, the first post-arm
      // sample could pair with a pre-arm sample in the detection
      // window and trip Phase 1 sign-change, auto-starting the timer
      // from a crossing that happened before the rider committed to
      // the run. This regression-guards that: only post-arm samples
      // are eligible for crossing detection.
      const harness = renderGateEngine(config);

      act(() => {
        // Pre-arm walk across the line: -3m → +3m between t=0 and t=1000.
        // Without the fix, this pair produces a sign-change crossing.
        harness.engine.processPoint(pointFromGate(startGate, -3, 0, 0), false, false, false);
        harness.engine.processPoint(pointFromGate(startGate, 3, 0, 1_000), false, false, false);
      });

      act(() => {
        // Arm AFTER crossing, continue downhill. Both post-arm samples
        // are past the line, so no post-arm sign change exists.
        harness.engine.processPoint(pointFromGate(startGate, 5, 0, 2_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, 7, 0, 3_000), false, true, false);
      });

      expect(harness.startCalls).toHaveLength(0);
      harness.unmount();
    });

    test('6.3 parallel movement along the line does NOT trigger start (Codex P2: direction matters)', () => {
      // Rider walks alongside the gate line (pure lateral motion). Even
      // though the samples sit inside the soft-crossing zone, the
      // along-trail signed distance never changes — progress stays at
      // zero, so the guard rejects.
      const harness = renderGateEngine(config);

      act(() => {
        // Arm at lateralM=-3, alongM=-3. All samples stay at alongM=-3,
        // so signedDist is constant — only lateralM varies.
        harness.engine.processPoint(pointFromGate(startGate, -3, -3, 0), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -3, -2, 1_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -3, 0, 2_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -3, 2, 3_000), false, true, false);
        harness.engine.processPoint(pointFromGate(startGate, -3, 3, 4_000), false, true, false);
      });

      expect(harness.startCalls).toHaveLength(0);
      const diag = harness.engine.getDiagnostics().lastStartAttempt;
      expect(diag).not.toBeNull();
      // Either Phase 3 rejected on heading (directionalProgressM=null
      // because not soft) or Phase 3 fired and progress=0 blocked it.
      if (diag!.crossingType === 'soft') {
        expect(diag!.directionalProgressM).not.toBeNull();
        expect(Math.abs(diag!.directionalProgressM!)).toBeLessThan(PROGRESS_THRESHOLD_M);
      }
      harness.unmount();
    });
  });
});
