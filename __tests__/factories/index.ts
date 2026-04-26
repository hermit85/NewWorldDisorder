// ═══════════════════════════════════════════════════════════
// Test factories for NWD DB row + client object shapes.
//
// Centralised so individual tests don't have to spell out 30
// columns each time the schema grows. Every factory accepts a
// partial overrides object that Object.assign merges on top of
// the defaults — pass only what the test cares about.
//
// Defaults are deliberately boring (zeroes / nulls / fixed UUIDs)
// so accidental cross-test interaction stays visible.
// ═══════════════════════════════════════════════════════════

import type {
  DbRun,
  DbTrail,
  DbTrailVersion,
  Profile,
} from '@/lib/database.types';
import type { FinalizedRun } from '@/systems/runStore';

const FIXED_UUID = '00000000-0000-0000-0000-000000000001';
const FIXED_USER_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_TRAIL_ID = 'pioneer-test001';
const FIXED_SPOT_ID = 'spot-test';
const FIXED_VERSION_ID = '22222222-2222-2222-2222-222222222222';
const FIXED_TIME = '2026-04-26T10:00:00.000Z';

export function makeDbRun(overrides: Partial<DbRun> = {}): DbRun {
  return {
    id: FIXED_UUID,
    user_id: FIXED_USER_ID,
    trail_id: FIXED_TRAIL_ID,
    spot_id: FIXED_SPOT_ID,
    trail_version_id: FIXED_VERSION_ID,
    mode: 'ranked',
    started_at: FIXED_TIME,
    finished_at: FIXED_TIME,
    duration_ms: 90_000,
    verification_status: 'verified',
    verification_summary: null,
    gps_trace: null,
    counted_in_leaderboard: true,
    is_pb: false,
    xp_awarded: 100,
    created_at: FIXED_TIME,
    matched_geometry_version_id: FIXED_VERSION_ID,
    match_score: 1.0,
    recording_mode: 'normal',
    run_quality_status: null,
    timing_confidence: 1.0,
    computed_time_ms: 88_500,
    start_crossed_at: FIXED_TIME,
    finish_crossed_at: FIXED_TIME,
    rejection_reason: null,
    ...overrides,
  };
}

export function makeDbTrail(overrides: Partial<DbTrail> = {}): DbTrail {
  return {
    id: FIXED_TRAIL_ID,
    spot_id: FIXED_SPOT_ID,
    official_name: 'Test Trail',
    short_name: 'Test',
    game_label: '',
    difficulty: 'medium',
    trail_type: 'flow',
    distance_m: 1500,
    avg_grade_pct: 12,
    elevation_drop_m: 180,
    description: '',
    game_flavor: '',
    is_race_trail: true,
    is_active: true,
    sort_order: 1,
    created_at: FIXED_TIME,
    pioneer_user_id: FIXED_USER_ID,
    pioneered_at: FIXED_TIME,
    calibration_status: 'fresh_pending_second_run',
    geometry: { points: [] },
    runs_contributed: 1,
    seed_source: 'rider',
    trust_tier: 'provisional',
    current_version_id: FIXED_VERSION_ID,
    confidence_label: 'fresh',
    consistent_pioneer_runs_count: 1,
    unique_confirming_riders_count: 0,
    normalized_name: 'test trail',
    duplicate_base_key: 'test trail',
    verified_at: null,
    ...overrides,
  };
}

export function makeDbTrailVersion(
  overrides: Partial<DbTrailVersion> = {},
): DbTrailVersion {
  return {
    id: FIXED_VERSION_ID,
    trail_id: FIXED_TRAIL_ID,
    version_number: 1,
    geometry: { points: [] },
    created_by: FIXED_USER_ID,
    created_at: FIXED_TIME,
    superseded_at: null,
    superseded_by_version_id: null,
    is_current: true,
    status: 'canonical',
    source_run_id: null,
    source_user_id: FIXED_USER_ID,
    source_type: 'pioneer',
    confidence_score: 0.35,
    supporters_count: 0,
    start_gate: null,
    finish_gate: null,
    route_corridor_radius_m: 15,
    direction_type: 'descending',
    distance_m: 1500,
    elevation_drop_m: 180,
    archived_at: null,
    rejection_reason: null,
    became_canonical_at: FIXED_TIME,
    ...overrides,
  };
}

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: FIXED_USER_ID,
    username: 'rider_test',
    display_name: 'Rider Test',
    avatar_url: null,
    rank_id: 'rookie',
    xp: 0,
    total_runs: 0,
    total_pbs: 0,
    best_position: null,
    favorite_trail_id: null,
    role: 'rider',
    pioneered_total_count: 0,
    pioneered_verified_count: 0,
    streak_days: 0,
    streak_last_ride_at: null,
    streak_grace_expires_at: null,
    created_at: FIXED_TIME,
    updated_at: FIXED_TIME,
    ...overrides,
  };
}

export function makeFinalizedRun(
  overrides: Partial<FinalizedRun> = {},
): FinalizedRun {
  return {
    sessionId: 'session-test',
    trailId: FIXED_TRAIL_ID,
    spotId: FIXED_SPOT_ID,
    trailName: 'Test Trail',
    mode: 'ranked',
    durationMs: 90_000,
    startedAt: 1_777_044_915_000,
    userId: FIXED_USER_ID,
    verification: null,
    saveStatus: 'pending',
    backendResult: null,
    xpAwarded: 100,
    traceSnapshot: null,
    qualityTier: 'valid',
    updatedAt: 1_777_045_010_000,
    ...overrides,
  };
}

export const TEST_IDS = {
  uuid: FIXED_UUID,
  userId: FIXED_USER_ID,
  trailId: FIXED_TRAIL_ID,
  spotId: FIXED_SPOT_ID,
  versionId: FIXED_VERSION_ID,
  time: FIXED_TIME,
} as const;
