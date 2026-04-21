// ═══════════════════════════════════════════════════════════
// GPS run validators — thresholds + first-failure checker for
// Pioneer and Rider flows. Thresholds are the single source of
// truth (mirrored in supabase/migrations/013 for the RPC side).
//
// Design: first-failure return with `observed` + `required` so
// the UI can render dynamic messages like "Nagranie za krótkie:
// 28s. Pionier wymaga 30s." without a string table for every
// numeric case. Polish copy lives alongside the thresholds —
// one file to audit, one file to change.
// ═══════════════════════════════════════════════════════════

// ── Thresholds ──────────────────────────────────────────────

/** Pioneer-run thresholds. Pioneer seeds canonical geometry so
 *  accuracy and duration floors are stricter than Rider runs.
 *  Rationale (UCI short-track DH + Polish trail survey):
 *   - 30s: UCI Lisbon short track ≈ 40-50s. Below 30s GPS chaos.
 *   - 150m: Tajemna Hardline (Sobótka) is 187m — shortest trail
 *     we care to seed. 150m excludes pump tracks cleanly.
 *   - 15 pts: at 1 Hz post 2m dedup, 15 samples ≈ 30s of movement.
 *   - 20m avg / 18m start-end: seed accuracy floor. Tighter on
 *     gate samples because start/finish determine race validity. */
export const PIONEER_VALIDATORS = {
  MIN_DURATION_MS: 30_000,
  MIN_DISTANCE_M: 150,
  MIN_POINTS: 15,
  MIN_POINTS_DYNAMIC: (durationSec: number) =>
    Math.max(15, Math.floor(durationSec / 2)),
  ACCURACY_AVG_MAX_M: 20,
  ACCURACY_START_END_MAX_M: 18,
} as const;

/** Rider-run thresholds. Riders trust the Pioneer's geometry for
 *  corridor + gates, so duration / distance floors are looser —
 *  the gate engine already catches shortcuts + skips. These
 *  values exist so rider antiCheat can migrate off its own
 *  constants file in a later chunk; for now they are exported
 *  but not yet consumed. */
export const RIDER_VALIDATORS = {
  MIN_DURATION_MS: 15_000,
  MIN_DISTANCE_M: 50,
  MIN_POINTS: 10,
  ACCURACY_AVG_MAX_M: 25,
  ACCURACY_START_END_MAX_M: 20,
} as const;

/** Pre-flight readiness gate — consumed by the (Phase B) warm-up
 *  hook. GPS must hold accuracy ≤ MAX for MIN_CONSECUTIVE_FRESH
 *  fixes with no sample older than MAX_SAMPLE_AGE before the
 *  recording screen lets the user tap START. */
export const READINESS_GATE = {
  PIONEER_MAX_ACCURACY_M: 15,
  RIDER_MAX_ACCURACY_M: 20,
  MIN_CONSECUTIVE_FRESH_FIXES: 5,
  MAX_SAMPLE_AGE_MS: 2_000,
  WARMUP_WINDOW_MS: 10_000,
} as const;

// ── Result shape ────────────────────────────────────────────

export type ValidationCode =
  | 'too_short_duration'
  | 'too_short_distance'
  | 'too_few_points'
  | 'accuracy_too_poor_avg'
  | 'accuracy_too_poor_start'
  | 'accuracy_too_poor_end';

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      code: ValidationCode;
      message: string;
      observed: number;
      required: number;
    };

// ── Inputs ──────────────────────────────────────────────────

export interface RunValidationInput {
  durationMs: number;
  distanceM: number;
  pointCount: number;
  /** Median-or-mean accuracy across accepted samples. Pass
   *  `Infinity` if the device never reported accuracy — that's
   *  a hard fail, not a pass. */
  accuracyAvg: number;
  /** Horizontal accuracy of the first accepted sample in m.
   *  Pass `Infinity` if unknown. */
  accuracyStart: number;
  /** Horizontal accuracy of the last accepted sample in m.
   *  Pass `Infinity` if unknown. */
  accuracyEnd: number;
}

// ── Internal helpers ────────────────────────────────────────

/** Format a millisecond duration to "28s" / "1m 15s". Validator-
 *  internal; kept inline so callers don't reach for their own
 *  duration formatter and drift on rounding. */
