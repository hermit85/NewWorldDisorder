// ═══════════════════════════════════════════════════════════
// Gate Definitions — official start/finish gate configs
// per trail at Słotwiny Arena
//
// PHILOSOPHY: Anti-frustration first.
// Start: reasonably disciplined (needs ARMED first).
// Finish: maximally forgiving (if you rode the trail, it counts).
//
// Gate bearings are measured as the trail direction at the gate,
// in degrees from true north. Downhill direction.
// ═══════════════════════════════════════════════════════════

import { TrailGateConfig, GateDefinition } from './types';
import { computeHeading } from './geometry';
import type { TrailGeoSeed } from '@/data/venueConfig';
import type { PioneerGeometry } from '@/lib/api';
import { distanceMeters } from '@/systems/gps';

// Checkpoint B: seed-backed corridor source is gone.
// Sprint 3 Chunk 6 rehydrates from trail.geometry — Pioneer runs are the
// canonical line (ADR-005). `buildTrailGeoFromPioneer` adapts the persisted
// geometry to the TrailGeoSeed shape that verifyRealRun / evaluateCorridor
// already expect, so no downstream verification logic needed to change.
//
// Chunk 8 note: rider flow no longer depends on the legacy static
// `trailGeoSeeds` list. The canonical gate config is derived at runtime
// from the same Pioneer geometry / TrailGeoSeed that powers corridor
// verification.
//
// Trails without geometry (pre-Pioneer) still resolve to null here → the
// run lifecycle passes null geo → ranked runs land as 'unverified'. Once a
// Pioneer skończy kalibrację (migration 008), trail.geometry is populated
// and subsequent riders validate against the Pioneer's recorded line.
const trailGeoSeeds: TrailGeoSeed[] = [];

const PIONEER_ZONE_RADIUS_M = 25;
const GATE_VECTOR_BASELINE_M = 10;

/** Narrow unknown JSON → PioneerGeometry shape. Returns null when the
 *  structure does not match (legacy v0 rows, truncated payloads). */
function asPioneerGeometry(raw: unknown): PioneerGeometry | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<PioneerGeometry>;
  if (g.version !== 1) return null;
  if (!Array.isArray(g.points) || g.points.length < 2) return null;
  return g as PioneerGeometry;
}

/**
 * Rehydrate a TrailGeoSeed (polyline + start/finish zones) from the
 * Pioneer geometry stored on the trail row. Caller fetches geometry
 * separately via fetchTrailGeometry so the common Trail fetch path
 * stays lean (geometry jsonb can be 5-10 KB per trail).
 *
 * Used by the run screen so evaluateCorridor / verifyRealRun have a
 * canonical line to score subsequent runs against.
 */
export function buildTrailGeoFromPioneer(
  trailId: string | null,
  geometryRaw: unknown,
): TrailGeoSeed | null {
  if (!trailId) return null;
  const geometry = asPioneerGeometry(geometryRaw);
  if (!geometry) return null;

  const polyline = geometry.points.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));
  if (polyline.length < 10) return null;

  const first = polyline[0];
  const last = polyline[polyline.length - 1];

  return {
    trailId,
    startZone: { ...first, radiusM: PIONEER_ZONE_RADIUS_M },
    finishZone: { ...last, radiusM: PIONEER_ZONE_RADIUS_M },
    polyline,
  };
}

// ── Default gate parameters ──

const DEFAULT_START_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: 10,
  zoneDepthM: 8,
  entryRadiusM: 12,
  headingToleranceDeg: 60,
  minTriggerSpeedKmh: 2,
};

const DEFAULT_FINISH_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: 12,
  zoneDepthM: 10,
  entryRadiusM: 14,
  headingToleranceDeg: 75, // forgiving but not wide open
  minTriggerSpeedKmh: 1.5, // slower trigger for finish
};

// ── Auto-compute bearing from first/last polyline segments ──

function totalPolylineDistanceM(poly: { latitude: number; longitude: number }[]): number {
  let total = 0;
  for (let i = 1; i < poly.length; i++) {
    total += distanceMeters(poly[i - 1], poly[i]);
  }
  return total;
}

