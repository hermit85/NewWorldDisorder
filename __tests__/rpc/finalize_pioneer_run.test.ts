// ═══════════════════════════════════════════════════════════
// finalize_pioneer_run RPC — contract tests (S1.2).
//
// NAMING NOTE (flag, not a fix): the handoff calls this the
// `finalize_pioneer_run` RPC, but the client wrapper
// `finalizePioneerRun` in src/lib/api.ts actually hits
// `finalize_seed_run` on the server — a Sprint-4 migration (012)
// replaced the legacy bundle-param RPC with a flat-param one, and
// the old `finalize_pioneer_run` function stays in the DB unused.
// The client symbol kept the Pioneer name to avoid rippling
// the rename through every call site. These tests verify the
// client path that Darek actually invokes from /run/review, so
// we assert the wrapper issues `finalize_seed_run` under the hood
// with the Pioneer-shaped payload.
//
// All five handoff scenarios are covered:
//   a) happy path
//   b) too_few_points (insufficient GPS points)
//   c) already_pioneered (trail already finalised)
//   d) missing spot_id (validation-style: RPC returns trail_not_found)
//   e) weak_signal / corridor rescue (trail persists, run flagged)
//
// A sixth case covers the raw Supabase error path so a broken
// client / network surface still maps to a typed `rpc_failed`.
//
// No real Supabase — `@/lib/supabase` is mocked at module level.
// ═══════════════════════════════════════════════════════════

import { finalizePioneerRun, finalizeSeedRun } from '@/lib/api';
import type { PioneerGeometry, PioneerRunPayload } from '@/lib/api';

// ── Mock Supabase client ──
// The wrapper calls db().rpc(...) which returns the shape the
// supabase-js v2 builder would return. We expose a single jest.fn
// so each scenario can queue its own response with mockResolvedValueOnce.

const mockRpc = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
  isSupabaseConfigured: true,
}));

// ── GPS fixture helpers ──

/**
 * Build a realistic Pioneer GPS trace. Starts around Warsaw
 * (52.24, 21.02) so the numbers look like actual Parkowa data
 * and drifts ~5 cm per sample which approximates a slow jog.
 * Not meant to model real riding physics — just produce a trace
 * the RPC will accept in the happy-path shape.
 */
function makeTrace(count: number): PioneerGeometry['points'] {
  const BASE_LAT = 52.2400;
  const BASE_LNG = 21.0200;
  const points: PioneerGeometry['points'] = [];
  for (let i = 0; i < count; i++) {
    points.push({
      lat: BASE_LAT + i * 0.00005,
      lng: BASE_LNG + i * 0.00005,
      alt: 110 - i * 0.15,
      t: i * 2000, // 2 samples / sec
    });
  }
  return points;
}

const STARTED_AT = '2026-04-22T14:30:00.000Z';
const FINISHED_AT = '2026-04-22T14:33:27.800Z';
const PARKOWA_DURATION_MS = 207_800; // 3:27.80 — first verified run in history

const BASE_GEOMETRY: PioneerGeometry = {
  version: 1,
  points: makeTrace(60),
  meta: {
    totalDistanceM: 320,
    totalDescentM: 42,
    durationS: Math.round(PARKOWA_DURATION_MS / 1000),
    medianAccuracyM: 4.2,
  },
};

const BASE_RUN_PAYLOAD: PioneerRunPayload = {
  spot_id: 'spot-uuid-0001',
  started_at: STARTED_AT,
  finished_at: FINISHED_AT,
  duration_ms: PARKOWA_DURATION_MS,
  mode: 'ranked',
  verification_status: 'verified',
  median_accuracy_m: 4.2,
  quality_tier: 'valid',
};

// ── Tests ──

