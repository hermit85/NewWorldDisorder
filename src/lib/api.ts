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
  const { data } = await db()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
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
}

export async function submitRun(params: SubmitRunParams): Promise<SubmitRunResult | null> {
  const {
    userId, spotId, trailId, mode, startedAt, finishedAt,
    durationMs, verification, trace, xpAwarded,
  } = params;

  const isLeaderboardEligible = verification.isLeaderboardEligible;

  // Check if this is a PB
  let isPb = false;
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
      verification_summary: verification as any,
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

  return { run, leaderboardResult, isPb };
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
  const { data: entries } = await db()
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
// RUNS HISTORY
// ═══════════════════════════════════════════════════════════

export async function fetchUserRuns(userId: string, limit: number = 20): Promise<DbRun[]> {
  const { data } = await db()
    .from('runs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

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
  const { data: entries } = await db()
    .from('leaderboard_entries')
    .select('trail_id, best_duration_ms, rank_position')
    .eq('user_id', userId)
    .eq('period_type', 'all_time');

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
  const { data } = await db()
    .from('challenges')
    .select('*')
    .eq('spot_id', spotId)
    .eq('is_active', true)
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

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
  const { data } = await db()
    .from('user_achievements')
    .select(`
      *,
      achievements!inner (*)
    `)
    .eq('user_id', userId);

  return data ?? [];
}

export async function unlockAchievement(userId: string, achievementId: string): Promise<boolean> {
  const { error } = await db()
    .from('user_achievements')
    .insert({
      user_id: userId,
      achievement_id: achievementId,
    });

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