function findIndexAtDistance(
  poly: { latitude: number; longitude: number }[],
  fromStart: boolean,
  targetDistanceM: number,
): number {
  if (poly.length < 2) return 0;

  let traversed = 0;
  if (fromStart) {
    for (let i = 1; i < poly.length; i++) {
      traversed += distanceMeters(poly[i - 1], poly[i]);
      if (traversed >= targetDistanceM) return i;
    }
    return poly.length - 1;
  }

  for (let i = poly.length - 2; i >= 0; i--) {
    traversed += distanceMeters(poly[i + 1], poly[i]);
    if (traversed >= targetDistanceM) return i;
  }
  return 0;
}

function computeStartBearing(poly: { latitude: number; longitude: number }[]): number {
  if (poly.length < 2) return 180;
  const idx = findIndexAtDistance(poly, true, GATE_VECTOR_BASELINE_M);
  return computeHeading(poly[0], poly[idx]);
}

function computeFinishBearing(poly: { latitude: number; longitude: number }[]): number {
  if (poly.length < 2) return 180;
  const idx = findIndexAtDistance(poly, false, GATE_VECTOR_BASELINE_M);
  return computeHeading(poly[idx], poly[poly.length - 1]);
}

function estimateMinDurationSec(expectedLengthM: number): number {
  return Math.max(8, Math.min(45, Math.round(expectedLengthM / 10)));
}

export function buildTrailGateConfigFromGeo(
  trailId: string,
  trailName: string,
  geo: TrailGeoSeed,
): TrailGateConfig {
  const meta = trailMeta.find((m) => m.trailId === trailId);
  const expectedLengthM = Math.max(
    meta?.expectedLengthM ?? 0,
    Math.round(totalPolylineDistanceM(geo.polyline)),
  );
  const minDurationSec = meta?.minDurationSec ?? estimateMinDurationSec(expectedLengthM);
  const minDistanceFraction = meta?.minDistanceFraction ?? 0.75;
  const startBearing = computeStartBearing(geo.polyline);
  const finishBearing = computeFinishBearing(geo.polyline);

  return {
    trailId,
    trailName: meta?.trailName ?? trailName,
    expectedLengthM,
    minDurationSec,
    minDistanceFraction,
    startGate: {
      center: { latitude: geo.startZone.latitude, longitude: geo.startZone.longitude },
      trailBearing: startBearing,
      ...DEFAULT_START_GATE,
    },
    finishGate: {
      center: { latitude: geo.finishZone.latitude, longitude: geo.finishZone.longitude },
      trailBearing: finishBearing,
      ...DEFAULT_FINISH_GATE,
    },
  };
}

// ── Trail-specific metadata ──

interface TrailMeta {
  trailId: string;
  trailName: string;
  expectedLengthM: number;
  minDurationSec: number;
  minDistanceFraction: number;
}

const trailMeta: TrailMeta[] = [
  {
    trailId: 'galgan-niebieska',
    trailName: 'Gałgan Niebieska',
    expectedLengthM: 2400,
    minDurationSec: 45,       // nobody rides 2.4km in under 45s
    minDistanceFraction: 0.6, // at least 60% of expected distance
  },
  {
    trailId: 'dookola-swiata-zielona',
    trailName: 'Dookoła Świata Zielona',
    expectedLengthM: 3100,
    minDurationSec: 60,
    minDistanceFraction: 0.6,
  },
  {
    trailId: 'kometa-niebieska',
    trailName: 'Kometa Niebieska',
    expectedLengthM: 2300,
    minDurationSec: 40,
    minDistanceFraction: 0.6,
  },
  {
    trailId: 'dzida-czerwona',
    trailName: 'Dzida Czerwona',
    expectedLengthM: 1500,
    minDurationSec: 30,       // short steep trail — 30s minimum
    minDistanceFraction: 0.65,
  },
];

// ── Build gate configs from seed data + metadata ──

export function buildTrailGateConfigs(): TrailGateConfig[] {
  return trailGeoSeeds.map((geo) => buildTrailGateConfigFromGeo(geo.trailId, geo.trailId, geo));
}

// ── Get gate config for a specific trail ──

let _cachedConfigs: TrailGateConfig[] | null = null;

export function getTrailGateConfig(trailId: string): TrailGateConfig | null {
  if (!_cachedConfigs) {
    _cachedConfigs = buildTrailGateConfigs();
  }
  return _cachedConfigs.find((c) => c.trailId === trailId) ?? null;
}

// ── Get all gate configs ──

export function getAllTrailGateConfigs(): TrailGateConfig[] {
  if (!_cachedConfigs) {
    _cachedConfigs = buildTrailGateConfigs();
  }
  return _cachedConfigs;
}