describe('finalize_pioneer_run RPC contract', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  test('(a) happy path — valid GPS trace returns runId + pending-second-run status', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        run_id: 'run-uuid-happy',
        seed_source: 'rider',
        trust_tier: 'provisional',
        version_id: 'version-uuid-1',
        trail_status: 'fresh_pending_second_run',
        leaderboard_position: null,
      },
      error: null,
    });

    const result = await finalizePioneerRun({
      trailId: 'trail-uuid-0001',
      runPayload: BASE_RUN_PAYLOAD,
      geometry: BASE_GEOMETRY,
    });

    // Wrapper forwards every flat param correctly to finalize_seed_run.
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'finalize_seed_run',
      expect.objectContaining({
        p_trail_id: 'trail-uuid-0001',
        p_duration_ms: PARKOWA_DURATION_MS,
        p_median_accuracy_m: 4.2,
        p_quality_tier: 'valid',
        p_verification_status: 'verified',
        p_started_at: STARTED_AT,
        p_finished_at: FINISHED_AT,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        runId: 'run-uuid-happy',
        isPioneer: true,
        trailStatus: 'fresh_pending_second_run',
        leaderboardPosition: null,
      });
    }
  });

  test('(b) insufficient GPS points — RPC emits too_few_points with polish copy', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, code: 'too_few_points', observed: 12, required: 15 },
      error: null,
    });

    const result = await finalizePioneerRun({
      trailId: 'trail-uuid-0001',
      runPayload: BASE_RUN_PAYLOAD,
      geometry: { ...BASE_GEOMETRY, points: makeTrace(12) },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('too_few_points');
      expect(result.message).toMatch(/Za mało punktów GPS/);
    }
  });

  test('(c) trail already finalised — already_pioneered with Polish copy', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, code: 'already_pioneered' },
      error: null,
    });

    const result = await finalizePioneerRun({
      trailId: 'trail-uuid-pioneered',
      runPayload: BASE_RUN_PAYLOAD,
      geometry: BASE_GEOMETRY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('already_pioneered');
      expect(result.message).toMatch(/Pioneera/i);
    }
  });

  test('(d) missing spot_id — server rejects as trail_not_found (client-side guard flagged in PR)', async () => {
    // Sprint-4 RPC derives spot_id server-side from trail.spot_id; the
    // PioneerRunPayload.spot_id field is carried for client bookkeeping
    // only. An empty trailId is the canonical "missing context" signal
    // the server can reject. Caller-side guards (app/run/review.tsx +
    // runStore) are expected to prevent empty trailId reaching the RPC
    // but are NOT enforced in the wrapper itself — see PR description.
    mockRpc.mockResolvedValueOnce({
      data: { ok: false, code: 'trail_not_found' },
      error: null,
    });

    const result = await finalizePioneerRun({
      trailId: '',
      runPayload: { ...BASE_RUN_PAYLOAD, spot_id: '' },
      geometry: BASE_GEOMETRY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('trail_not_found');
      expect(result.message).toMatch(/Trasa nie istnieje/);
    }
  });

  test('(e) corridor rescue / weak_signal — trail persists, run flagged', async () => {
    // The gate engine can accept a run whose GPS quality was barely
    // inside the rescue corridor. The verification_status carried from
    // the client is 'weak_signal' and the quality_tier downgrades to
    // 'rough'. Server still seeds the trail (ok=true) because the
    // geometry passed Pioneer thresholds — the run itself inherits the
    // flagged state so the UI can badge it on /run/result.
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        run_id: 'run-uuid-rescue',
        seed_source: 'rider',
        trust_tier: 'provisional',
        version_id: 'version-uuid-rescue',
        trail_status: 'fresh_pending_second_run',
        leaderboard_position: null,
      },
      error: null,
    });

    const result = await finalizePioneerRun({
      trailId: 'trail-uuid-rescue',
      runPayload: {
        ...BASE_RUN_PAYLOAD,
        verification_status: 'weak_signal',
        quality_tier: 'rough',
        median_accuracy_m: 9.8,
      },
      geometry: BASE_GEOMETRY,
    });

    // Wrapper must forward the weak_signal flag verbatim — if it
    // accidentally upgraded to 'verified' we'd pollute the leaderboard.
    expect(mockRpc).toHaveBeenCalledWith(
      'finalize_seed_run',
      expect.objectContaining({
        p_verification_status: 'weak_signal',
        p_quality_tier: 'rough',
        p_median_accuracy_m: 9.8,
      }),
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        runId: 'run-uuid-rescue',
        isPioneer: true,
        trailStatus: 'fresh_pending_second_run',
        leaderboardPosition: null,
      });
    }
  });

  // ── spot_auto_activated plumbing (migration 20260423190000) ──
  //
  // The SQL migration itself only runs against a live Postgres, but
  // we can still pin the contract between the server's new flag and
  // the client SeedRunResult shape. If a future migration drops the
  // field or renames it to e.g. `spot_activated`, this catches the
  // drift — the whole submitter-self-active feature hinges on it.

  test('spot_auto_activated:true plumbs to SeedRunResult.spotAutoActivated', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        run_id: 'run-uuid-self-active',
        seed_source: 'rider',
        trust_tier: 'provisional',
        version_id: 'version-uuid-2',
        trail_status: 'fresh_pending_second_run',
        leaderboard_position: null,
        spot_auto_activated: true,
      },
      error: null,
    });

    const result = await finalizeSeedRun({
      trailId: 'trail-uuid-0001',
      geometry: BASE_GEOMETRY,
      durationMs: BASE_RUN_PAYLOAD.duration_ms,
      gpsTrace: null,
      medianAccuracyM: 4.2,
      qualityTier: 'valid',
      verificationStatus: 'verified',
      startedAt: new Date(STARTED_AT),
      finishedAt: new Date(FINISHED_AT),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.spotAutoActivated).toBe(true);
    }
  });

  test('missing spot_auto_activated (already-active spot) yields false, not undefined', async () => {
    // Non-submitter pioneers on an already-active park must not
    // get a celebratory toast. The RPC leaves the flag false /
    // omits it, and the wrapper defaults to `false` rather than
    // leaking an undefined into the UI.
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        run_id: 'run-uuid-already-active',
        seed_source: 'rider',
        trust_tier: 'provisional',
        version_id: 'version-uuid-3',
        leaderboard_position: 2,
        // spot_auto_activated omitted on purpose — pre-migration
        // responses and non-flip paths both look like this.
      },
      error: null,
    });

    const result = await finalizeSeedRun({
      trailId: 'trail-uuid-0002',
      geometry: BASE_GEOMETRY,
      durationMs: BASE_RUN_PAYLOAD.duration_ms,
      gpsTrace: null,
      medianAccuracyM: 4.2,
      qualityTier: 'valid',
      verificationStatus: 'verified',
      startedAt: new Date(STARTED_AT),
      finishedAt: new Date(FINISHED_AT),
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.spotAutoActivated).toBe(false);
    }
  });

  test('raw Supabase error passes through as rpc_failed', async () => {
    // The wrapper must never rethrow — consumers of ApiResult rely on
    // a discriminated union. Any PostgREST / transport failure should
    // surface as ok:false + code:'rpc_failed' with the canonical copy.
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'fetch failed' },
    });

    const result = await finalizePioneerRun({
      trailId: 'trail-uuid-0001',
      runPayload: BASE_RUN_PAYLOAD,
      geometry: BASE_GEOMETRY,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('rpc_failed');
      expect(result.message).toMatch(/Nie udało się zapisać zjazdu/);
    }
  });
});
