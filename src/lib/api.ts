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

export async function updateProfileXp(userId: string, xpToAdd: number): Promise<Profile | null> {
  // Get current profile
  const { data: current } = await db()
    .from('profiles')
    .select('xp')
    .eq('id', userId)
    .single();

  if (!current) return null;

  const newXp = current.xp + xpToAdd;
  const newRank = getRankForXp(newXp);

  const { data } = await db()
    .from('profiles')
    .update({
      xp: newXp,
      rank_id: newRank.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select()
    .single();

  return data;
}

export async function incrementProfileRuns(userId: string, isPb: boolean): Promise<void> {
  const { data: current } = await db()
    .from('profiles')
    .select('total_runs, total_pbs')
    .eq('id', userId)
    .single();

  if (!current) return;

  const updates: Record<string, any> = {
    total_runs: current.total_runs + 1,
    updated_at: new Date().toISOString(),
  };

  if (isPb) {
    updates.total_pbs = current.total_pbs + 1;
  }

  await db().from('profiles').update(updates).eq('id', userId);
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

  // Update profile stats
  await incrementProfileRuns(userId, isPb);
  if (xpAwarded > 0) {
    await updateProfileXp(userId, xpAwarded);
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
        rank_id
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
        rank_id
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

export async function incrementChallengeProgress(
  userId: string,
  challengeId: string,
  increment: number = 1,
): Promise<void> {
  // Upsert challenge progress
  const { data: existing } = await db()
    .from('challenge_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('challenge_id', challengeId)
    .single();

  if (existing) {
    const newValue = existing.current_value + increment;
    // Check challenge target (we'd need to look it up)
    await db()
      .from('challenge_progress')
      .update({
        current_value: newValue,
      })
      .eq('id', existing.id);
  } else {
    await db().from('challenge_progress').insert({
      user_id: userId,
      challenge_id: challengeId,
      current_value: increment,
    });
  }
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

export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  // Upsert: safe to call on every run — won't duplicate, won't fail on re-unlock
  const { error } = await db()
    .from('user_achievements')
    .upsert(
      { user_id: userId, achievement_id: achievementId },
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
    );

  if (error && __DEV__) {
    console.warn('[NWD] Achievement unlock failed:', achievementId, error.message);
  }
  return !error;
}

// ═══════════════════════════════════════════════════════════
// SPOTS & TRAILS (read-only, from seed data)
// ═══════════════════════════════════════════════════════════

export async function fetchSpots() {
  const { data } = await db()
    .from('spots')
    .select('*')
    .eq('is_active', true)
    .order('name');

  return data ?? [];
}

export async function fetchTrails(spotId: string) {
  const { data } = await db()
    .from('trails')
    .select('*')
    .eq('spot_id', spotId)
    .eq('is_active', true)
    .eq('is_race_trail', true)
    .order('sort_order');

  return data ?? [];
}
