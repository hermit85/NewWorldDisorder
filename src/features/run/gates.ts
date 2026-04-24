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
const FINISH_UNLOCK_MIN_TIME_SEC = 12;

// ── Chunk 10: Approach Navigator constants ──
// Spec v3 §2.4. Consumed by src/features/run/approachNavigator.ts and by
// the gate engine's arming check. Exposed as named exports so both the
// navigator and any integration test can reference a single source of
// truth.

/** Physical length of the virtual start line, meters. Narrower than the
 *  Chunk 8 DEFAULT_START_GATE.lineWidthM on purpose — the navigator is
 *  meant to feel like a race start tape, not a fuzzy zone. */
export const GATE_LINE_LENGTH_M = 4;

/** Distance boundary separating the FAR state from NEAR. Beyond this we
 *  show a compass arrow; within, we show a mini-map. */
export const GATE_APPROACH_NEAR_M = 30;

/** Distance boundary separating NEAR from ON_LINE_READY / WRONG_SIDE.
 *  Field test B20 raised this from 3m to 15m. Reasoning: Apple GPS in
 *  bike-park terrain sits at ±7-12m even with clear sky. At 3m the
 *  rider stood visually IN the start circle on the mini-map but the
 *  state machine ping-ponged between `near` and `on_line_ready` with
 *  every jitter — timer never armed. The Chunk 8 gate engine still
 *  does its own precise perpendicular-distance crossing detection
 *  against the actual line geometry, so the only thing this radius
 *  controls is "when does the UI stop saying 'podejdź bliżej'". */
export const GATE_APPROACH_READY_M = 15;

/** Max acceptable GPS horizontal accuracy for arming. Above this we
 *  force GPS_UNSURE so users get an honest "GPS weak" rather than a
 *  guessed direction. */
export const GATE_ACCURACY_REQUIRED_M = 5;

/** Navigator UI block threshold. Separate from GATE_ACCURACY_REQUIRED_M
 *  because Apple's foreground GPS in dense urban terrain routinely sits
 *  at ±7-12m even with a clean sky view — blocking the rider at 6m meant
 *  B20 field testers saw "GPS SŁABY" at GOTOWY on map. B21 walk-in test
 *  pushed this further to 30m: urban forest sections (tree canopy) drop
 *  to ±15-25m and riders couldn't arm at all. Gate engine still uses
 *  GATE_ACCURACY_REQUIRED_M (5m) for crossing-quality reporting; this
 *  constant only decides when the approach UI gives up on guidance. */
export const APPROACH_UNSURE_ACCURACY_M = 30;

/** Max heading deviation from trail bearing tolerated before the UI
 *  shows "Podejdź z kierunku trasy". B21 raised from 60° to 90° —
 *  at 60° even a rider rolling up parallel to the trail triggered
 *  the wrong_side prompt, and 30-45° side-approach is a perfectly
 *  legitimate rolling start. Only flip to wrong_side when the rider
 *  is actually facing away (>90° means facing the rear hemisphere).
 *  The gate engine's start gate had its own headingToleranceDeg
 *  (historically 60°) for the actual crossing check; B22 aligned it
 *  with the approach value (90°) after walk-test showed the 60° check
 *  rejected crossings for walkers whose heading jittered on slow
 *  speeds. See DEFAULT_START_GATE below. */
export const GATE_HEADING_TOLERANCE_DEG = 90;

/** Minimum perpendicular velocity (m/s) across the gate line for the
 *  Chunk 8 crossing detector to accept a cross. Filters out a stationary
 *  rider sitting on the line.
 *
 *  B22 walk-test hotfix: lowered 1.0 → 0.3. Walking perpendicular to the
 *  gate at 1.1-1.4 m/s often produced perp-velocity projections <1.0 m/s
 *  (any non-orthogonal approach reduces the perpendicular component),
 *  and the crossing was silently rejected — `gateLastStartAttempt.velocityOk=false`.
 *  A real rider on a bike at the start is 4-8 m/s, so 0.3 doesn't open an
 *  anti-cheat hole; you still need actual motion across the line (the
 *  detector still requires a sample pair on opposite sides of the line).
 *  Revisit to a ranked/practice split once crowd-confirm lands. */
