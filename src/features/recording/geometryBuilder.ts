// ═══════════════════════════════════════════════════════════
// Pioneer geometry builder — pure functions only.
// Zero side effects, zero expo-location imports.
// Callers: useGPSRecorder (distance filter + validation),
//          recording/finalize screens (buildTrailGeometry).
// ═══════════════════════════════════════════════════════════

import type { PioneerGeometry, PioneerGeometryPoint } from '@/lib/api';

// ── Input shapes ────────────────────────────────────────────

/** Raw reading straight from the GPS subscription, before dedup. */
export interface RawGPSSample {
  lat: number;
  lng: number;
  alt: number | null;
  /** Horizontal accuracy in metres; null if platform did not report. */
  accuracy: number | null;
  /** ms since epoch from the platform. */
  timestamp: number;
}

/** Point kept in the live buffer after the 2 m dedup filter.
 *  `accuracy` is carried for median computation / weak-signal checks
 *  but does NOT land in the final `PioneerGeometry.points` (spec §7). */
export interface BufferedPoint {
  lat: number;
  lng: number;
  alt: number | null;
  accuracy: number | null;
  /** Seconds since the start of this recording. */
  t: number;
}

// ── Distance math ───────────────────────────────────────────

const EARTH_R_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in metres. */
export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Sum of consecutive haversine distances. Fewer than 2 points → 0. */
export function totalDistanceM(points: BufferedPoint[]): number {
  if (points.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineDistanceM(points[i - 1], points[i]);
  }
  return sum;
}

/** Cumulative altitude drop. Climbs are ignored (DH trails descend).
 *  Segments where either endpoint's altitude is null are skipped. */
export function totalDescentM(points: BufferedPoint[]): number {
  let drop = 0;
  for (let i = 1; i < points.length; i++) {
    const prevAlt = points[i - 1].alt;
    const currAlt = points[i].alt;
    if (prevAlt === null || currAlt === null) continue;
    if (currAlt < prevAlt) drop += prevAlt - currAlt;
  }
  return drop;
}

/** Median of non-null accuracy values. Returns Infinity if every point's
 *  accuracy is null — i.e. the caller cannot make any claim about signal
 *  quality. RPC weak-signal gate treats Infinity as unacceptable. */
export function medianAccuracyM(points: BufferedPoint[]): number {
  const accs = points
    .map((p) => p.accuracy)
    .filter((a): a is number => a !== null && Number.isFinite(a));
  if (accs.length === 0) return Infinity;
  accs.sort((a, b) => a - b);
  const mid = accs.length >> 1;
  return accs.length % 2 === 1
    ? accs[mid]
    : (accs[mid - 1] + accs[mid]) / 2;
}

// ── Geometry builder ────────────────────────────────────────

/** Normalise the in-memory buffer into the v1 jsonb shape the
 *  `finalize_pioneer_run` RPC expects. `accuracy` is intentionally
 *  dropped from the points array (server only stores lat/lng/alt/t). */
export function buildTrailGeometry(params: {
  points: BufferedPoint[];
  /** Set only when the finalize RPC has returned a run id and the
   *  caller wants to backfill the geometry meta. Usually null at
   *  submission time; future tooling can rewrite. */
  pioneerRunId: string | null;
}): PioneerGeometry {
  const { points, pioneerRunId } = params;

  const serialisedPoints: PioneerGeometryPoint[] = points.map((p) => ({
    lat: p.lat,
    lng: p.lng,
    alt: p.alt,
    t: p.t,
  }));

  const durationS = points.length > 0 ? points[points.length - 1].t : 0;
  const median = medianAccuracyM(points);

  return {
    version: 1,
    points: serialisedPoints,
    meta: {
      totalDistanceM: totalDistanceM(points),
      totalDescentM: totalDescentM(points),
      durationS,
      medianAccuracyM: Number.isFinite(median) ? median : 0,
      ...(pioneerRunId ? { pioneerRunId } : {}),
    },
  };
}

// ── Client-side pre-check ───────────────────────────────────

/** Return null if the geometry is acceptable; otherwise a specific
 *  error code the UI can map to copy before even hitting the RPC. */
export function validateGeometry(
  geometry: PioneerGeometry,
): 'too_few_points' | 'weak_signal' | 'invalid_monotonic' | null {
  if (geometry.points.length < 30) return 'too_few_points';

  // Server re-validates median_accuracy_m from the run payload; we
  // mirror the same gate against the stored meta so a weak-signal
  // pioneer run fails fast before the user waits on a round-trip.
  if (geometry.meta.medianAccuracyM > 20) return 'weak_signal';

  let prevT = -Infinity;
  for (const p of geometry.points) {
    if (p.t <= prevT) return 'invalid_monotonic';
    prevT = p.t;
  }
  return null;
}