function formatSeconds(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}m` : `${m}m ${rem}s`;
}

function formatMetres(m: number): string {
  return `${Math.round(m)}m`;
}

function formatAccuracy(m: number): string {
  if (!Number.isFinite(m)) return 'brak danych';
  return `±${Math.round(m)}m`;
}

// ── Validators ──────────────────────────────────────────────

/** Run the Pioneer-flow thresholds against a finalized recording.
 *  Returns `{ ok: true }` if every gate passes; otherwise the
 *  first failure with code + Polish message + observed/required
 *  numbers for UI rendering. */
export function validatePioneerRun(run: RunValidationInput): ValidationResult {
  const T = PIONEER_VALIDATORS;

  if (run.durationMs < T.MIN_DURATION_MS) {
    return {
      ok: false,
      code: 'too_short_duration',
      observed: run.durationMs,
      required: T.MIN_DURATION_MS,
      message: `Nagranie za krótkie: ${formatSeconds(run.durationMs)}. Pionier wymaga ${formatSeconds(T.MIN_DURATION_MS)} jazdy.`,
    };
  }

  if (run.distanceM < T.MIN_DISTANCE_M) {
    return {
      ok: false,
      code: 'too_short_distance',
      observed: Math.round(run.distanceM),
      required: T.MIN_DISTANCE_M,
      message: `Trasa za krótka: ${formatMetres(run.distanceM)}. Pionier wymaga ${formatMetres(T.MIN_DISTANCE_M)}.`,
    };
  }

  if (run.pointCount < T.MIN_POINTS) {
    return {
      ok: false,
      code: 'too_few_points',
      observed: run.pointCount,
      required: T.MIN_POINTS,
      message: `Za mało punktów GPS: ${run.pointCount}. Pionier wymaga min. ${T.MIN_POINTS}.`,
    };
  }

  if (run.accuracyAvg > T.ACCURACY_AVG_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_avg',
      observed: Number.isFinite(run.accuracyAvg) ? Math.round(run.accuracyAvg) : Infinity,
      required: T.ACCURACY_AVG_MAX_M,
      message: `Słaby sygnał GPS: średnio ${formatAccuracy(run.accuracyAvg)}. Pionier wymaga ${formatAccuracy(T.ACCURACY_AVG_MAX_M)} lub lepiej.`,
    };
  }

  if (run.accuracyStart > T.ACCURACY_START_END_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_start',
      observed: Number.isFinite(run.accuracyStart) ? Math.round(run.accuracyStart) : Infinity,
      required: T.ACCURACY_START_END_MAX_M,
      message: `Słaby sygnał na starcie: ${formatAccuracy(run.accuracyStart)}. Wymagane ${formatAccuracy(T.ACCURACY_START_END_MAX_M)}.`,
    };
  }

  if (run.accuracyEnd > T.ACCURACY_START_END_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_end',
      observed: Number.isFinite(run.accuracyEnd) ? Math.round(run.accuracyEnd) : Infinity,
      required: T.ACCURACY_START_END_MAX_M,
      message: `Słaby sygnał na mecie: ${formatAccuracy(run.accuracyEnd)}. Wymagane ${formatAccuracy(T.ACCURACY_START_END_MAX_M)}.`,
    };
  }

  return { ok: true };
}

/** Rider-flow validator. Same shape as Pioneer but looser
 *  thresholds — riders leverage Pioneer's geometry for gates
 *  and corridor. Not yet wired into `antiCheat.ts`; exported
 *  so the rider finalize path can adopt it in a follow-up
 *  chunk without threshold drift. */
export function validateRiderRun(run: RunValidationInput): ValidationResult {
  const T = RIDER_VALIDATORS;

  if (run.durationMs < T.MIN_DURATION_MS) {
    return {
      ok: false,
      code: 'too_short_duration',
      observed: run.durationMs,
      required: T.MIN_DURATION_MS,
      message: `Zjazd za krótki: ${formatSeconds(run.durationMs)}. Minimum ${formatSeconds(T.MIN_DURATION_MS)}.`,
    };
  }

  if (run.distanceM < T.MIN_DISTANCE_M) {
    return {
      ok: false,
      code: 'too_short_distance',
      observed: Math.round(run.distanceM),
      required: T.MIN_DISTANCE_M,
      message: `Trasa za krótka: ${formatMetres(run.distanceM)}. Minimum ${formatMetres(T.MIN_DISTANCE_M)}.`,
    };
  }

  if (run.pointCount < T.MIN_POINTS) {
    return {
      ok: false,
      code: 'too_few_points',
      observed: run.pointCount,
      required: T.MIN_POINTS,
      message: `Za mało punktów GPS: ${run.pointCount}. Minimum ${T.MIN_POINTS}.`,
    };
  }

  if (run.accuracyAvg > T.ACCURACY_AVG_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_avg',
      observed: Number.isFinite(run.accuracyAvg) ? Math.round(run.accuracyAvg) : Infinity,
      required: T.ACCURACY_AVG_MAX_M,
      message: `Słaby sygnał GPS: średnio ${formatAccuracy(run.accuracyAvg)}. Wymagane ${formatAccuracy(T.ACCURACY_AVG_MAX_M)} lub lepiej.`,
    };
  }

  if (run.accuracyStart > T.ACCURACY_START_END_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_start',
      observed: Number.isFinite(run.accuracyStart) ? Math.round(run.accuracyStart) : Infinity,
      required: T.ACCURACY_START_END_MAX_M,
      message: `Słaby sygnał na starcie: ${formatAccuracy(run.accuracyStart)}. Wymagane ${formatAccuracy(T.ACCURACY_START_END_MAX_M)}.`,
    };
  }

  if (run.accuracyEnd > T.ACCURACY_START_END_MAX_M) {
    return {
      ok: false,
      code: 'accuracy_too_poor_end',
      observed: Number.isFinite(run.accuracyEnd) ? Math.round(run.accuracyEnd) : Infinity,
      required: T.ACCURACY_START_END_MAX_M,
      message: `Słaby sygnał na mecie: ${formatAccuracy(run.accuracyEnd)}. Wymagane ${formatAccuracy(T.ACCURACY_START_END_MAX_M)}.`,
    };
  }

  return { ok: true };
}