export const GATE_VELOCITY_MIN_MPS = 0.3;

/** Narrow unknown JSON → PioneerGeometry shape. Returns null when the
 *  structure does not match (legacy v0 rows, truncated payloads). */
function asPioneerGeometry(raw: unknown): PioneerGeometry | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<PioneerGeometry>;
  if (g.version !== 1) return null;
  if (!Array.isArray(g.points) || g.points.length < 2) return null;
  return g as PioneerGeometry;
}

function toPolyline(
  geometry: PioneerGeometry,
): { latitude: number; longitude: number }[] {
  return geometry.points
    .filter((p): p is PioneerGeometry['points'][number] => (
      typeof p?.lat === 'number' &&
      Number.isFinite(p.lat) &&
      typeof p?.lng === 'number' &&
      Number.isFinite(p.lng)
    ))
    .map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
    }));
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

  const polyline = toPolyline(geometry);
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

export function buildTrailGateConfigFromPioneer(
  trailId: string | null,
  trailName: string,
  geometryRaw: unknown,
): TrailGateConfig | null {
  if (!trailId) return null;
  const geometry = asPioneerGeometry(geometryRaw);
  if (!geometry) return null;

  const polyline = toPolyline(geometry);
  if (polyline.length < 2) return null;

  const first = polyline[0];
  const last = polyline[polyline.length - 1];

  return buildTrailGateConfigFromGeo(trailId, trailName, {
    trailId,
    startZone: { ...first, radiusM: PIONEER_ZONE_RADIUS_M },
    finishZone: { ...last, radiusM: PIONEER_ZONE_RADIUS_M },
    polyline,
  });
}

// ── Default gate parameters ──

// Gate widths pull from GATE_LINE_LENGTH_M so the spec constant and
// the runtime config can't drift apart (Codex review P1.1 — before
// this alignment the constant existed but the builder used 10 / 12).
// Narrow start line is deliberate: honest racing wants a real line,
// not a fuzzy zone. Finish keeps a tiny bit more slack because GPS
// bias compounds over the trace and a finish miss wastes the whole
// descent, while a false-positive start only invalidates the arming.
// B22 walk-test hotfix — both gates relaxed so walking-speed testers can
// actually cross. Heading tolerances moved in line with the approach
// navigator (which was relaxed to 90° in B21); minTriggerSpeedKmh dropped
// below walking so the low-speed gate doesn't pre-empt GATE_VELOCITY_MIN_MPS.
// The narrow lineWidthM stays honest — you still need to physically cross
// the 4-6 m line, not just be near it.
const DEFAULT_START_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: GATE_LINE_LENGTH_M, // 4 m
  zoneDepthM: 6,
  entryRadiusM: 10,
  headingToleranceDeg: 90, // B22: was 60° — walking heading jitter exceeded that
  minTriggerSpeedKmh: 1,   // B22: was 2 — now below walking, delegated to GATE_VELOCITY_MIN_MPS
};

const DEFAULT_FINISH_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: GATE_LINE_LENGTH_M + 2, // 6 m
  zoneDepthM: 8,
  entryRadiusM: 12,
  headingToleranceDeg: 90, // B22: was 75 — same reason as start gate
  minTriggerSpeedKmh: 0.8, // B22: was 1.5 — slow finish walk-outs shouldn't be rejected
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
  const finishUnlockMinDistanceM = Math.max(80, expectedLengthM * 0.25);
  const startBearing = computeStartBearing(geo.polyline);
  const finishBearing = computeFinishBearing(geo.polyline);

  return {
    trailId,
    trailName: meta?.trailName ?? trailName,
    expectedLengthM,
    finishUnlockMinTimeSec: FINISH_UNLOCK_MIN_TIME_SEC,
    finishUnlockMinDistanceM,
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
