// ═══════════════════════════════════════════════════════════
// buildTrailGateConfigFromServer — canonical-gate plumbing.
//
// Build 49 ships canonical start/finish gate from trail_versions to
// every device so two phones agree on where the line is. This file
// pins the contract: server gate wins when valid, falls back to
// per-device polyline derivation when the server data is missing
// or malformed, and the server's own radius_m is intentionally
// ignored (client lineWidthM / zoneDepthM stay authoritative for
// the gate engine).
// ═══════════════════════════════════════════════════════════

import {
  buildTrailGateConfigFromServer,
  buildTrailGateConfigFromPioneer,
} from '@/features/run/gates';
import { resolveVenue } from '@/features/run/resolveVenue';

const trailId = 'pioneer-test-001';
const trailName = 'Test Trail';

function validGeometry(pointCount: number) {
  return {
    version: 1,
    points: Array.from({ length: pointCount }, (_, i) => ({
      lat: 52.2 + i * 0.0001,
      lng: 21.0 + i * 0.0001,
      t: i * 1000,
    })),
    meta: { totalDistanceM: 1500, durationS: 90, medianAccuracyM: 4 },
  };
}

const validServerStart = {
  lat: 52.2,
  lng: 21.0,
  radius_m: 25,
  direction_deg: 45,
};

const validServerFinish = {
  lat: 52.21,
  lng: 21.01,
  radius_m: 25,
  direction_deg: 45,
};

describe('buildTrailGateConfigFromServer', () => {
  test('uses server lat/lng for center when both gates valid', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      validServerStart,
      validServerFinish,
      validGeometry(15),
    );
    expect(cfg).not.toBeNull();
    expect(cfg!.startGate.center).toEqual({ latitude: 52.2, longitude: 21.0 });
    expect(cfg!.finishGate.center).toEqual({ latitude: 52.21, longitude: 21.01 });
  });

  test('uses server direction_deg for trailBearing', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      validServerStart,
      validServerFinish,
      validGeometry(15),
    );
    expect(cfg!.startGate.trailBearing).toBe(45);
    expect(cfg!.finishGate.trailBearing).toBe(45);
  });

  test('ignores server radius_m — client defaults stay authoritative', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      { ...validServerStart, radius_m: 999 },
      { ...validServerFinish, radius_m: 999 },
      validGeometry(15),
    );
    // Client lineWidthM is the canonical 4 m start / 6 m finish line,
    // independent of whatever radius the server stored.
    expect(cfg!.startGate.lineWidthM).toBeLessThanOrEqual(10);
    expect(cfg!.finishGate.lineWidthM).toBeLessThanOrEqual(10);
  });

  test('returns null when start gate is missing', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      null,
      validServerFinish,
      validGeometry(15),
    );
    expect(cfg).toBeNull();
  });

  test('returns null when finish gate is malformed (string lat)', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      validServerStart,
      { lat: 'not-a-number', lng: 21.01 },
      validGeometry(15),
    );
    expect(cfg).toBeNull();
  });

  test('returns null when trailId is null', () => {
    const cfg = buildTrailGateConfigFromServer(
      null,
      trailName,
      validServerStart,
      validServerFinish,
      validGeometry(15),
    );
    expect(cfg).toBeNull();
  });

  test('falls back to polyline-derived bearing when server omits direction_deg', () => {
    const cfg = buildTrailGateConfigFromServer(
      trailId,
      trailName,
      { lat: 52.2, lng: 21.0 }, // no direction_deg
      { lat: 52.21, lng: 21.01 },
      validGeometry(15),
    );
    // Falls back to client computation — concrete value depends on
    // polyline shape, but it MUST be a finite number, not NaN.
    expect(cfg).not.toBeNull();
    expect(Number.isFinite(cfg!.startGate.trailBearing)).toBe(true);
    expect(Number.isFinite(cfg!.finishGate.trailBearing)).toBe(true);
  });
});

describe('resolveVenue gate precedence', () => {
  test("server gate wins when valid — gateSource: 'server'", () => {
    const v = resolveVenue({
      trailId,
      trailName,
      dbTrail: { spotId: 'spot-1' },
      pioneerGeometryRaw: validGeometry(15),
      serverStartGateRaw: validServerStart,
      serverFinishGateRaw: validServerFinish,
    });
    expect(v.source).toBe('db');
    expect(v.gateSource).toBe('server');
    expect(v.gateConfig).not.toBeNull();
    // Center should match server, not first polyline point.
    expect(v.gateConfig!.startGate.center).toEqual({ latitude: 52.2, longitude: 21.0 });
  });

  test("falls back to local derivation when server gates missing — gateSource: 'local_fallback'", () => {
    const v = resolveVenue({
      trailId,
      trailName,
      dbTrail: { spotId: 'spot-1' },
      pioneerGeometryRaw: validGeometry(15),
      serverStartGateRaw: null,
      serverFinishGateRaw: null,
    });
    expect(v.gateSource).toBe('local_fallback');
    expect(v.gateConfig).not.toBeNull();
    // Pioneer fallback uses the actual polyline first point, which
    // matches the parametric (52.2 + 0 * 0.0001) = 52.2.
    expect(v.gateConfig!.startGate.center.latitude).toBeCloseTo(52.2, 4);
  });

  test("falls back to local derivation when server gate is malformed — gateSource: 'local_fallback'", () => {
    const v = resolveVenue({
      trailId,
      trailName,
      dbTrail: { spotId: 'spot-1' },
      pioneerGeometryRaw: validGeometry(15),
      // Server returned bogus shape (string lat) — must NOT poison
      // the resolved gate; we drop to the legacy derivation path.
      serverStartGateRaw: { lat: 'foo', lng: 21.0 } as unknown,
      serverFinishGateRaw: validServerFinish,
    });
    expect(v.gateSource).toBe('local_fallback');
    expect(v.gateConfig).not.toBeNull();
  });

  test("returns 'none' when both server and local geometry fail", () => {
    const v = resolveVenue({
      trailId,
      trailName,
      dbTrail: { spotId: 'spot-1' },
      pioneerGeometryRaw: { version: 1, points: [] }, // empty polyline
      serverStartGateRaw: null,
      serverFinishGateRaw: null,
    });
    expect(v.gateSource).toBe('none');
    expect(v.gateConfig).toBeNull();
  });
});
