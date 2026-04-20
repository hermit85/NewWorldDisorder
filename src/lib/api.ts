// ═══════════════════════════════════════════════════════════
// API Layer — Supabase service functions
// All backend reads and writes go through this module
// ═══════════════════════════════════════════════════════════

import { supabase } from './supabase';

// All functions in this module return empty/null when supabase is null (demo mode).
// The useBackend hook handles fallback to mock data.

function db() {
  if (!supabase) throw new Error('Supabase not configured');
  return supabase;
}
import { Profile, DbRun, DbLeaderboardEntry, DbChallenge, DbChallengeProgress } from './database.types';
import { RunTrace } from '@/systems/traceCapture';
import { VerificationResult, RunMode } from '@/data/verificationTypes';
import { getRankForXp } from '@/systems/ranks';

// ═══════════════════════════════════════════════════════════
// PROFILES
// ═══════════════════════════════════════════════════════════

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw new Error(`fetchProfile failed: ${error.message}`);
  return data;
}

/**
 * Atomically increment profile XP using database-level RPC.
 * Prevents race conditions on concurrent run submissions.
 * Also auto-computes and updates rank_id.
 */
export async function updateProfileXp(userId: string, xpToAdd: number): Promise<{ xp: number; rankId: string } | null> {
  if (xpToAdd <= 0) return null;

  const { data, error } = await db().rpc('increment_profile_xp', {
    p_user_id: userId,
    p_xp_to_add: xpToAdd,
  });

  if (error) {
    console.error('[NWD] increment_profile_xp failed:', error.message);
    // Fallback to non-atomic update if RPC not available (e.g. migration not run)
    return updateProfileXpFallback(userId, xpToAdd);
  }

  const result = data as { xp: number; rank_id: string; xp_added: number } | null;
  if (!result || result.xp === undefined) return null;

  return { xp: result.xp, rankId: result.rank_id };
}

/** Fallback for pre-migration environments — uses select+update (non-atomic).
 *  WARNING: concurrent calls may lose XP. RPC should be deployed ASAP. */
