// ═══════════════════════════════════════════════════════════
// validators — Pioneer role-aware threshold tests.
//
// The `finalize_seed_run` RPC mirrors these thresholds server-side
// (migration 20260422210000). These tests pin the client half so
// the two halves can't drift silently.
// ═══════════════════════════════════════════════════════════

import {
  validatePioneerRun,
  PIONEER_VALIDATORS,
  PIONEER_CURATOR_VALIDATORS,
  type RunValidationInput,
} from '@/features/recording/validators';

// Curator walking pod biurem w Warszawie — 40 s, 45 m, 18 pts, 32 m median.
// Fails every rider threshold (30 s OK, 150 m FAIL, 15 pts OK, 20 m FAIL);
// passes curator thresholds (5 s, 20 m, 5 pts, 50 m).
const CURATOR_WALK: RunValidationInput = {
  durationMs: 40_000,
  distanceM: 45,
  pointCount: 18,
  accuracyAvg: 32,
  accuracyStart: 28,
  accuracyEnd: 30,
};

// Solid rider pioneer: 90 s, 280 m, 45 pts, 8 m median.
const RIDER_PIONEER: RunValidationInput = {
  durationMs: 90_000,
  distanceM: 280,
  pointCount: 45,
  accuracyAvg: 8,
  accuracyStart: 7,
  accuracyEnd: 9,
};

describe('validatePioneerRun — role-aware thresholds', () => {
  it('rider: solid pioneer passes', () => {
    expect(validatePioneerRun(RIDER_PIONEER, 'rider')).toEqual({ ok: true });
  });

  it('rider: curator-walk payload is rejected on distance', () => {
    const result = validatePioneerRun(CURATOR_WALK, 'rider');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too_short_distance');
      expect(result.required).toBe(PIONEER_VALIDATORS.MIN_DISTANCE_M);
    }
  });

  it('curator: curator-walk payload passes', () => {
    expect(validatePioneerRun(CURATOR_WALK, 'curator')).toEqual({ ok: true });
  });

  it('moderator: curator-walk payload passes (moderator uses same bar)', () => {
    expect(validatePioneerRun(CURATOR_WALK, 'moderator')).toEqual({ ok: true });
  });

  it('curator: still rejects 3 s / 10 m / 2 pts / 80 m (below curator floor)', () => {
    const tooLoose: RunValidationInput = {
      durationMs: 3_000,
      distanceM: 10,
      pointCount: 2,
      accuracyAvg: 80,
      accuracyStart: 80,
      accuracyEnd: 80,
    };
    const result = validatePioneerRun(tooLoose, 'curator');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too_short_duration');
      expect(result.required).toBe(PIONEER_CURATOR_VALIDATORS.MIN_DURATION_MS);
    }
  });

  it('NULL role falls back to strict rider bar', () => {
    const result = validatePioneerRun(CURATOR_WALK, null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too_short_distance');
    }
  });

  it('undefined role falls back to strict rider bar', () => {
    const result = validatePioneerRun(CURATOR_WALK);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too_short_distance');
    }
  });

  it('threshold constants are in lock-step with the SQL migration', () => {
    // Must match supabase/migrations/20260422210000_curator_relaxed_pioneer_thresholds.sql
    expect(PIONEER_CURATOR_VALIDATORS.MIN_DURATION_MS).toBe(5_000);
    expect(PIONEER_CURATOR_VALIDATORS.MIN_DISTANCE_M).toBe(20);
    expect(PIONEER_CURATOR_VALIDATORS.MIN_POINTS).toBe(5);
    expect(PIONEER_CURATOR_VALIDATORS.ACCURACY_AVG_MAX_M).toBe(50);
    // Rider bar unchanged from mig 013.
    expect(PIONEER_VALIDATORS.MIN_DURATION_MS).toBe(30_000);
    expect(PIONEER_VALIDATORS.MIN_DISTANCE_M).toBe(150);
    expect(PIONEER_VALIDATORS.MIN_POINTS).toBe(15);
    expect(PIONEER_VALIDATORS.ACCURACY_AVG_MAX_M).toBe(20);
  });
});
