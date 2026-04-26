// ═══════════════════════════════════════════════════════════
// gates.ts — malformed / null geometry edge cases.
//
// buildTrailGeoFromPioneer and buildTrailGateConfigFromPioneer
// take `unknown` as the geometry payload because the pioneer row's
// `geometry` jsonb column is unknown-shaped at the type boundary.
// These tests pin every refusal branch in asPioneerGeometry +
// toPolyline so a malformed payload cannot silently produce a bad
// gate config (which would manifest as "dead start line" — the
// rider's race never arms).
// ═══════════════════════════════════════════════════════════

import {
  buildTrailGeoFromPioneer,
  buildTrailGateConfigFromPioneer,
} from '@/features/run/gates';

// Pioneer geometry: v=1, points = [{lat, lng, t}].
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

describe('buildTrailGeoFromPioneer (null guards)', () => {
  it('returns null when trailId is null', () => {
    expect(buildTrailGeoFromPioneer(null, validGeometry(15))).toBeNull();
  });

  it('returns null when geometry is null', () => {
    expect(buildTrailGeoFromPioneer('trail-1', null)).toBeNull();
  });

  it('returns null when geometry is undefined', () => {
    expect(buildTrailGeoFromPioneer('trail-1', undefined)).toBeNull();
  });

  it('returns null when geometry is a primitive', () => {
    expect(buildTrailGeoFromPioneer('trail-1', 'string')).toBeNull();
    expect(buildTrailGeoFromPioneer('trail-1', 42)).toBeNull();
    expect(buildTrailGeoFromPioneer('trail-1', true)).toBeNull();
  });

  it('returns null when version is not 1 (legacy v0, future v2)', () => {
    expect(
      buildTrailGeoFromPioneer('trail-1', { ...validGeometry(15), version: 0 }),
    ).toBeNull();
    expect(
      buildTrailGeoFromPioneer('trail-1', { ...validGeometry(15), version: 2 }),
    ).toBeNull();
  });

  it('returns null when points is missing', () => {
    expect(
      buildTrailGeoFromPioneer('trail-1', { version: 1, meta: {} }),
    ).toBeNull();
  });

  it('returns null when points is not an array', () => {
    expect(
      buildTrailGeoFromPioneer('trail-1', { version: 1, points: 'oops' }),
    ).toBeNull();
  });

  it('returns null when points has fewer than 2 entries', () => {
    expect(
      buildTrailGeoFromPioneer('trail-1', { version: 1, points: [{ lat: 52, lng: 21, t: 0 }] }),
    ).toBeNull();
  });

  it('returns null when polyline filter strips below the 10-point threshold', () => {
    // 8 valid + 0 invalid = 8 polyline points → below 10 threshold
    expect(buildTrailGeoFromPioneer('trail-1', validGeometry(8))).toBeNull();
  });

  it('returns null when valid points exist but NaN/Infinity strip below threshold', () => {
    // 5 valid + 5 invalid = 5 polyline → below 10 threshold
    const geo = {
      version: 1,
      points: [
        { lat: 52.0, lng: 21.0, t: 0 },
        { lat: 52.1, lng: 21.1, t: 1000 },
        { lat: NaN, lng: 21.2, t: 2000 },
        { lat: 52.2, lng: Infinity, t: 3000 },
        { lat: 'oops' as unknown as number, lng: 21.3, t: 4000 },
        { lat: null as unknown as number, lng: 21.4, t: 5000 },
        { lat: 52.5, lng: 21.5, t: 6000 },
        { lat: 52.6, lng: 21.6, t: 7000 },
        { lat: 52.7, lng: 21.7, t: 8000 },
        { lat: undefined as unknown as number, lng: 21.8, t: 9000 },
      ],
    };
    expect(buildTrailGeoFromPioneer('trail-1', geo)).toBeNull();
  });

  it('happy path: returns startZone + finishZone + polyline', () => {
    const result = buildTrailGeoFromPioneer('trail-1', validGeometry(15));
    expect(result).not.toBeNull();
    expect(result?.trailId).toBe('trail-1');
    expect(result?.polyline).toHaveLength(15);
    expect(result?.startZone.latitude).toBeCloseTo(52.2);
    expect(result?.startZone.radiusM).toBeGreaterThan(0);
    expect(result?.finishZone.latitude).toBeGreaterThan(result!.startZone.latitude);
  });
});

describe('buildTrailGateConfigFromPioneer (lower threshold, gate config)', () => {
  it('returns null when trailId is null', () => {
    expect(
      buildTrailGateConfigFromPioneer(null, 'Test', validGeometry(5)),
    ).toBeNull();
  });

  it('returns null on malformed geometry (asPioneerGeometry refuses)', () => {
    expect(buildTrailGateConfigFromPioneer('trail-1', 'Test', null)).toBeNull();
    expect(
      buildTrailGateConfigFromPioneer('trail-1', 'Test', { version: 0, points: [] }),
    ).toBeNull();
  });

  it('returns null when polyline has fewer than 2 valid points after filter', () => {
    const geo = {
      version: 1,
      points: [
        { lat: 52.0, lng: 21.0, t: 0 },
        { lat: NaN, lng: 21.1, t: 1000 },
      ],
    };
    expect(buildTrailGateConfigFromPioneer('trail-1', 'Test', geo)).toBeNull();
  });

  it('accepts geometry with as few as 2 valid points (lower threshold than buildTrailGeoFromPioneer)', () => {
    const geo = validGeometry(2);
    const result = buildTrailGateConfigFromPioneer('trail-1', 'Test', geo);
    expect(result).not.toBeNull();
    expect(result?.trailId).toBe('trail-1');
    expect(result?.startGate).toBeDefined();
    expect(result?.finishGate).toBeDefined();
  });

  it('exposes start/finish gates with center coordinates from first/last polyline point', () => {
    const geo = validGeometry(20);
    const result = buildTrailGateConfigFromPioneer('trail-1', 'Test', geo);
    expect(result).not.toBeNull();
    expect(result?.startGate.center.latitude).toBeCloseTo(52.2);
    expect(result?.finishGate.center.latitude).toBeGreaterThan(
      result!.startGate.center.latitude,
    );
  });

  it('happy path produces valid GateDefinition shape with bearings + line widths', () => {
    const result = buildTrailGateConfigFromPioneer('trail-1', 'Test', validGeometry(20));
    expect(result?.startGate.lineWidthM).toBeGreaterThan(0);
    expect(result?.finishGate.lineWidthM).toBeGreaterThan(0);
    expect(typeof result?.startGate.trailBearing).toBe('number');
    expect(typeof result?.finishGate.trailBearing).toBe('number');
  });

  it('survives mixed valid + invalid points (filter keeps valid ones)', () => {
    const geo = {
      version: 1,
      points: [
        { lat: 52.0, lng: 21.0, t: 0 },
        { lat: NaN, lng: 21.1, t: 1000 }, // dropped
        { lat: 52.2, lng: 21.2, t: 2000 },
        { lat: 52.3, lng: 21.3, t: 3000 },
      ],
    };
    const result = buildTrailGateConfigFromPioneer('trail-1', 'Test', geo);
    // Only 3 valid points but ≥2 → gate config builds
    expect(result).not.toBeNull();
  });
});