async function updateProfileXpFallback(userId: string, xpToAdd: number): Promise<{ xp: number; rankId: string } | null> {
  console.warn('[NWD] XP fallback used — RPC not available. Deploy increment_profile_xp migration.');

  const { data: current } = await db()
    .from('profiles')
    .select('xp')
    .eq('id', userId)
    .single();

  if (!current) return null;

  const newXp = (current.xp ?? 0) + xpToAdd;
  const newRank = getRankForXp(newXp);

  const { error } = await db()
    .from('profiles')
    .update({ xp: newXp, rank_id: newRank.id, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    console.error('[NWD] XP fallback update failed:', error.message);
    return null;
  }

  return { xp: newXp, rankId: newRank.id };
}

/**
 * Atomically increment profile run counters using database RPC.
 * Returns new totals or falls back to non-atomic for pre-migration environments.
 */
export async function incrementProfileRuns(userId: string, isPb: boolean): Promise<{ totalRuns: number; totalPbs: number } | null> {
  // Try atomic RPC first
  const { data, error } = await db().rpc('increment_profile_runs', {
    p_user_id: userId,
    p_is_pb: isPb,
  });

  if (!error && data) {
    const result = data as { total_runs: number; total_pbs: number };
    return { totalRuns: result.total_runs, totalPbs: result.total_pbs };
  }

  // Fallback: non-atomic (pre-migration environments)
  const { data: current } = await db()
    .from('profiles')
    .select('total_runs, total_pbs')
    .eq('id', userId)
    .single();

  if (!current) return null;

  const newRuns = current.total_runs + 1;
  const newPbs = isPb ? current.total_pbs + 1 : current.total_pbs;

  await db().from('profiles').update({
    total_runs: newRuns,
    total_pbs: newPbs,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  return { totalRuns: newRuns, totalPbs: newPbs };
}

/** Update best_position — only improves (lower number = better) */
async function updateBestPosition(userId: string, position: number): Promise<void> {
  const { data: current } = await db()
    .from('profiles')
    .select('best_position')
    .eq('id', userId)
    .single();

  if (!current) return;
  // Only update if better than current (or first time)
  if (current.best_position === null || position < current.best_position) {
    await db().from('profiles').update({
      best_position: position,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }
}

/** Update favorite_trail_id — trail with most runs */
async function updateFavoriteTrail(userId: string, latestTrailId: string): Promise<void> {
  // Simple approach: just set to the latest trail the user ran on.
  // For true "most runs" tracking, we'd need a GROUP BY query.
  // This is good enough for v1 — active riders' favorite will converge.
  await db().from('profiles').update({
    favorite_trail_id: latestTrailId,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
}

// ═══════════════════════════════════════════════════════════
// RUNS
// ═══════════════════════════════════════════════════════════

export interface SubmitRunParams {
  userId: string;
  spotId: string;
  trailId: string;
  mode: RunMode;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  verification: VerificationResult;
  trace: RunTrace;
  xpAwarded: number;
  /** Quality tier from gate engine (PERFECT/VALID/ROUGH) */
  qualityTier?: 'perfect' | 'valid' | 'rough';
}

export interface SubmitRunResult {
  run: DbRun;
  leaderboardResult: {
    position: number;
    previousPosition: number | null;
    delta: number;
    isNewBest: boolean;
  } | null;
  isPb: boolean;
  /** Previous best time in ms — null if first ranked run on this trail */
  previousBestMs: number | null;
}

export async function submitRun(params: SubmitRunParams): Promise<SubmitRunResult | null> {
  const {
    userId, spotId, trailId, mode, startedAt, finishedAt,
    durationMs, verification, trace, xpAwarded, qualityTier,
  } = params;

  const isLeaderboardEligible = verification.isLeaderboardEligible;

  // Check if this is a PB
  let isPb = false;
  let previousBestMs: number | null = null;
  if (isLeaderboardEligible) {
    const { data: existingBest } = await db()
      .from('runs')
      .select('duration_ms')
      .eq('user_id', userId)
      .eq('trail_id', trailId)
      .eq('counted_in_leaderboard', true)
      .order('duration_ms', { ascending: true })
      .limit(1)
      .single();

    previousBestMs = existingBest?.duration_ms ?? null;
    isPb = !existingBest || durationMs < existingBest.duration_ms;
  }

  // Slim down GPS trace for storage (remove raw points array, keep summary)
  const traceForStorage = {
    pointCount: trace.points.length,
    startedAt: trace.startedAt,
    finishedAt: trace.finishedAt,
    durationMs: trace.durationMs,
    mode: trace.mode,
    // Store only every Nth point to save space
    sampledPoints: trace.points.filter((_, i) => i % 3 === 0).map(p => ({
      lat: Math.round(p.latitude * 1e6) / 1e6,
      lng: Math.round(p.longitude * 1e6) / 1e6,
      t: p.timestamp,
    })),
  };

  // Insert run
  const { data: run, error } = await db()
    .from('runs')
    .insert({
      user_id: userId,
      spot_id: spotId,
      trail_id: trailId,
      mode,
      started_at: new Date(startedAt).toISOString(),
      finished_at: new Date(finishedAt).toISOString(),
      duration_ms: durationMs,
      verification_status: verification.status,
      verification_summary: { ...verification, qualityTier: qualityTier ?? null } as any,
      gps_trace: traceForStorage as any,
      is_pb: isPb,
      xp_awarded: xpAwarded,
      counted_in_leaderboard: isLeaderboardEligible,
    })
    .select()
    .single();

  if (error || !run) {
    console.error('[NWD] Failed to submit run:', error);
    return null;
  }

  // Update leaderboard if eligible
  let leaderboardResult = null;
  if (isLeaderboardEligible) {
    const { data } = await db().rpc('upsert_leaderboard_entry', {
      p_user_id: userId,
      p_trail_id: trailId,
      p_period_type: 'all_time',
      p_duration_ms: durationMs,
      p_run_id: run.id,
    });

    if (data) {
      leaderboardResult = {
        position: (data as any).position,
        previousPosition: (data as any).previous_position,
        delta: (data as any).delta,
        isNewBest: (data as any).is_new_best,
      };
    }
  }

  // Update profile stats (atomic RPCs)
  const runCounts = await incrementProfileRuns(userId, isPb);
  if (xpAwarded > 0) {
    await updateProfileXp(userId, xpAwarded);
  }

  // Update best_position if this run achieved a better leaderboard spot
  if (leaderboardResult && leaderboardResult.position > 0) {
    await updateBestPosition(userId, leaderboardResult.position);
  }

  // Update favorite_trail_id based on most runs
  if (runCounts) {
    await updateFavoriteTrail(userId, trailId);
  }

  return { run, leaderboardResult, isPb, previousBestMs };
}

// ═══════════════════════════════════════════════════════════
// LEADERBOARD
// ═══════════════════════════════════════════════════════════

export interface LeaderboardRow {
  userId: string;
  username: string;
  displayName: string;
  rankId: string;
  trailId: string;
  periodType: string;
  bestDurationMs: number;
  rankPosition: number;
  previousPosition: number | null;
  delta: number;
  gapToLeader: number;
  isCurrentUser: boolean;
  avatarUrl: string | null;
}

export async function fetchLeaderboard(
  trailId: string,
  periodType: string = 'all_time',
  currentUserId?: string,
): Promise<LeaderboardRow[]> {
  const { data: entries, error } = await db()
    .from('leaderboard_entries')
    .select(`
      *,
      profiles!inner (
        username,
        display_name,
        rank_id,
        avatar_url
      )
    `)
    .eq('trail_id', trailId)
    .eq('period_type', periodType)
    .order('rank_position', { ascending: true })
    .limit(50);

  if (error) throw new Error(`fetchLeaderboard failed: ${error.message}`);
  if (!entries) return [];

  const leaderTime = entries[0]?.best_duration_ms ?? 0;

  return entries.map((e: any) => ({
    userId: e.user_id,
    username: e.profiles.username,
    displayName: e.profiles.display_name,
    rankId: e.profiles.rank_id,
    trailId: e.trail_id,
    periodType: e.period_type,
    bestDurationMs: e.best_duration_ms,
    rankPosition: e.rank_position,
    previousPosition: e.previous_position,
    delta: e.previous_position ? e.previous_position - e.rank_position : 0,
    gapToLeader: e.best_duration_ms - leaderTime,
    isCurrentUser: e.user_id === currentUserId,
    avatarUrl: e.profiles.avatar_url ?? null,
  }));
}

// ═══════════════════════════════════════════════════════════
// TODAY / WEEKEND LEADERBOARD (computed from runs table)
// ═══════════════════════════════════════════════════════════

function todayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function weekendStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 6=Sat
  // Find most recent Saturday 00:00
  const diff = day === 0 ? 1 : day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchScopedLeaderboard(
  trailId: string,
  scope: 'today' | 'weekend',
  currentUserId?: string,
): Promise<LeaderboardRow[]> {
  const since = scope === 'today' ? todayStart() : weekendStart();

  // Query runs grouped by user, best time per user on this trail since cutoff
  const { data, error } = await db()
    .from('runs')
    .select(`
      user_id,
      duration_ms,
      trail_id,
      profiles!inner (
        username,
        display_name,
        rank_id,
        avatar_url
      )
    `)
    .eq('trail_id', trailId)
    .eq('counted_in_leaderboard', true)
    .gte('started_at', since)
    .order('duration_ms', { ascending: true });

  if (error) throw new Error(`fetchScopedLeaderboard failed: ${error.message}`);
  if (!data || data.length === 0) return [];

  // Deduplicate: keep only best time per user
  const bestByUser = new Map<string, any>();
  for (const run of data) {
    if (!bestByUser.has(run.user_id) || run.duration_ms < bestByUser.get(run.user_id).duration_ms) {
      bestByUser.set(run.user_id, run);
    }
  }

  const sorted = Array.from(bestByUser.values()).sort((a, b) => a.duration_ms - b.duration_ms);
  const leaderTime = sorted[0]?.duration_ms ?? 0;

  return sorted.map((e: any, i: number) => ({
    userId: e.user_id,
    username: (e.profiles as any).username,
    displayName: (e.profiles as any).display_name,
    rankId: (e.profiles as any).rank_id,
    trailId: e.trail_id,
    periodType: scope,
    bestDurationMs: e.duration_ms,
    rankPosition: i + 1,
    previousPosition: null,
    delta: 0,
    gapToLeader: e.duration_ms - leaderTime,
    isCurrentUser: e.user_id === currentUserId,
    avatarUrl: (e.profiles as any).avatar_url ?? null,
  }));
}

// ═══════════════════════════════════════════════════════════
// VENUE ACTIVITY SUMMARY
// ═══════════════════════════════════════════════════════════

export interface VenueActivity {
  verifiedRunsToday: number;
  activeRidersToday: number;
  hotTrailId: string | null;
  hotTrailRuns: number;
}

export async function fetchVenueActivity(spotId: string): Promise<VenueActivity> {
  const since = todayStart();

  const { data: runs, error } = await db()
    .from('runs')
    .select('user_id, trail_id')
    .eq('spot_id', spotId)
    .eq('counted_in_leaderboard', true)
    .gte('started_at', since);

  if (error) throw new Error(`fetchVenueActivity failed: ${error.message}`);
  if (!runs || runs.length === 0) {
    return { verifiedRunsToday: 0, activeRidersToday: 0, hotTrailId: null, hotTrailRuns: 0 };
  }

  const uniqueRiders = new Set(runs.map(r => r.user_id));

  // Find hottest trail (most runs today)
  const trailCounts = new Map<string, number>();
  for (const r of runs) {
    trailCounts.set(r.trail_id, (trailCounts.get(r.trail_id) ?? 0) + 1);
  }
  let hotTrailId: string | null = null;
  let hotTrailRuns = 0;
  for (const [tid, count] of trailCounts) {
    if (count > hotTrailRuns) {
      hotTrailId = tid;
      hotTrailRuns = count;
    }
  }

  return {
    verifiedRunsToday: runs.length,
    activeRidersToday: uniqueRiders.size,
    hotTrailId,
    hotTrailRuns,
  };
}

// ═══════════════════════════════════════════════════════════
// RIDER BOARD CONTEXT — for re-engagement signals
// ═══════════════════════════════════════════════════════════

export interface RiderBoardContextRow {
  trailId: string;
  allTimePosition: number | null;
  todayPosition: number | null;
  weekendPosition: number | null;
  todayBoardSize: number;
  weekendBoardSize: number;
  allTimeBoardSize: number;
}

export async function fetchRiderBoardContext(
  userId: string,
  trailIds: string[],
): Promise<RiderBoardContextRow[]> {
  const results: RiderBoardContextRow[] = [];

  for (const trailId of trailIds) {
    let allTimePos: number | null = null;
    let allTimeSize = 0;
    let todayPos: number | null = null;
    let todaySize = 0;
    let weekendPos: number | null = null;
    let weekendSize = 0;

    try {
      const allTime = await fetchLeaderboard(trailId, 'all_time', userId);
      allTimeSize = allTime.length;
      allTimePos = allTime.find(r => r.isCurrentUser)?.rankPosition ?? null;
    } catch {}

    try {
      const today = await fetchScopedLeaderboard(trailId, 'today', userId);
      todaySize = today.length;
      todayPos = today.find(r => r.isCurrentUser)?.rankPosition ?? null;
    } catch {}

    try {
      const weekend = await fetchScopedLeaderboard(trailId, 'weekend', userId);
      weekendSize = weekend.length;
      weekendPos = weekend.find(r => r.isCurrentUser)?.rankPosition ?? null;
    } catch {}

    results.push({
      trailId,
      allTimePosition: allTimePos,
      todayPosition: todayPos,
      weekendPosition: weekendPos,
      todayBoardSize: todaySize,
      weekendBoardSize: weekendSize,
      allTimeBoardSize: allTimeSize,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════
// RESULT IMPACT — scoped board position after a run
// ═══════════════════════════════════════════════════════════

export interface ScopeImpact {
  scope: 'today' | 'weekend' | 'all_time';
  position: number | null;  // null = not on board for this scope
  totalRiders: number;
}

export async function fetchResultImpact(
  userId: string,
  trailId: string,
): Promise<ScopeImpact[]> {
  const results: ScopeImpact[] = [];

  // Today
  try {
    const todayBoard = await fetchScopedLeaderboard(trailId, 'today', userId);
    const myToday = todayBoard.find(r => r.isCurrentUser);
    results.push({
      scope: 'today',
      position: myToday?.rankPosition ?? null,
      totalRiders: todayBoard.length,
    });
  } catch {
    // skip today if failed
  }

  // Weekend
  try {
    const weekendBoard = await fetchScopedLeaderboard(trailId, 'weekend', userId);
    const myWeekend = weekendBoard.find(r => r.isCurrentUser);
    results.push({
      scope: 'weekend',
      position: myWeekend?.rankPosition ?? null,
      totalRiders: weekendBoard.length,
    });
  } catch {
    // skip weekend if failed
  }

  // All-time (from leaderboard_entries table)
  try {
    const allTimeBoard = await fetchLeaderboard(trailId, 'all_time', userId);
    const myAllTime = allTimeBoard.find(r => r.isCurrentUser);
    results.push({
      scope: 'all_time',
      position: myAllTime?.rankPosition ?? null,
      totalRiders: allTimeBoard.length,
    });
  } catch {
    // skip all-time if failed
  }

  return results;
}

// ═══════════════════════════════════════════════════════════
// RUNS HISTORY
// ═══════════════════════════════════════════════════════════

export async function fetchUserRuns(userId: string, limit: number = 20): Promise<DbRun[]> {
  const { data, error } = await db()
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`fetchUserRuns failed: ${error.message}`);
  return data ?? [];
}

export async function fetchUserPb(userId: string, trailId: string): Promise<number | null> {
  const { data } = await db()
    .from('runs')
    .select('duration_ms')
    .eq('user_id', userId)
    .eq('trail_id', trailId)
    .eq('counted_in_leaderboard', true)
    .order('duration_ms', { ascending: true })
    .limit(1)
    .single();

  return data?.duration_ms ?? null;
}

export async function fetchUserTrailStats(userId: string): Promise<Map<string, { pbMs: number | null; position: number | null }>> {
  const result = new Map<string, { pbMs: number | null; position: number | null }>();

  // Get all leaderboard entries for this user
  const { data: entries, error } = await db()
    .from('leaderboard_entries')
    .select('trail_id, best_duration_ms, rank_position')
    .eq('user_id', userId)
    .eq('period_type', 'all_time');

  if (error) throw new Error(`fetchUserTrailStats failed: ${error.message}`);
  if (entries) {
    for (const e of entries) {
      result.set(e.trail_id, {
        pbMs: e.best_duration_ms,
        position: e.rank_position,
      });
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// CHALLENGES
// ═══════════════════════════════════════════════════════════

export async function fetchActiveChallenges(spotId: string): Promise<DbChallenge[]> {
  const { data, error } = await db()
    .from('challenges')
    .select('*')
    .eq('spot_id', spotId)
    .eq('is_active', true)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) throw new Error(`fetchActiveChallenges failed: ${error.message}`);
  return data ?? [];
}

export async function fetchChallengeProgress(
  userId: string,
  challengeIds: string[],
): Promise<Map<string, DbChallengeProgress>> {
  if (challengeIds.length === 0) return new Map();

  const { data } = await db()
    .from('challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .in('challenge_id', challengeIds);

  const map = new Map<string, DbChallengeProgress>();
  if (data) {
    for (const p of data) {
      map.set(p.challenge_id, p);
    }
  }
  return map;
}

/**
 * Increment challenge progress and check for completion.
 * If challenge is completed, awards reward_xp to profile (atomic via RPC).
 * Returns whether the challenge was just completed by this increment.
 */
export async function incrementChallengeProgress(
  userId: string,
  challengeId: string,
  increment: number = 1,
): Promise<{ justCompleted: boolean; rewardXp: number }> {
  // Get challenge metadata for reward and target
  const { data: challenge } = await db()
    .from('challenges')
    .select('type, reward_xp')
    .eq('id', challengeId)
    .single();

  // Target value based on challenge type (no explicit target column in schema)
  const targetForType: Record<string, number> = {
    run_count: 3,
    pb_improvement: 1,
    fastest_time: 1,
  };
  const target = targetForType[challenge?.type ?? ''] ?? 1;

  // Upsert challenge progress
  const { data: existing } = await db()
    .from('challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .single();

  const wasCompleted = existing ? existing.current_value >= target : false;
  const newValue = (existing?.current_value ?? 0) + increment;

  if (existing) {
    await db()
      .from('challenge_progress')
      .update({ current_value: newValue })
      .eq('id', existing.id);
  } else {
    await db().from('challenge_progress').insert({
      user_id: userId,
      challenge_id: challengeId,
      current_value: increment,
    });
  }

  // Check if just completed (wasn't complete before, is now)
  const justCompleted = !wasCompleted && newValue >= target;
  let rewardXp = 0;

  if (justCompleted && challenge?.reward_xp && challenge.reward_xp > 0) {
    rewardXp = challenge.reward_xp;
    // Award challenge XP atomically
    await updateProfileXp(userId, rewardXp);
  }

  return { justCompleted, rewardXp };
}

// ═══════════════════════════════════════════════════════════
// ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════

export async function fetchUserAchievements(userId: string) {
  const { data, error } = await db()
    .from('user_achievements')
    .select(`
      *,
      achievements!inner (*)
    `)
    .eq('user_id', userId);

  if (error) throw new Error(`fetchUserAchievements failed: ${error.message}`);
  return data ?? [];
}

/**
 * Unlock achievement and atomically grant its XP reward.
 * Idempotent: re-calling for already-unlocked achievement returns success
 * without double-granting XP (handled by database RPC).
 */
export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  // Try atomic RPC first (grants XP + prevents duplicate XP)
  const { data, error: rpcError } = await db().rpc('unlock_achievement_with_xp', {
    p_user_id: userId,
    p_achievement_id: achievementId,
  });

  if (!rpcError && data) {
    return true;
  }

  // Fallback: simple upsert without XP (pre-migration environments)
  const { error } = await db()
    .from('user_achievements')
    .upsert(
      { user_id: userId, achievement_id: achievementId },
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
    );

  if (error) {
    console.warn('[NWD] Achievement unlock failed:', achievementId, error.message);
  }
  return !error;
}

// ═══════════════════════════════════════════════════════════
// SPOTS & TRAILS (backed by DB, app-type shape)
// ═══════════════════════════════════════════════════════════

import { Spot, Trail, Difficulty, TrailType } from '@/data/types';
import { DbSpot, DbTrail } from './database.types';

function mapSpot(row: DbSpot): Spot {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    region: row.region,
    isOfficial: row.is_official,
    coverImage: '',
    // App-side `Spot.status` only models public visibility; DB's
    // 'pending' | 'rejected' collapse to 'closed' for the consumer.
    status: row.status === 'active' ? 'active' : 'closed',
    submissionStatus: row.status,
    activeRidersToday: 0,
    trailCount: 0,
  };
}

function mapTrail(row: DbTrail, pioneerUsername: string | null = null): Trail {
  return {
    id: row.id,
    spotId: row.spot_id,
    name: row.official_name,
    slug: row.id,
    description: row.description,
    difficulty: row.difficulty as Difficulty,
    trailType: row.trail_type as TrailType,
    distanceM: row.distance_m,
    elevationDropM: row.elevation_drop_m,
    isOfficial: true,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    calibrationStatus: row.calibration_status,
    geometryMissing: row.geometry === null,
    // Sprint 4 (mig 011) — trust + pioneer
    seedSource:       row.seed_source,
    trustTier:        row.trust_tier,
    currentVersionId: row.current_version_id,
    pioneerUserId:    row.pioneer_user_id,
    pioneerUsername,
    pioneeredAt:      row.pioneered_at,
  };
}

export async function fetchSpots(): Promise<ApiResult<Spot[]>> {
  const { data, error } = await db()
    .from('spots')
    .select('*')
    .eq('status', 'active')
    .order('name');
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  return { ok: true, data: (data ?? []).map(mapSpot) };
}

export async function fetchSpot(id: string): Promise<ApiResult<Spot>> {
  const { data, error } = await db()
    .from('spots')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  if (!data) return { ok: false, code: 'not_found' };
  return { ok: true, data: mapSpot(data) };
}

export async function fetchTrails(spotId: string): Promise<ApiResult<Trail[]>> {
  const { data, error } = await db()
    .from('trails')
    .select('*')
    .eq('spot_id', spotId)
    .eq('is_active', true)
    .eq('is_race_trail', true)
    .order('sort_order');
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  // Explicit arrow: mapTrail now takes an optional second arg; passing
  // it naked to .map() tries to bind `index: number` to `pioneerUsername: string | null`.
  return { ok: true, data: (data ?? []).map((row) => mapTrail(row)) };
}

export async function fetchTrail(id: string): Promise<ApiResult<Trail>> {
  // Join pioneer profile for the display username — second round-trip
  // would be cheap but one query is cleaner. `pioneer:profiles!...`
  // syntax tells PostgREST to use the pioneer_user_id FK.
  const { data, error } = await db()
    .from('trails')
    .select('*, pioneer:profiles!trails_pioneer_user_id_fkey(username)')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  if (!data) return { ok: false, code: 'not_found' };
  const pioneerUsername =
    (data as { pioneer: { username: string } | null }).pioneer?.username ?? null;
  return { ok: true, data: mapTrail(data as DbTrail, pioneerUsername) };
}

// ═══════════════════════════════════════════════════════════
// SPOT SUBMISSION (Sprint 2)
// ═══════════════════════════════════════════════════════════

// Discriminated-union result for spot submission paths.
export type ApiOk<T>  = { ok: true;  data: T };
export type ApiErr    = { ok: false; code: string; message?: string; extra?: Record<string, unknown> };
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface PendingSpot {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'rejected';
  submittedBy: string | null;
  submitterUsername: string | null;
  submittedAt: string;
  approvedAt: string | null;
  rejectionReason: string | null;
  centerLat: number | null;
  centerLng: number | null;
}

function mapPendingSpot(row: any): PendingSpot {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    submittedBy: row.submitted_by ?? null,
    submitterUsername: row.submitter?.username ?? null,
    submittedAt: row.created_at,
    approvedAt: row.approved_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    centerLat: row.center_lat ?? null,
    centerLng: row.center_lng ?? null,
  };
}

export async function submitSpot(params: {
  name: string;
  lat: number;
  lng: number;
}): Promise<ApiResult<{ spotId: string }>> {
  const { data, error } = await db().rpc('submit_spot', {
    p_name: params.name,
    p_lat: params.lat,
    p_lng: params.lng,
  });

  if (error) {
    return { ok: false, code: 'rpc_error', message: error.message };
  }
  const res = data as any;
  if (res?.ok === true) {
    return { ok: true, data: { spotId: res.spot_id } };
  }
  return {
    ok: false,
    code: res?.code ?? 'unknown',
    extra: {
      nearSpotId: res?.near_spot_id,
      nearSpotName: res?.near_spot_name,
      distanceM: res?.distance_m,
    },
  };
}

export async function listPendingSpots(): Promise<ApiResult<PendingSpot[]>> {
  const { data, error } = await db()
    .from('spots')
    .select('id, name, status, submitted_by, approved_at, rejection_reason, center_lat, center_lng, created_at, submitter:profiles!spots_submitted_by_fkey(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  return { ok: true, data: (data ?? []).map(mapPendingSpot) };
}

export async function listMyPendingSpots(userId: string): Promise<ApiResult<PendingSpot[]>> {
  const { data, error } = await db()
    .from('spots')
    .select('id, name, status, submitted_by, approved_at, rejection_reason, center_lat, center_lng, created_at')
    .eq('submitted_by', userId)
    .in('status', ['pending', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  return { ok: true, data: (data ?? []).map(mapPendingSpot) };
}

export async function approveSpot(spotId: string): Promise<ApiResult<void>> {
  const { data, error } = await db().rpc('approve_spot', { p_spot_id: spotId });
  if (error) return { ok: false, code: 'rpc_error', message: error.message };
  const res = data as any;
  if (res?.ok === true) return { ok: true, data: undefined };
  return { ok: false, code: res?.code ?? 'unknown' };
}

export async function rejectSpot(spotId: string, reason: string): Promise<ApiResult<void>> {
  const { data, error } = await db().rpc('reject_spot', { p_spot_id: spotId, p_reason: reason });
  if (error) return { ok: false, code: 'rpc_error', message: error.message };
  const res = data as any;
  if (res?.ok === true) return { ok: true, data: undefined };
  return { ok: false, code: res?.code ?? 'unknown' };
}

// ═══════════════════════════════════════════════════════════
// PIONEER TRAIL FLOW (Sprint 3)
// ═══════════════════════════════════════════════════════════

// ── Param + result types ──

export interface CreateTrailParams {
  spotId: string;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  trailType: 'downhill' | 'flow' | 'tech' | 'jump';
}

export interface PioneerGeometryPoint {
  lat: number;
  lng: number;
  alt?: number | null;
  t: number;
}

export interface PioneerGeometry {
  version: 1;
  points: PioneerGeometryPoint[];
  meta: {
    totalDistanceM: number;
    totalDescentM: number;
    durationS: number;
    medianAccuracyM: number;
    pioneerRunId?: string;
  };
}

export interface PioneerRunPayload {
  spot_id: string;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  mode: 'ranked' | 'practice';
  verification_status: 'verified' | 'weak_signal';
  verification_summary?: unknown;
  gps_trace?: unknown;
  quality_tier?: 'perfect' | 'valid' | 'rough';
  median_accuracy_m: number;
}

export interface FinalizePioneerRunParams {
  trailId: string;
  runPayload: PioneerRunPayload;
  geometry: PioneerGeometry;
}

export interface PioneerRunResult {
  runId: string;
  isPioneer: true;
  trailStatus: 'calibrating';
  leaderboardPosition: number;
}

// ── Polish error-code → copy maps ──
//
// Keep the strings next to the API surface so UI callers do not
// re-invent copy per screen. `rpc_failed` is the generic network /
// SDK-level fallback; specific server codes come from migration 008.

const CREATE_TRAIL_ERRORS: Record<string, string> = {
  unauthenticated: 'Sesja wygasła. Zaloguj się ponownie.',
  spot_not_found: 'Spot nie istnieje',
  spot_not_active: 'Spot nie jest jeszcze aktywny',
  name_too_short: 'Nazwa trasy musi mieć minimum 3 znaki',
  name_too_long: 'Nazwa trasy może mieć maksimum 60 znaków',
  invalid_difficulty: 'Nieprawidłowa trudność',
  invalid_trail_type: 'Nieprawidłowy typ trasy',
  duplicate_name_in_spot: 'Trasa o tej nazwie już istnieje w tym bike parku',
  rpc_failed: 'Nie udało się utworzyć trasy. Spróbuj ponownie.',
};

const FINALIZE_PIONEER_ERRORS: Record<string, string> = {
  unauthenticated: 'Sesja wygasła. Zaloguj się ponownie.',
  trail_not_found: 'Trasa nie istnieje',
  trail_not_draft: 'Ta trasa została już skalibrowana',
  already_pioneered: 'Ktoś właśnie cię wyprzedził — zjedź jeszcze raz, będziesz #2',
  spot_mismatch: 'Niezgodność spota — odśwież aplikację',
  invalid_geometry: 'Zbyt krótkie nagranie — zjedź dłużej i spróbuj ponownie',
  weak_signal_pioneer:
    'Słaby sygnał GPS. Pierwszy zjazd wyznacza linię dla wszystkich — ' +
    'nie chcemy żeby szum w GPS zniekształcił tor. Spróbuj ponownie.',
  rpc_failed: 'Nie udało się zapisać zjazdu. Spróbuj ponownie.',
};

function polishError(code: string, map: Record<string, string>): ApiErr {
  return {
    ok: false,
    code,
    message: map[code] ?? map.rpc_failed ?? 'Błąd',
  };
}

// ── createTrail ──

export async function createTrail(
  params: CreateTrailParams,
): Promise<ApiResult<{ trailId: string }>> {
  const { data, error } = await db().rpc('create_trail', {
    p_spot_id: params.spotId,
    p_name: params.name,
    p_difficulty: params.difficulty,
    p_trail_type: params.trailType,
  });

  if (error) {
    return polishError('rpc_failed', CREATE_TRAIL_ERRORS);
  }
  const res = data as any;
  if (res?.ok === true) {
    return { ok: true, data: { trailId: res.trail_id as string } };
  }
  return polishError(res?.code ?? 'rpc_failed', CREATE_TRAIL_ERRORS);
}

// ── fetchTrailGeometry — lean path for run-screen rehydration ──
//
// Separate from fetchTrail because the geometry jsonb can be 5-10 KB
// per trail; callers that only need metadata (list screens, headers)
// read it via `geometry === null` on the mapped Trail.

export async function fetchTrailGeometry(trailId: string): Promise<ApiResult<unknown>> {
  const { data, error } = await db()
    .from('trails')
    .select('geometry')
    .eq('id', trailId)
    .single();
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  if (!data) return { ok: false, code: 'not_found' };
  return { ok: true, data: (data as { geometry: unknown }).geometry };
}

// ── fetchRun — single run by id (used by Pioneer result flow) ──

export async function fetchRun(runId: string): Promise<ApiResult<DbRun>> {
  const { data, error } = await db()
    .from('runs')
    .select('*')
    .eq('id', runId)
    .single();
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  if (!data) return { ok: false, code: 'not_found' };
  return { ok: true, data: data as DbRun };
}

// ── deleteSpot / deleteTrail (curator cleanup, migration 009) ──
//
// Error propagation: the RPC layer can fail in three distinct ways and
// each deserves its own code so the UI alert surfaces something the
// curator can act on instead of the opaque "spróbuj ponownie":
//   1. PostgREST / network error (e.g. RPC missing, RLS block) → the
//      Supabase client returns `error` with `.message` / `.code`.
//      Preserve both into the ApiErr.extra so __DEV__ callers can log.
//   2. RPC returns { ok: false, code: '...' } (application-level —
//      unauthenticated, unauthorized, …). Map via CLEANUP_ERRORS.
//   3. Thrown exception (rare — JSON parse, etc). Caught below.

const CLEANUP_ERRORS: Record<string, string> = {
  unauthenticated:   'Zaloguj się ponownie',
  unauthorized:      'Tylko curator może usuwać bike parki',
  not_curator:       'Tylko curator może usuwać bike parki',
  spot_not_found:    'Bike park już nie istnieje',
  has_active_trails: 'Bike park ma aktywne trasy — najpierw usuń trasy',
  rpc_missing:       'RPC nie istnieje w bazie (apply migration 009)',
  rpc_exception:     'Błąd bazy',
  rpc_failed:        'RPC zwrócił błąd',
};

function cleanupError(
  code: string,
  extra?: Record<string, unknown>,
): ApiErr {
  return {
    ok: false,
    code,
    message: CLEANUP_ERRORS[code] ?? CLEANUP_ERRORS.rpc_failed,
    ...(extra ? { extra } : {}),
  };
}

/** Shared body for deleteSpot + deleteTrail. Both hit SECURITY DEFINER
 *  RPCs with the same response shape {ok, code} and the same failure
 *  modes. Keeping them in one place avoids drift. */
async function callCleanupRpc(
  rpcName: 'delete_spot_cascade' | 'delete_trail_cascade',
  params: Record<string, string>,
): Promise<ApiResult<void>> {
  try {
    const { data, error } = await db().rpc(rpcName, params);

    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[${rpcName}] raw response:`, { data, error });
    }

    if (error) {
      // PostgREST 42883 = function does not exist (migration 009 missing)
      const isMissing = /function .*does not exist/i.test(error.message ?? '')
        || error.code === '42883';
      const code = isMissing ? 'rpc_missing' : 'rpc_failed';
      return cleanupError(code, {
        pgCode: error.code,
        pgMessage: error.message,
        pgDetails: (error as any).details,
        pgHint: (error as any).hint,
      });
    }

    const res = data as { ok?: boolean; code?: string } | null;
    if (res?.ok === true) return { ok: true, data: undefined };
    return cleanupError(res?.code ?? 'rpc_failed', { rpcResponse: res });
  } catch (e: any) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[${rpcName}] threw:`, e);
    }
    return cleanupError('rpc_exception', { threw: e?.message ?? String(e) });
  }
}

export async function deleteSpot(spotId: string): Promise<ApiResult<void>> {
  return callCleanupRpc('delete_spot_cascade', { p_spot_id: spotId });
}

export async function deleteTrail(trailId: string): Promise<ApiResult<void>> {
  return callCleanupRpc('delete_trail_cascade', { p_trail_id: trailId });
}

// ═══════════════════════════════════════════════════════════
// SPRINT 4 — Trust + Versioning + Pioneer Foundation (ADR-012)
// ═══════════════════════════════════════════════════════════

export type SeedSource = 'curator' | 'rider';
export type TrustTier  = 'provisional' | 'verified' | 'disputed';

// ── finalize_seed_run (mig 012) ──
//
// Flat-params variant of the old finalize_pioneer_run. Server stamps
// seed_source from caller's role, sets trust_tier='provisional',
// creates trail_versions row (version=1, is_current=true), attaches
// run + leaderboard entry to that version. Pioneer assignment flows
// through the mig 011 immutability trigger.

export interface SeedRunParams {
  trailId: string;
  geometry: PioneerGeometry;
  durationMs: number;
  gpsTrace?: unknown;
  medianAccuracyM: number;
  qualityTier: 'perfect' | 'valid' | 'rough';
  verificationStatus: 'verified' | 'weak_signal';
  startedAt: Date;
  finishedAt: Date;
}

export interface SeedRunResult {
  runId: string;
  seedSource: SeedSource;
  trustTier: TrustTier;
  versionId: string;
  isPioneer: true;
  leaderboardPosition: number;
}

/** Polish copy for every error code emitted by the Sprint-4 RPCs.
 *  Single source of truth so UI alerts stay consistent. */
const SEED_RUN_ERRORS: Record<string, string> = {
  unauthenticated:      'Zaloguj się ponownie',
  trail_not_found:      'Trasa nie istnieje',
  already_pioneered:    'Ktoś Cię wyprzedził — trasa ma już Pioneera',
  invalid_state:        'Trasa nie jest w stanie draft',
  weak_signal_pioneer:  'Słaby sygnał GPS — kalibracja odrzucona',
  invalid_geometry:     'Za mało punktów GPS (min 30)',
  not_authorized:       'Brak uprawnień do tej operacji',
  no_current_version:   'Trasa nie ma aktywnej wersji',
  rpc_failed:           'Nie udało się zapisać zjazdu. Spróbuj ponownie.',
};

export async function finalizeSeedRun(
  params: SeedRunParams,
): Promise<ApiResult<SeedRunResult>> {
  const { data, error } = await db().rpc('finalize_seed_run', {
    p_trail_id:            params.trailId,
    p_geometry:            params.geometry as any,
    p_duration_ms:         params.durationMs,
    p_gps_trace:           (params.gpsTrace ?? null) as any,
    p_median_accuracy_m:   params.medianAccuracyM,
    p_quality_tier:        params.qualityTier,
    p_verification_status: params.verificationStatus,
    p_started_at:          params.startedAt.toISOString(),
    p_finished_at:         params.finishedAt.toISOString(),
  });

  if (error) return polishError('rpc_failed', SEED_RUN_ERRORS);
  const res = data as any;
  if (res?.ok === true) {
    return {
      ok: true,
      data: {
        runId:               res.run_id as string,
        seedSource:          res.seed_source as SeedSource,
        trustTier:           res.trust_tier as TrustTier,
        versionId:           res.version_id as string,
        isPioneer:           true,
        leaderboardPosition: res.leaderboard_position as number,
      },
    };
  }
  return polishError(res?.code ?? 'rpc_failed', SEED_RUN_ERRORS);
}

// ── finalizePioneerRun (Sprint 3 signature, routed through mig 012) ──
//
// Kept as a thin shim so existing call sites (app/run/review.tsx) don't
// need to change. Internally flattens the old PioneerRunPayload bundle
// onto finalize_seed_run's flat-params shape. The legacy mig-008
// finalize_pioneer_run RPC stays in the DB untouched (no longer called
// from client) and can be dropped in a Sprint 5 cleanup migration.

export async function finalizePioneerRun(
  params: FinalizePioneerRunParams,
): Promise<ApiResult<PioneerRunResult>> {
  const result = await finalizeSeedRun({
    trailId:            params.trailId,
    geometry:           params.geometry,
    durationMs:         params.runPayload.duration_ms,
    gpsTrace:           params.runPayload.gps_trace,
    medianAccuracyM:    params.runPayload.median_accuracy_m,
    qualityTier:        params.runPayload.quality_tier ?? 'valid',
    verificationStatus: params.runPayload.verification_status,
    startedAt:          new Date(params.runPayload.started_at),
    finishedAt:         new Date(params.runPayload.finished_at),
  });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      runId:               result.data.runId,
      isPioneer:           true,
      trailStatus:         'calibrating',
      leaderboardPosition: result.data.leaderboardPosition,
    },
  };
}

// ── recalibrate_trail (curator-only) ──

export interface RecalibrateResult {
  newVersionId: string;
  newVersionNumber: number;
}

export async function recalibrateTrail(
  trailId: string,
  newGeometry: PioneerGeometry,
): Promise<ApiResult<RecalibrateResult>> {
  const { data, error } = await db().rpc('recalibrate_trail', {
    p_trail_id:     trailId,
    p_new_geometry: newGeometry as any,
  });
  if (error) return polishError('rpc_failed', SEED_RUN_ERRORS);
  const res = data as any;
  if (res?.ok === true) {
    return {
      ok: true,
      data: {
        newVersionId:     res.new_version_id as string,
        newVersionNumber: res.new_version_number as number,
      },
    };
  }
  return polishError(res?.code ?? 'rpc_failed', SEED_RUN_ERRORS);
}

// ── admin_resolve_pioneer (moderator-only escape hatch) ──

export async function adminResolvePioneer(
  trailId: string,
  newPioneerUserId: string,
  reason: string,
): Promise<ApiResult<void>> {
  const { data, error } = await db().rpc('admin_resolve_pioneer', {
    p_trail_id:            trailId,
    p_new_pioneer_user_id: newPioneerUserId,
    p_reason:              reason,
  });
  if (error) return polishError('rpc_failed', SEED_RUN_ERRORS);
  const res = data as any;
  if (res?.ok === true) return { ok: true, data: undefined };
  return polishError(res?.code ?? 'rpc_failed', SEED_RUN_ERRORS);
}
