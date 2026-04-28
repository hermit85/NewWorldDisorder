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

export interface HeroBeat {
  trailId: string;
  trailName: string;
  beaterName: string;
  happenedAt: string;
  beaterTimeMs: number;
  userTimeMs: number;
  deltaMs: number;
  previousPosition: number;
  currentPosition: number;
}

export interface DailyChallengeProgress {
  id: 'ride_today' | 'beat_pb' | 'complete_three';
  title: string;
  rewardXp: number;
  current: number;
  target: number;
  completed: boolean;
}

export interface StreakState {
  days: number;
  currentDayComplete: boolean;
  mode: 'safe' | 'warn';
  graceExpiresAt: string | null;
  lastRideAt: string | null;
  remainingHours: number;
  remainingMinutes: number;
}

export interface FeedEvent {
  id: string;
  type: 'beat' | 'rider' | 'trail';
  name: string;
  text: string;
  timestamp: string;
  trailId?: string | null;
}

export interface BikeParkTrailCardData {
  trail: {
    id: string;
    name: string;
    difficulty: string;
    type: string;
    distanceM: number;
    activeRidersCount: number;
  };
  state: 'default' | 'beaten' | 'virgin' | 'pioneer';
  userData: {
    pbMs?: number;
    position?: number;
    totalRanked?: number;
    lastRanAt?: string;
    beatenBy?: { name: string; deltaMs: number; happenedAt: string };
  };
  calibrationStatus: string;
  pioneerStatusLabel?: 'PIONIER' | 'W WALIDACJI' | 'DRUGI ZJAZD';
  pioneerSubtitle?: string | null;
}

const CHUNK9_STREAK_WARN_WINDOW_MS = 6 * 60 * 60 * 1000;
const CHUNK9_STREAK_MIN_DURATION_MS = 60_000;
const CHUNK9_ACTIVE_RIDERS_WINDOW_DAYS = 30;
const CHUNK9_BEAT_WINDOW_DAYS = 7;

function startOfLocalDay(date: Date): Date {
  const local = new Date(date);
  local.setHours(0, 0, 0, 0);
  return local;
}

function endOfLocalDay(date: Date): Date {
  const local = new Date(date);
  local.setHours(23, 59, 59, 999);
  return local;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampPositiveFloor(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

export function formatRelativeTimestamp(timestamp: string, now: Date = new Date()): string {
  const eventTime = new Date(timestamp);
  const diffMs = Math.max(0, now.getTime() - eventTime.getTime());
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays >= 1) return `${diffDays}d`;
  if (diffHours >= 1) return `${diffHours}h`;
  if (diffMinutes >= 1) return `${diffMinutes}m`;
  return 'teraz';
}

function isChallengeRideToday(run: Pick<DbRun, 'verification_status'>): boolean {
  return run.verification_status === 'verified' || run.verification_status === 'practice_only';
}

function isStreakEligibleRun(run: Pick<DbRun, 'verification_status' | 'duration_ms'>): boolean {
  const eligibleStatus =
    run.verification_status === 'verified' || run.verification_status === 'practice_only';
  return eligibleStatus && run.duration_ms >= CHUNK9_STREAK_MIN_DURATION_MS;
}

export function deriveDailyChallengesFromRuns(
  runs: Array<Pick<DbRun, 'verification_status' | 'is_pb'>>,
): DailyChallengeProgress[] {
  const rideTodayCount = runs.filter(isChallengeRideToday).length;
  const pbTodayCount = runs.filter((run) => run.is_pb).length;
  const verifiedTodayCount = runs.filter((run) => run.verification_status === 'verified').length;

  return [
    {
      id: 'ride_today',
      title: 'Zjedź dziś',
      rewardXp: 50,
      current: Math.min(rideTodayCount, 1),
      target: 1,
      completed: rideTodayCount >= 1,
    },
    {
      id: 'beat_pb',
      title: 'Pobij swój PB',
      rewardXp: 100,
      current: Math.min(pbTodayCount, 1),
      target: 1,
      completed: pbTodayCount >= 1,
    },
    {
      id: 'complete_three',
      title: 'Ukończ 3 zjazdy',
      rewardXp: 150,
      current: Math.min(verifiedTodayCount, 3),
      target: 3,
      completed: verifiedTodayCount >= 3,
    },
  ];
}

function buildStreakState(params: {
  days: number;
  currentDayComplete: boolean;
  lastRideAt: string | null;
  graceExpiresAt: string | null;
  now?: Date;
}): StreakState {
  const now = params.now ?? new Date();
  if (params.days <= 0 || !params.lastRideAt || !params.graceExpiresAt) {
    return {
      days: 0,
      currentDayComplete: false,
      mode: 'safe',
      lastRideAt: params.lastRideAt,
      graceExpiresAt: params.graceExpiresAt,
      remainingHours: 0,
      remainingMinutes: 0,
    };
  }

  const graceExpires = new Date(params.graceExpiresAt);
  const remainingMs = Math.max(0, graceExpires.getTime() - now.getTime());
  const remainingHours = clampPositiveFloor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = clampPositiveFloor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return {
    days: params.days,
    currentDayComplete: params.currentDayComplete,
    mode:
      !params.currentDayComplete &&
      remainingMs > 0 &&
      remainingMs <= CHUNK9_STREAK_WARN_WINDOW_MS
        ? 'warn'
        : 'safe',
    lastRideAt: params.lastRideAt,
    graceExpiresAt: params.graceExpiresAt,
    remainingHours,
    remainingMinutes,
  };
}

export function deriveStreakFromRuns(
  runs: Array<Pick<DbRun, 'started_at' | 'verification_status' | 'duration_ms'>>,
  now: Date = new Date(),
): StreakState {
  const eligibleRuns = runs
    .filter(isStreakEligibleRun)
    .slice()
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());

  if (eligibleRuns.length === 0) {
    return buildStreakState({
      days: 0,
      currentDayComplete: false,
      lastRideAt: null,
      graceExpiresAt: null,
      now,
    });
  }

  const uniqueDays: string[] = [];
  const uniqueDaySet = new Set<string>();
  for (const run of eligibleRuns) {
    const key = localDayKey(new Date(run.started_at));
    if (!uniqueDaySet.has(key)) {
      uniqueDays.push(key);
      uniqueDaySet.add(key);
    }
  }

  const latestRideAt = eligibleRuns[0].started_at;
  const latestRideDate = new Date(latestRideAt);
  const graceExpiresAt = endOfLocalDay(addDays(startOfLocalDay(latestRideDate), 1));

  if (now.getTime() > graceExpiresAt.getTime()) {
    return buildStreakState({
      days: 0,
      currentDayComplete: false,
      lastRideAt: latestRideAt,
      graceExpiresAt: graceExpiresAt.toISOString(),
      now,
    });
  }

  let streakDays = 1;
  let expected = startOfLocalDay(latestRideDate);
  for (let index = 1; index < uniqueDays.length; index += 1) {
    expected = addDays(expected, -1);
    if (uniqueDays[index] !== localDayKey(expected)) break;
    streakDays += 1;
  }

  return buildStreakState({
    days: streakDays,
    currentDayComplete: localDayKey(latestRideDate) === localDayKey(now),
    lastRideAt: latestRideAt,
    graceExpiresAt: graceExpiresAt.toISOString(),
    now,
  });
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
  /** True when the Pioneer second run opened the current trail version. */
  trailOpened: boolean;
  trailOpenFailed: boolean;
  canPromoteBaseline: boolean;
  consistencyReason: string | null;
  invalidationReasons: string[];
  openBonusXp: number;
  trailStatus: string | null;
  confidenceLabel: string | null;
}

export function normalizeVerificationSummary(
  summary: unknown,
  verificationStatus: string,
): unknown {
  if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
    return summary;
  }

  const record = summary as Record<string, unknown>;
  if (record.acceptedVia !== undefined) {
    return summary;
  }

  if (verificationStatus === 'verified') {
    return { ...record, acceptedVia: 'gate_cross' };
  }

  if (verificationStatus === 'practice_only') {
    return { ...record, acceptedVia: 'manual' };
  }

  return summary;
}

export function normalizeRunRow(run: DbRun): DbRun {
  return {
    ...run,
    verification_summary: normalizeVerificationSummary(
      run.verification_summary,
      run.verification_status,
    ) as DbRun['verification_summary'],
  };
}

// B23.1: when submit_run returns null, callers (result.tsx's WYŚLIJ TERAZ,
// useRealRun's initial save) previously had no way to know *why* it was
// rejected — only `console.warn` which is invisible on TestFlight. This
// module-level cache lets the retry path surface the actual error code to
// the rider ("Serwer: corridor_coverage_low" instead of dead silence).
// Cleared at the start of every submit; callers should pull immediately
// after an await'd null return, before any other submit can race in.
let _lastSubmitRunError: { code: string; detail: string } | null = null;
export function getLastSubmitRunError(): { code: string; detail: string } | null {
  return _lastSubmitRunError;
}

export async function submitRun(params: SubmitRunParams): Promise<SubmitRunResult | null> {
  const {
    userId, spotId, trailId, mode, startedAt, finishedAt,
    durationMs, verification, trace, xpAwarded, qualityTier,
  } = params;
  _lastSubmitRunError = null;

  // Slim down GPS trace for storage (remove raw points array, keep summary)
  const traceForStorage = {
    pointCount: trace.points.length,
    startedAt: trace.startedAt,
    finishedAt: trace.finishedAt,
    durationMs: trace.durationMs,
    mode: trace.mode,
    sampledPoints: trace.points.filter((_, i) => i % 3 === 0).map(p => ({
      lat: Math.round(p.latitude * 1e6) / 1e6,
      lng: Math.round(p.longitude * 1e6) / 1e6,
      t: p.timestamp,
    })),
  };

  // F1#9: server-side eligibility validation. The RPC re-validates the
  // verification summary against the same thresholds the client uses
  // and owns the decision on counted_in_leaderboard / is_pb. Any
  // tampered payload still lands as a history row (mode=practice path)
  // but cannot land on the leaderboard.
  const verificationPayload = { ...verification, qualityTier: qualityTier ?? null };
  // B28 — Walk-test B27 surfaced `invalid input syntax for type integer:
  // "131996.16381835938"` on submit_run. The `p_duration_ms` Supabase
  // column is BIGINT; our upstream pipeline can leak a float here because
  // iOS GPS timestamps (used for `crossing.crossingTimestamp` → trace
  // `startedAt` / `finishedAt`) carry sub-millisecond fractions, and
  // `finishedAt - startedAt` preserves them. Integer-typed PG columns
  // reject floats outright — even though the magnitude is fine. Round at
  // the RPC boundary so no upstream code path can leak a non-integer,
  // regardless of how durationMs was computed. Same belt-and-suspenders
  // on `p_xp_awarded`; always an integer today but defensive is cheap.
  const { data, error } = await db().rpc('submit_run', {
    p_spot_id: spotId,
    p_trail_id: trailId,
    p_mode: mode,
    p_started_at: new Date(startedAt).toISOString(),
    p_finished_at: new Date(finishedAt).toISOString(),
    p_duration_ms: Math.round(durationMs),
    p_verification_status: verification.status,
    p_verification_summary: verificationPayload as any,
    p_gps_trace: traceForStorage as any,
    p_xp_awarded: Math.round(xpAwarded),
  });

  if (error || !data) {
    _lastSubmitRunError = {
      code: 'rpc_transport',
      detail: error?.message ?? 'RPC returned no data',
    };
    console.error('[NWD] submit_run RPC failed:', error);
    return null;
  }

  const result = data as any;
  if (!result.ok) {
    _lastSubmitRunError = {
      code: result.code ?? 'unknown',
      detail: Array.isArray(result.invalidation_reasons)
        ? result.invalidation_reasons.join(', ')
        : (result.message ?? JSON.stringify(result)),
    };
    console.warn('[NWD] submit_run rejected:', result.code);
    return null;
  }

  const run = result.run as DbRun;
  const isPb = !!result.is_pb;
  const previousBestMs = (result.previous_best_ms as number | null) ?? null;

  const leaderboardResult = result.leaderboard
    ? {
        position: result.leaderboard.position,
        previousPosition: result.leaderboard.previous_position,
        delta: result.leaderboard.delta,
        isNewBest: result.leaderboard.is_new_best,
      }
    : null;

  // Profile stats + favorite trail stay client-driven for now — these
  // are derived aggregates, not trust-critical. Leaderboard integrity
  // (the only thing a cheater would target) now lives server-side.
  //
  // Codex pass 5 silent-corruption: pre-build-49 the client awarded
  // XP on every `result.ok === true` regardless of whether the run
  // was eligible (i.e. counted_in_leaderboard). A rejected ranked
  // run with invalidation reasons would still bump profile.xp by
  // the client-decided xpAwarded, so a rider who couldn't actually
  // place on the leaderboard still saw their XP go up. Gate XP
  // updates on `result.eligible === true`. Run-count + favorite
  // trail update stay unconditional — those are tallies of "the
  // rider rode something", not rewards for legitimacy.
  const isServerEligible = result.eligible === true;
  const runCounts = await incrementProfileRuns(userId, isPb);
  if (xpAwarded > 0 && isServerEligible) {
    await updateProfileXp(userId, xpAwarded);
  }
  if (leaderboardResult && leaderboardResult.position > 0) {
    await updateBestPosition(userId, leaderboardResult.position);
  }
  if (runCounts) {
    await updateFavoriteTrail(userId, trailId);
  }

  return {
    run: normalizeRunRow(run),
    leaderboardResult,
    isPb,
    previousBestMs,
    trailOpened: result.trail_opened === true,
    trailOpenFailed: result.trail_open_failed === true,
    canPromoteBaseline: result.can_promote_baseline === true,
    consistencyReason: (result.consistency_reason as string | null) ?? null,
    invalidationReasons: Array.isArray(result.invalidation_reasons)
      ? result.invalidation_reasons.map(String)
      : [],
    openBonusXp: typeof result.open_bonus_xp === 'number' ? result.open_bonus_xp : 0,
    trailStatus: (result.trail_status as string | null) ?? null,
    confidenceLabel: (result.confidence_label as string | null) ?? null,
  };
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
  const currentVersionId = await fetchCurrentTrailVersionId(trailId);
  if (!currentVersionId) return [];

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
    .eq('trail_version_id', currentVersionId)
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

async function fetchCurrentTrailVersionId(trailId: string): Promise<string | null> {
  const { data, error } = await db()
    .from('trails')
    .select('current_version_id')
    .eq('id', trailId)
    .single();

  if (error || !data) return null;
  return (data as { current_version_id: string | null }).current_version_id;
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

/** Top-N cap for scoped leaderboard rows returned to the UI. Matches
 *  fetchLeaderboard(all_time)'s 50-row budget so lists render uniformly.
 *  FAZA 2 #2 — enforced server-side by fetch_scoped_leaderboard RPC. */
const SCOPED_LEADERBOARD_TOP_N = 50;

/** Row shape returned by the fetch_scoped_leaderboard RPC. Keep in sync
 *  with the RETURNS TABLE declaration in the matching migration. */
interface ScopedLeaderboardRpcRow {
  user_id: string;
  trail_id: string;
  best_duration_ms: number;
  rank_position: number;
  username: string;
  display_name: string;
  rank_id: string;
  avatar_url: string | null;
}

export async function fetchScopedLeaderboard(
  trailId: string,
  scope: 'today' | 'weekend',
  currentUserId?: string,
): Promise<LeaderboardRow[]> {
  const since = scope === 'today' ? todayStart() : weekendStart();

  // Codex FAZA2-R2 P1: the previous implementation pulled up to 500 raw
  // run rows and deduped in JS. A handful of heavy repeat attempters
  // could crowd the window and starve legitimate top-50 riders. The
  // RPC does DISTINCT ON (user_id) server-side, so the window we see
  // is already one-row-per-rider and LIMIT p_limit is correctness-safe.
  const { data, error } = await db().rpc('fetch_scoped_leaderboard', {
    p_trail_id: trailId,
    p_since: since,
    p_limit: SCOPED_LEADERBOARD_TOP_N,
  });

  if (error) throw new Error(`fetchScopedLeaderboard failed: ${error.message}`);
  const rows = (data ?? []) as ScopedLeaderboardRpcRow[];
  if (rows.length === 0) return [];

  // RPC already returns rows sorted by best_duration_ms asc with
  // rank_position filled in via row_number(). We only need to flag
  // the current user and compute gap-to-leader.
  const leaderTime = rows[0]?.best_duration_ms ?? 0;

  return rows.map((e) => ({
    userId: e.user_id,
    username: e.username,
    displayName: e.display_name,
    rankId: e.rank_id,
    trailId: e.trail_id,
    periodType: scope,
    bestDurationMs: e.best_duration_ms,
    rankPosition: e.rank_position,
    previousPosition: null,
    delta: 0,
    gapToLeader: e.best_duration_ms - leaderTime,
    isCurrentUser: e.user_id === currentUserId,
    avatarUrl: e.avatar_url ?? null,
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
  return (data ?? []).map((run) => normalizeRunRow(run as DbRun));
}

export async function fetchUserPb(userId: string, trailId: string): Promise<number | null> {
  const currentVersionId = await fetchCurrentTrailVersionId(trailId);
  if (!currentVersionId) return null;

  const { data } = await db()
    .from('runs')
    .select('duration_ms')
    .eq('user_id', userId)
    .eq('trail_id', trailId)
    .eq('trail_version_id', currentVersionId)
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
    .select('trail_id, trail_version_id, best_duration_ms, rank_position')
    .eq('user_id', userId)
    .eq('period_type', 'all_time');

  if (error) throw new Error(`fetchUserTrailStats failed: ${error.message}`);
  if (entries && entries.length > 0) {
    const trailIds = [...new Set(entries.map((e: any) => e.trail_id))];
    const { data: trails } = await db()
      .from('trails')
      .select('id, current_version_id')
      .in('id', trailIds);
    const currentByTrail = new Map(
      (trails ?? []).map((t: any) => [t.id, t.current_version_id]),
    );

    for (const e of entries) {
      if (e.trail_version_id !== currentByTrail.get(e.trail_id)) continue;
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
// CHUNK 9 — Home + Bike Park data queries
// ═══════════════════════════════════════════════════════════

type LeaderboardBeatRow = {
  trail_id: string;
  trail_version_id: string | null;
  best_duration_ms: number;
  rank_position: number;
  previous_position: number | null;
  updated_at: string;
  trails?: {
    official_name?: string | null;
    current_version_id?: string | null;
  } | null;
};

async function fetchRecentBeatEntries(userId: string, trailIds?: string[]): Promise<LeaderboardBeatRow[]> {
  // We pull a wider window (100 rather than 25) because the
  // current-version filter happens in JS — after enough baseline
  // promotes a single stale version could fill the top of a
  // narrow window and starve out a real current-version beat.
  // 100 still hits the (user_id, updated_at desc) index cheaply.
  let query = db()
    .from('leaderboard_entries')
    .select(`
      trail_id,
      trail_version_id,
      best_duration_ms,
      rank_position,
      previous_position,
      updated_at,
      trails!inner(official_name, current_version_id)
    `)
    .eq('user_id', userId)
    .eq('period_type', 'all_time')
    .order('updated_at', { ascending: false })
    .limit(100);

  if (trailIds && trailIds.length > 0) {
    query = query.in('trail_id', trailIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`fetchRecentBeatEntries failed: ${error.message}`);

  // AUDIT R2 #5+#6: pull `current_version_id` via the same `trails!inner`
  // FK join we already need for `official_name`, so version filtering
  // is single-roundtrip and inherits the leaderboard query's failure
  // mode. Hide ghosts from superseded versions — after a Pioneer
  // promotes a new baseline (`promote_run_as_baseline`), entries
  // pinned to the prior version are no longer comparable.
  return (data ?? []).filter((entry: any) => {
    const previous = entry.previous_position;
    if (typeof previous !== 'number') return false;
    if (entry.rank_position <= previous) return false;
    const currentVersion = entry.trails?.current_version_id ?? null;
    return entry.trail_version_id === currentVersion;
  }) as LeaderboardBeatRow[];
}

export async function fetchHeroBeat(userId: string): Promise<HeroBeat | null> {
  const beatEntries = await fetchRecentBeatEntries(userId);
  const latest = beatEntries[0];
  if (!latest) return null;

  const board = await fetchLeaderboard(latest.trail_id, 'all_time', userId);
  const beater =
    board.find((entry) => entry.rankPosition === latest.rank_position - 1) ??
    board.find((entry) => entry.rankPosition === 1 && entry.userId !== userId);

  if (!beater || beater.userId === userId) {
    return null;
  }

  return {
    trailId: latest.trail_id,
    trailName: latest.trails?.official_name ?? latest.trail_id,
    beaterName: beater.displayName || beater.username,
    happenedAt: latest.updated_at,
    beaterTimeMs: beater.bestDurationMs,
    userTimeMs: latest.best_duration_ms,
    deltaMs: Math.max(0, latest.best_duration_ms - beater.bestDurationMs),
    previousPosition: latest.previous_position ?? latest.rank_position,
    currentPosition: latest.rank_position,
  };
}

export async function fetchDailyChallenges(userId: string): Promise<DailyChallengeProgress[]> {
  const { data, error } = await db()
    .from('runs')
    .select('verification_status, is_pb, started_at')
    .eq('user_id', userId)
    .gte('started_at', startOfLocalDay(new Date()).toISOString())
    .order('started_at', { ascending: false });

  if (error) throw new Error(`fetchDailyChallenges failed: ${error.message}`);
  return deriveDailyChallengesFromRuns((data ?? []) as Array<Pick<DbRun, 'verification_status' | 'is_pb'>>);
}

export async function fetchStreakState(userId: string): Promise<StreakState> {
  const now = new Date();

  try {
    const { data, error } = await db()
      .from('profiles')
      .select('streak_days, streak_last_ride_at, streak_grace_expires_at')
      .eq('id', userId)
      .single();

    if (!error && data) {
      const currentDayComplete =
        !!data.streak_last_ride_at &&
        localDayKey(new Date(data.streak_last_ride_at)) === localDayKey(now);
      return buildStreakState({
        days: data.streak_days ?? 0,
        currentDayComplete,
        lastRideAt: data.streak_last_ride_at ?? null,
        graceExpiresAt: data.streak_grace_expires_at ?? null,
        now,
      });
    }
  } catch {}

  const { data, error } = await db()
    .from('runs')
    .select('started_at, verification_status, duration_ms')
    .eq('user_id', userId)
    .in('verification_status', ['verified', 'practice_only'])
    .gte('duration_ms', CHUNK9_STREAK_MIN_DURATION_MS)
    .order('started_at', { ascending: false })
    .limit(120);

  if (error) throw new Error(`fetchStreakState failed: ${error.message}`);
  return deriveStreakFromRuns(
    (data ?? []) as Array<Pick<DbRun, 'started_at' | 'verification_status' | 'duration_ms'>>,
    now,
  );
}

export async function fetchLeagueFeed(userId: string, limit: number = 5): Promise<FeedEvent[]> {
  const events: FeedEvent[] = [];

  const heroBeat = await fetchHeroBeat(userId);
  if (heroBeat) {
    events.push({
      id: `beat-${heroBeat.trailId}-${heroBeat.happenedAt}`,
      type: 'beat',
      name: heroBeat.beaterName,
      text: `wyprzedził cię na ${heroBeat.trailName}`,
      timestamp: heroBeat.happenedAt,
      trailId: heroBeat.trailId,
    });
  }

  const userTrails = await fetchUserTrailStats(userId);
  const trailIds = Array.from(userTrails.keys());
  if (trailIds.length > 0) {
    const { data: riderRuns, error: riderRunsError } = await db()
      .from('runs')
      .select(`
        user_id,
        trail_id,
        started_at,
        profiles!inner(username, display_name),
        trails!inner(official_name)
      `)
      .in('trail_id', trailIds)
      .neq('user_id', userId)
      .eq('verification_status', 'verified')
      .order('started_at', { ascending: false })
      .limit(12);

    if (riderRunsError) {
      throw new Error(`fetchLeagueFeed rider runs failed: ${riderRunsError.message}`);
    }

    const seenRiderTrail = new Set<string>();
    for (const run of riderRuns ?? []) {
      const key = `${run.user_id}:${run.trail_id}`;
      if (seenRiderTrail.has(key)) continue;
      seenRiderTrail.add(key);
      events.push({
        id: `rider-${key}-${run.started_at}`,
        type: 'rider',
        name: (run as any).profiles?.display_name || (run as any).profiles?.username || 'Rider',
        text: `jechał na ${(run as any).trails?.official_name ?? run.trail_id}`,
        timestamp: run.started_at,
        trailId: run.trail_id,
      });
      if (events.length >= limit * 2) break;
    }

    const { data: myRuns, error: myRunsError } = await db()
      .from('runs')
      .select('spot_id')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(20);

    if (myRunsError) {
      throw new Error(`fetchLeagueFeed spots failed: ${myRunsError.message}`);
    }

    const spotIds = Array.from(new Set((myRuns ?? []).map((run) => run.spot_id)));
    if (spotIds.length > 0) {
      const { data: freshTrails, error: freshTrailsError } = await db()
        .from('trails')
        .select('id, official_name, created_at')
        .in('spot_id', spotIds)
        .neq('pioneer_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(8);

      if (freshTrailsError) {
        throw new Error(`fetchLeagueFeed trails failed: ${freshTrailsError.message}`);
      }

      for (const trail of freshTrails ?? []) {
        events.push({
          id: `trail-${trail.id}-${trail.created_at}`,
          type: 'trail',
          name: trail.official_name,
          text: 'pojawiła się w twojej okolicy',
          timestamp: trail.created_at,
          trailId: trail.id,
        });
      }
    }
  }

  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

export async function fetchBikeParkTrails(
  userId: string | undefined,
  spotId: string,
): Promise<BikeParkTrailCardData[]> {
  const trailsResult = await fetchTrails(spotId);
  if (!trailsResult.ok) {
    throw new Error(trailsResult.message ?? 'fetchBikeParkTrails failed');
  }

  const trails = trailsResult.data;
  if (trails.length === 0) return [];

  const trailIds = trails.map((trail) => trail.id);
  const currentVersionByTrail = new Map(
    trails.map((trail) => [trail.id, trail.currentVersionId]),
  );
  const activeRidersSince = addDays(new Date(), -CHUNK9_ACTIVE_RIDERS_WINDOW_DAYS).toISOString();
  const recentBeatSince = addDays(new Date(), -CHUNK9_BEAT_WINDOW_DAYS).toISOString();

  const [
    activeRunsRes,
    rankedEntriesRes,
    userRunsRes,
    beatEntries,
    userTrailStats,
  ] = await Promise.all([
    db()
      .from('runs')
      .select('trail_id, user_id')
      .eq('spot_id', spotId)
      .eq('verification_status', 'verified')
      .gte('started_at', activeRidersSince),
    db()
      .from('leaderboard_entries')
      .select('trail_id, trail_version_id')
      .eq('period_type', 'all_time')
      .in('trail_id', trailIds),
    userId
      ? db()
          .from('runs')
          .select('trail_id, started_at')
          .eq('user_id', userId)
          .in('trail_id', trailIds)
          .order('started_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    userId
      ? db()
          .from('leaderboard_entries')
          .select(`
            trail_id,
            trail_version_id,
            best_duration_ms,
            rank_position,
            previous_position,
            updated_at,
            trails!inner(official_name)
          `)
          .eq('user_id', userId)
          .eq('period_type', 'all_time')
          .in('trail_id', trailIds)
          .gte('updated_at', recentBeatSince)
          .order('updated_at', { ascending: false })
      : Promise.resolve({ data: [], error: null } as any),
    userId ? fetchUserTrailStats(userId) : Promise.resolve(new Map<string, { pbMs: number | null; position: number | null }>()),
  ]);

  if (activeRunsRes.error) throw new Error(`fetchBikeParkTrails active runs failed: ${activeRunsRes.error.message}`);
  if (rankedEntriesRes.error) throw new Error(`fetchBikeParkTrails leaderboard failed: ${rankedEntriesRes.error.message}`);
  if (userRunsRes.error) throw new Error(`fetchBikeParkTrails user runs failed: ${userRunsRes.error.message}`);
  if (beatEntries.error) throw new Error(`fetchBikeParkTrails beat entries failed: ${beatEntries.error.message}`);

  const activeRiderSets = new Map<string, Set<string>>();
  for (const run of activeRunsRes.data ?? []) {
    const set = activeRiderSets.get(run.trail_id) ?? new Set<string>();
    set.add(run.user_id);
    activeRiderSets.set(run.trail_id, set);
  }

  const rankedCounts = new Map<string, number>();
  for (const entry of (rankedEntriesRes.data ?? []) as Array<{ trail_id: string; trail_version_id: string | null }>) {
    if (entry.trail_version_id !== currentVersionByTrail.get(entry.trail_id)) continue;
    rankedCounts.set(entry.trail_id, (rankedCounts.get(entry.trail_id) ?? 0) + 1);
  }

  const lastRanAt = new Map<string, string>();
  for (const run of userRunsRes.data ?? []) {
    if (!lastRanAt.has(run.trail_id)) {
      lastRanAt.set(run.trail_id, run.started_at);
    }
  }

  const beatenByMap = new Map<string, { name: string; deltaMs: number; happenedAt: string }>();
  for (const beat of (beatEntries.data ?? []) as LeaderboardBeatRow[]) {
    if (beat.trail_version_id !== currentVersionByTrail.get(beat.trail_id)) continue;
    if (beatenByMap.has(beat.trail_id) || !(typeof beat.previous_position === 'number' && beat.rank_position > beat.previous_position)) {
      continue;
    }
    const board = await fetchLeaderboard(beat.trail_id, 'all_time', userId);
    const beater =
      board.find((entry) => entry.rankPosition === beat.rank_position - 1) ??
      board.find((entry) => entry.rankPosition === 1 && entry.userId !== userId);
    if (!beater || beater.userId === userId) continue;
    beatenByMap.set(beat.trail_id, {
      name: beater.displayName || beater.username,
      deltaMs: Math.max(0, beat.best_duration_ms - beater.bestDurationMs),
      happenedAt: beat.updated_at,
    });
  }

  return trails.map((trail) => {
    const stats = userTrailStats.get(trail.id);
    const isPioneer = !!userId && trail.pioneerUserId === userId;
    const beatenBy = beatenByMap.get(trail.id);
    const awaitingValidation =
      trail.calibrationStatus === 'fresh_pending_second_run'
      || trail.calibrationStatus === 'calibrating';

    let state: BikeParkTrailCardData['state'];
    if (isPioneer) state = 'pioneer';
    else if (beatenBy) state = 'beaten';
    else if (!stats?.pbMs) state = 'virgin';
    else state = 'default';

    return {
      trail: {
        id: trail.id,
        name: trail.name,
        difficulty: trail.difficulty,
        type: trail.trailType,
        distanceM: trail.distanceM,
        activeRidersCount: activeRiderSets.get(trail.id)?.size ?? 0,
      },
      state,
      userData: {
        pbMs: stats?.pbMs ?? undefined,
        position: stats?.position ?? undefined,
        totalRanked: rankedCounts.get(trail.id) ?? 0,
        lastRanAt: lastRanAt.get(trail.id),
        beatenBy,
      },
      calibrationStatus: trail.calibrationStatus,
      pioneerStatusLabel: awaitingValidation ? 'DRUGI ZJAZD' : isPioneer ? 'PIONIER' : undefined,
      pioneerSubtitle: awaitingValidation
        ? 'Zjedź jeszcze raz, żeby otworzyć ranking'
        : isPioneer
          ? 'Dodana przez ciebie'
          : null,
    };
  });
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

import { Spot, Trail, Difficulty, TrailType, CalibrationStatus, ConfidenceLabel } from '@/data/types';
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
    // Regenerated types loosen DB enum columns to plain `string`; the
    // app domain still expects the narrow union, so cast at the boundary.
    submissionStatus: row.status as 'active' | 'rejected' | 'pending',
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
    // DB column is plain `string` post-regen; the app domain narrows it
    // to the lifecycle union (calibrating | live_fresh | …) so cast here.
    calibrationStatus: row.calibration_status as CalibrationStatus,
    geometryMissing: row.geometry === null,
    // Sprint 4 (mig 011) — trust + pioneer
    seedSource:       row.seed_source,
    trustTier:        row.trust_tier,
    confidenceLabel:  (row.confidence_label as ConfidenceLabel | null) ?? null,
    consistentPioneerRunsCount: row.consistent_pioneer_runs_count ?? 0,
    uniqueConfirmingRidersCount: row.unique_confirming_riders_count ?? 0,
    currentVersionId: row.current_version_id,
    pioneerUserId:    row.pioneer_user_id,
    pioneerUsername,
    pioneeredAt:      row.pioneered_at,
  };
}

export interface PrimarySpotSummary {
  spot: Spot;
  trailCount: number;
  /** User's best PB across any trail in this spot. Null if no PB yet. */
  bestDurationMs: number | null;
}

// ═══════════════════════════════════════════════════════════
// fetchPrimarySpot — "Twój bike park" for the home shortcut.
//
// Primary = spot of the user's most recent run. Three round-trips
// (runs → trails → leaderboard_entries) instead of one joined query;
// the runs table index on (user_id, started_at) makes the first cheap
// and the rest operate on small id sets. Returns null when the user
// has no runs yet so the home card renders the empty-state CTA.
// ═══════════════════════════════════════════════════════════
export async function fetchPrimarySpot(
  userId: string,
): Promise<ApiResult<PrimarySpotSummary | null>> {
  const { data: runs, error: runsErr } = await db()
    .from('runs')
    .select('trail_id, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(20);
  if (runsErr) return { ok: false, code: 'fetch_failed', message: runsErr.message };
  if (!runs || runs.length === 0) return { ok: true, data: null };

  const trailIds = Array.from(new Set(runs.map((r) => r.trail_id)));
  const { data: trailRows, error: trailsErr } = await db()
    .from('trails')
    .select('id, spot_id')
    .in('id', trailIds);
  if (trailsErr) return { ok: false, code: 'fetch_failed', message: trailsErr.message };

  const trailToSpot = new Map<string, string>();
  for (const row of trailRows ?? []) {
    if (row.spot_id) trailToSpot.set(row.id, row.spot_id);
  }

  // Walk runs newest-first to find first one whose trail still exists
  // and still belongs to a live spot. Covers cascade-deleted trails.
  let primarySpotId: string | null = null;
  for (const run of runs) {
    const spotId = trailToSpot.get(run.trail_id);
    if (spotId) { primarySpotId = spotId; break; }
  }
  if (!primarySpotId) return { ok: true, data: null };

  const spotRes = await fetchSpot(primarySpotId);
  if (!spotRes.ok) {
    if (spotRes.code === 'not_found') return { ok: true, data: null };
    return spotRes;
  }

  const trailsRes = await fetchTrails(primarySpotId);
  const spotTrails = trailsRes.ok ? trailsRes.data : [];
  const trailCount = spotTrails.length;

  let bestDurationMs: number | null = null;
  if (spotTrails.length > 0) {
    const spotTrailIds = spotTrails.map((t) => t.id);
    const currentVersionIds = spotTrails
      .map((t) => t.currentVersionId)
      .filter((id): id is string => !!id);

    let pbQuery = db()
      .from('leaderboard_entries')
      .select('best_duration_ms')
      .eq('user_id', userId)
      .eq('period_type', 'all_time')
      .in('trail_id', spotTrailIds)
      .order('best_duration_ms', { ascending: true })
      .limit(1);

    if (currentVersionIds.length > 0) {
      pbQuery = pbQuery.in('trail_version_id', currentVersionIds);
    }

    const { data: pbRows } = await pbQuery;
    bestDurationMs = pbRows?.[0]?.best_duration_ms ?? null;
  }

  return { ok: true, data: { spot: spotRes.data, trailCount, bestDurationMs } };
}

export async function fetchSpots(): Promise<ApiResult<Spot[]>> {
  // Pioneer self-active flow (migration 20260423180000): the rider
  // who submitted a park sees it in SPOTY while it's still pending
  // so they can open the detail screen and ride the first pioneer
  // run (which flips the park to active). RLS policy on `spots`
  // already restricts pending-row visibility to submitter + curator,
  // so widening the IN list here doesn't leak anyone else's drafts.
  // Rejected rows stay off the list — a future "moje zgłoszenia"
  // surface can expose them with the rejection reason.
  const { data, error } = await db()
    .from('spots')
    .select('*')
    .in('status', ['active', 'pending'])
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

// Batched trails fetch — used by SPOTY to derive arena state for many
// spots in a single query. Returns a map keyed by spotId so the
// caller can look up trails per row without N+1 round-trips.
export async function fetchTrailsForSpotIds(
  spotIds: string[],
): Promise<ApiResult<Map<string, Trail[]>>> {
  const empty = new Map<string, Trail[]>();
  if (spotIds.length === 0) return { ok: true, data: empty };
  const { data, error } = await db()
    .from('trails')
    .select('*')
    .in('spot_id', spotIds)
    .eq('is_active', true)
    .eq('is_race_trail', true)
    .order('sort_order');
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  const out = new Map<string, Trail[]>();
  for (const id of spotIds) out.set(id, []);
  for (const row of data ?? []) {
    const list = out.get(row.spot_id);
    if (list) list.push(mapTrail(row));
  }
  return { ok: true, data: out };
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
  /** Voivodeship slug — see src/data/voivodeships.ts. Optional for
   *  backward-compat with the legacy lat/lng-only screen; the RPC
   *  defaults to '' so omitting it stays valid. */
  region?: string;
  /** Short description (max 280) shown on spot detail. */
  description?: string;
}): Promise<ApiResult<{ spotId: string }>> {
  // submit_spot was extended in migration chunk_10_1_extend_submit_spot_
  // region_description to a 5-arg signature with DEFAULT '' for the
  // two new params; pass empty strings rather than undefined so the
  // Supabase client doesn't serialise them as JSON null.
  const { data, error } = await db().rpc('submit_spot', {
    p_name: params.name,
    p_lat: params.lat,
    p_lng: params.lng,
    p_region: params.region ?? '',
    p_description: params.description ?? '',
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
  /** ADR-012 Phase 1.2: bypass duplicate_base_key soft warn after the
   *  rider confirms in the Smart Suggest dialog that the candidate
   *  really is a different physical line. Hard normalized_name unique
   *  per spot is still enforced. */
  forceCreate?: boolean;
}

export interface CreateTrailSuggestion {
  trailId: string;
  officialName: string;
  difficulty: string;
  trailType: string;
  calibrationStatus?: string;
}

export interface SpotTrailSummary {
  trailId: string;
  officialName: string;
  normalizedName: string;
  duplicateBaseKey: string;
  difficulty: string;
  trailType: string;
  calibrationStatus: string;
  trustTier: 'provisional' | 'verified' | 'disputed' | null;
  isActive: boolean;
  distanceM: number;
  runsContributed: number;
  uniqueConfirmingRidersCount: number;
  currentVersionId: string | null;
  pioneerUserId: string | null;
  pioneerUsername: string | null;
  aliases: string[];
}

// ── ADR-012 Phase 4.4 — review queue admin surface ────────────

export interface RouteReviewQueueEntry {
  id: string;
  trailId: string;
  trailName: string | null;
  spotId: string | null;
  candidateGeometryVersionId: string | null;
  reason:
    | 'overlap_conflict'
    | 'shortcut_detected'
    | 'low_confidence_cluster'
    | 'rider_dispute'
    | 'name_collision'
    | 'merge_proposal';
  severity: 'low' | 'normal' | 'high';
  details: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  createdAt: string;
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

/** Variant: rider IS the pioneer of a brand-new trail. */
export interface PioneerRunResultPioneer {
  kind: 'pioneer';
  runId: string;
  isPioneer: true;
  trailStatus: 'fresh_pending_second_run';
  leaderboardPosition: number | null;
}

/** Variant: rider's draft trail was auto-merged into an existing
 *  trail because geometry overlapped enough. The run counts on the
 *  target trail's leaderboard, not as a new pioneer ride. UI must
 *  navigate to `intoTrailId`, not show a pioneer celebration. */
export interface PioneerRunResultAutoMerged {
  kind: 'auto_merged';
  runId: string;
  isPioneer: false;
  intoTrailId: string;
  overlapPct: number;
}

export type PioneerRunResult = PioneerRunResultPioneer | PioneerRunResultAutoMerged;

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
  // Soft warn from ADR-012 — UI handles via the Smart Suggest dialog,
  // not a flat error toast.
  name_suggests_existing: 'Wygląda jak istniejąca trasa',
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
//
// ADR-012 Phase 1.2: server can return three semantically distinct
// failures we map to discriminated client results:
//   - duplicate_name_in_spot: hard collision on normalized_name; the
//     conflicting trail row comes back in `existing` so the UI
//     routes to "OTWÓRZ Kometa" without a second round-trip.
//   - name_suggests_existing: soft warn on duplicate_base_key; the
//     `suggestions` array drives the Smart Suggest dialog, where
//     the rider can pick "OTWÓRZ" or confirm "TO INNA TRASA" (the
//     latter retries with forceCreate=true).
//   - any other: the legacy polish-error shape.

export type CreateTrailResult =
  | { ok: true; data: { trailId: string } }
  | {
      ok: false;
      code: 'duplicate_name_in_spot';
      message: string;
      existing: CreateTrailSuggestion;
    }
  | {
      ok: false;
      code: 'name_suggests_existing';
      message: string;
      suggestions: CreateTrailSuggestion[];
    }
  | { ok: false; code: string; message: string };

function mapCreateTrailSuggestion(raw: any): CreateTrailSuggestion {
  return {
    trailId: raw?.trail_id ?? '',
    officialName: raw?.official_name ?? '',
    difficulty: raw?.difficulty ?? '',
    trailType: raw?.trail_type ?? '',
    calibrationStatus: raw?.calibration_status,
  };
}

export async function createTrail(
  params: CreateTrailParams,
): Promise<CreateTrailResult> {
  const { data, error } = await db().rpc('create_trail', {
    p_spot_id: params.spotId,
    p_name: params.name,
    p_difficulty: params.difficulty,
    p_trail_type: params.trailType,
    p_force_create: params.forceCreate ?? false,
  });

  if (error) {
    return {
      ok: false,
      code: 'rpc_failed',
      message: CREATE_TRAIL_ERRORS.rpc_failed ?? 'Błąd',
    };
  }
  const res = data as any;
  if (res?.ok === true) {
    return { ok: true, data: { trailId: res.trail_id as string } };
  }

  const code = res?.code ?? 'rpc_failed';
  const message =
    CREATE_TRAIL_ERRORS[code] ?? CREATE_TRAIL_ERRORS.rpc_failed ?? 'Błąd';

  if (code === 'duplicate_name_in_spot' && res?.existing) {
    return {
      ok: false,
      code,
      message,
      existing: mapCreateTrailSuggestion(res.existing),
    };
  }

  if (code === 'name_suggests_existing' && Array.isArray(res?.suggestions)) {
    return {
      ok: false,
      code,
      message,
      suggestions: res.suggestions.map(mapCreateTrailSuggestion),
    };
  }

  return { ok: false, code, message };
}

// ── ADR-012 Phase 4.4 — admin review queue API ───────────────

export async function fetchReviewQueue(
  status: 'pending' | 'approved' | 'rejected' | 'merged' = 'pending',
  limit = 50,
): Promise<ApiResult<RouteReviewQueueEntry[]>> {
  const { data, error } = await db()
    .from('route_review_queue')
    .select(`
      id, trail_id, candidate_geometry_version_id,
      reason, severity, details, status, created_at,
      trails:trail_id (official_name, spot_id)
    `)
    .eq('status', status)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };

  const rows = (data as any[] | null) ?? [];
  const entries: RouteReviewQueueEntry[] = rows.map((r) => ({
    id: r.id,
    trailId: r.trail_id,
    trailName: r.trails?.official_name ?? null,
    spotId: r.trails?.spot_id ?? null,
    candidateGeometryVersionId: r.candidate_geometry_version_id ?? null,
    reason: r.reason,
    severity: r.severity,
    details: (r.details as Record<string, unknown> | null) ?? null,
    status: r.status,
    createdAt: r.created_at,
  }));
  return { ok: true, data: entries };
}

export async function resolveReviewQueueEntry(
  queueId: string,
  action: 'approve' | 'reject',
  notes?: string,
): Promise<ApiResult<{ queueId: string; action: string }>> {
  const { data, error } = await db().rpc('resolve_review_queue_entry', {
    p_queue_id: queueId,
    p_action: action,
    p_notes: notes ?? null,
  });
  if (error) return { ok: false, code: 'rpc_failed', message: error.message };
  const res = data as any;
  if (res?.ok === true) {
    return { ok: true, data: { queueId, action } };
  }
  return { ok: false, code: res?.code ?? 'rpc_failed', message: 'Resolve failed' };
}

export async function mergeTrails(
  sourceTrailId: string,
  targetTrailId: string,
  reason?: string,
): Promise<ApiResult<{ runsMoved: number; aliasesAdded: number }>> {
  const { data, error } = await db().rpc('merge_trails', {
    p_source_trail_id: sourceTrailId,
    p_target_trail_id: targetTrailId,
    p_reason: reason ?? null,
  });
  if (error) return { ok: false, code: 'rpc_failed', message: error.message };
  const res = data as any;
  if (res?.ok === true) {
    return {
      ok: true,
      data: {
        runsMoved: res.runs_moved ?? 0,
        aliasesAdded: res.aliases_added ?? 0,
      },
    };
  }
  return { ok: false, code: res?.code ?? 'rpc_failed', message: 'Merge failed' };
}

// ── listSpotTrails — Step 0 feed for trail/new ──

export async function listSpotTrails(
  spotId: string,
): Promise<ApiResult<SpotTrailSummary[]>> {
  const { data, error } = await db().rpc('list_spot_trails', {
    p_spot_id: spotId,
  });
  if (error) {
    return { ok: false, code: 'fetch_failed', message: error.message };
  }
  const rows = (data as any[] | null) ?? [];
  const trails: SpotTrailSummary[] = rows.map((r) => ({
    trailId: r.trail_id,
    officialName: r.official_name,
    normalizedName: r.normalized_name,
    duplicateBaseKey: r.duplicate_base_key,
    difficulty: r.difficulty,
    trailType: r.trail_type,
    calibrationStatus: r.calibration_status,
    trustTier: r.trust_tier ?? null,
    isActive: !!r.is_active,
    distanceM: r.distance_m ?? 0,
    runsContributed: r.runs_contributed ?? 0,
    uniqueConfirmingRidersCount: r.unique_confirming_riders_count ?? 0,
    currentVersionId: r.current_version_id ?? null,
    pioneerUserId: r.pioneer_user_id ?? null,
    pioneerUsername: r.pioneer_username ?? null,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
  }));
  return { ok: true, data: trails };
}

// ── fetchTrailGeometry — lean path for run-screen rehydration ──
//
// Separate from fetchTrail because the geometry jsonb can be 5-10 KB
// per trail; callers that only need metadata (list screens, headers)
// read it via `geometry === null` on the mapped Trail.

export interface TrailGeometryBundle {
  geometry: unknown;
  /** From trail_versions.start_gate (jsonb). Shape:
   *  `{lat, lng, radius_m, direction_deg}`. NULL for pre-build-49
   *  rows (pioneered before the gate-persisting migration) or
   *  trails without a current_version_id. */
  startGate: unknown | null;
  /** From trail_versions.finish_gate (jsonb). Same shape. */
  finishGate: unknown | null;
}

export async function fetchTrailGeometry(trailId: string): Promise<ApiResult<TrailGeometryBundle>> {
  const { data, error } = await db()
    .from('trails')
    .select('geometry, current_version_id')
    .eq('id', trailId)
    .single();
  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  if (!data) return { ok: false, code: 'not_found' };
  const trail = data as { geometry: unknown; current_version_id: string | null };

  // Best-effort fetch of canonical gate. If it fails (RLS, race
  // during version promotion, no version yet) we return null and
  // the client falls back to per-device derivation from geometry.
  let startGate: unknown = null;
  let finishGate: unknown = null;
  if (trail.current_version_id) {
    const { data: ver } = await db()
      .from('trail_versions')
      .select('start_gate, finish_gate')
      .eq('id', trail.current_version_id)
      .maybeSingle();
    if (ver) {
      const v = ver as { start_gate: unknown; finish_gate: unknown };
      startGate = v.start_gate ?? null;
      finishGate = v.finish_gate ?? null;
    }
  }
  return {
    ok: true,
    data: { geometry: trail.geometry, startGate, finishGate },
  };
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
  return { ok: true, data: normalizeRunRow(data as DbRun) };
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

/** Owner or curator run delete (migration 20260424120000). Mirrors
 *  the same response shape as the cleanup RPCs so callers can use
 *  the same error copy / retry UI. Does NOT yet expose the
 *  leaderboard-recalc result fields — once a delete survives the
 *  in-session retry + the local store mutation, the next
 *  incremental leaderboard refresh will pick up the promoted entry
 *  on its own. */
export async function deleteRun(runId: string): Promise<ApiResult<void>> {
  try {
    const { data, error } = await db().rpc('delete_run', { p_run_id: runId });
    if (error) {
      const isMissing = /function .*does not exist/i.test(error.message ?? '')
        || error.code === '42883';
      return cleanupError(isMissing ? 'rpc_missing' : 'rpc_failed', {
        pgCode: error.code,
        pgMessage: error.message,
      });
    }
    const res = data as { ok?: boolean; code?: string } | null;
    if (res?.ok === true) return { ok: true, data: undefined };
    return cleanupError(res?.code ?? 'rpc_failed', { rpcResponse: res });
  } catch (e: any) {
    return cleanupError('rpc_exception', { threw: e?.message ?? String(e) });
  }
}

export interface PromoteRunAsBaselineResult {
  trailId: string;
  runId: string;
  newVersionId: string;
  newVersionNumber: number;
  trailStatus: 'fresh_pending_second_run';
}

export async function promoteRunAsBaseline(
  runId: string,
): Promise<ApiResult<PromoteRunAsBaselineResult>> {
  try {
    const { data, error } = await db().rpc('promote_run_as_baseline', { p_run_id: runId });
    if (error) {
      const isMissing = /function .*does not exist/i.test(error.message ?? '')
        || error.code === '42883';
      return cleanupError(isMissing ? 'rpc_missing' : 'rpc_failed', {
        pgCode: error.code,
        pgMessage: error.message,
      });
    }

    const res = data as any;
    if (res?.ok === true) {
      return {
        ok: true,
        data: {
          trailId: res.trail_id as string,
          runId: res.run_id as string,
          newVersionId: res.new_version_id as string,
          newVersionNumber: res.new_version_number as number,
          trailStatus: 'fresh_pending_second_run',
        },
      };
    }

    return cleanupError(res?.code ?? 'rpc_failed', { rpcResponse: res });
  } catch (e: any) {
    return cleanupError('rpc_exception', { threw: e?.message ?? String(e) });
  }
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
// creates trail_versions row (version=1, is_current=true), and stores
// the seed run without opening the public leaderboard. Pioneer assignment flows
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

/** Variant returned when finalize_seed_run's "distinct" branch fired
 *  — the rider is the actual pioneer of a fresh trail. This is the
 *  common case. */
export interface SeedRunResultPioneer {
  kind: 'pioneer';
  runId: string;
  seedSource: SeedSource;
  trustTier: TrustTier;
  versionId: string;
  /** Always true for this variant; preserved for legacy callers
   *  that branch on this. New code should switch on `kind` instead. */
  isPioneer: true;
  trailStatus: 'fresh_pending_second_run';
  leaderboardPosition: number | null;
  /** Migration 20260423190000: true when the pioneer run also flipped
   *  its parent park from pending → active (Opcja B' submitter-self-
   *  active flow). Clients can surface a dedicated "park w lidze"
   *  celebration on first publish. false / undefined for parks that
   *  were already active before the run. */
  spotAutoActivated?: boolean;
}

/** Variant returned when finalize_seed_run's "auto_merge" branch
 *  fired — the geometry overlapped enough with an existing trail
 *  that the run was rebased onto that trail and the rider's draft
 *  trail row was archived. The rider is NOT the pioneer; the run
 *  counts on someone else's leaderboard. UI must navigate the
 *  rider to the canonical trail rather than to a "your new trail"
 *  pioneer celebration screen. Codex pass 5 loop-blocker — pre-
 *  build-49 client mapped every success as `isPioneer: true` and
 *  the auto-merge case ended up showing a never-existed trail. */
export interface SeedRunResultAutoMerged {
  kind: 'auto_merged';
  runId: string;
  isPioneer: false;
  /** The trail the run was rebased onto. Navigate here, not to
   *  the original draft trail id. */
  intoTrailId: string;
  /** Geo overlap percentage that triggered the auto-merge —
   *  0..1 numeric range. */
  overlapPct: number;
  /** The draft trail id the rider thought they were pioneering;
   *  this row was deleted server-side. */
  archivedDraftTrailId: string;
}

export type SeedRunResult = SeedRunResultPioneer | SeedRunResultAutoMerged;

/** Polish copy for every error code emitted by the Sprint-4 RPCs.
 *  Single source of truth so UI alerts stay consistent.
 *
 *  Migration 013 split the two legacy generic codes
 *  (`weak_signal_pioneer`, `invalid_geometry`) into six specific
 *  codes that carry `observed` + `required` numbers. The legacy
 *  entries stay below as fallbacks so stale app builds still render
 *  copy if a server that hasn't been migrated yet emits them — can
 *  be removed in a Sprint 5 cleanup once all environments are on
 *  mig 013. The six new codes do NOT carry generic strings here:
 *  the validator in `src/features/recording/validators.ts` builds
 *  the dynamic "28s / min 30s" style message and the RPC emits
 *  matching numbers in the response payload — UI prefers those
 *  over this map when present. */
const SEED_RUN_ERRORS: Record<string, string> = {
  unauthenticated:          'Zaloguj się ponownie',
  trail_not_found:          'Trasa nie istnieje',
  already_pioneered:        'Ktoś Cię wyprzedził — trasa ma już Pioneera',
  invalid_state:            'Trasa nie jest w stanie draft',
  not_authorized:           'Brak uprawnień do tej operacji',
  no_current_version:       'Trasa nie ma aktywnej wersji',
  rpc_failed:               'Nie udało się zapisać zjazdu. Spróbuj ponownie.',
  // Codex FAZA2-R2 P2 — mig 20260426 added this code for "spot still
  // pending curator review; only the submitter may pioneer it". Without
  // a mapping, the UI fell back to the generic rpc_failed copy.
  pending_spot_forbidden:   'Ten bike park czeka na pioniera który go zgłosił. Poczekaj aż zaklepią go kuratorzy — wtedy otworzy się dla wszystkich.',

  // Sprint 4.5 / mig 013 — specific geometry / duration / accuracy codes.
  // Generic fallback copy; validators module provides the dynamic version.
  too_short_duration:       'Nagranie za krótkie dla Pioniera (min 30s)',
  too_short_distance:       'Trasa za krótka dla Pioniera (min 150m)',
  too_few_points:           'Za mało punktów GPS dla Pioniera (min 15)',
  accuracy_too_poor_avg:    'Słaby sygnał GPS — średnia dokładność za niska',
  accuracy_too_poor_start:  'Słaby sygnał GPS na starcie',
  accuracy_too_poor_end:    'Słaby sygnał GPS na mecie',

  // Legacy codes — mig 012 stopped emitting these in favour of the
  // specific codes above. Retained as display fallbacks for stale
  // server-side responses. Remove once all environments are on mig 013.
  weak_signal_pioneer:      'Słaby sygnał GPS — kalibracja odrzucona',
  invalid_geometry:         'Za mało punktów GPS (min 15)',
};

export async function finalizeSeedRun(
  params: SeedRunParams,
): Promise<ApiResult<SeedRunResult>> {
  if (__DEV__) {
    const pointCount = params.geometry?.points?.length ?? 0;
    const totalDistanceM = (params.geometry as any)?.meta?.totalDistanceM;
    console.log('[finalizeSeedRun] →', {
      trailId:           params.trailId,
      durationMs:        params.durationMs,
      medianAccuracyM:   params.medianAccuracyM,
      pointCount,
      totalDistanceM,
      qualityTier:       params.qualityTier,
      verificationStatus: params.verificationStatus,
    });
  }

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

  if (error) {
    if (__DEV__) console.log('[finalizeSeedRun] RPC transport error:', error);
    return polishError('rpc_failed', SEED_RUN_ERRORS);
  }
  if (__DEV__) console.log('[finalizeSeedRun] ← server:', data);
  const res = data as any;
  if (res?.ok === true) {
    // Auto-merge branch — geometry overlapped enough with an
    // existing trail that the server rebased the run onto that
    // trail and archived the rider's draft. Pre-build-49 the
    // client mapped every ok response as `isPioneer: true`, so
    // the rider was navigated to a celebration of a trail that
    // no longer existed. Codex pass 5 loop-blocker — handle as
    // its own kind.
    if (res.auto_merged === true) {
      return {
        ok: true,
        data: {
          kind:                 'auto_merged',
          runId:                res.run_id as string,
          isPioneer:            false,
          intoTrailId:          res.into_trail_id as string,
          overlapPct:           Number(res.overlap_pct ?? 0),
          archivedDraftTrailId: res.archived_draft_trail_id as string,
        },
      };
    }
    return {
      ok: true,
      data: {
        kind:                'pioneer',
        runId:               res.run_id as string,
        seedSource:          res.seed_source as SeedSource,
        trustTier:           res.trust_tier as TrustTier,
        versionId:           res.version_id as string,
        isPioneer:           true,
        trailStatus:         (res.trail_status as 'fresh_pending_second_run') ?? 'fresh_pending_second_run',
        leaderboardPosition: (res.leaderboard_position as number | null) ?? null,
        spotAutoActivated:   res.spot_auto_activated === true,
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
  // Pass the auto_merge discriminant through to UI callers so the
  // review screen can navigate to the canonical trail rather than
  // showing a pioneer celebration for a draft trail that's been
  // archived server-side.
  if (result.data.kind === 'auto_merged') {
    return {
      ok: true,
      data: {
        kind:        'auto_merged',
        runId:       result.data.runId,
        isPioneer:   false,
        intoTrailId: result.data.intoTrailId,
        overlapPct:  result.data.overlapPct,
      },
    };
  }
  return {
    ok: true,
    data: {
      kind:                'pioneer',
      runId:               result.data.runId,
      isPioneer:           true,
      trailStatus:         'fresh_pending_second_run',
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

// ─────────────────────────────────────────────────────────────
// Founder test-data tools.
//
// All four functions are SECURITY DEFINER on the server side
// (migration 20260427160000_founder_test_tools). Client never
// asserts permissions — we send the call and trust the RPC's
// `forbidden` reply. UI only uses isFounderUser() to hide the
// menu entry; the destructive RPC double-checks anyway.
// ─────────────────────────────────────────────────────────────

export interface TestDataPreview {
  runs: number;
  leaderboardEntries: number;
  challengeProgress: number;
  achievements: number;
  pioneerTrails: number;
}

export interface TestDataDeleted {
  runs: number;
  leaderboardEntries: number;
  challengeProgress: number;
  achievements: number;
}

export async function isFounderUser(): Promise<boolean> {
  try {
    const { data, error } = await db().rpc('is_founder_user');
    if (error) {
      if (__DEV__) console.warn('[is_founder_user] error:', error);
      return false;
    }
    return data === true;
  } catch (e) {
    if (__DEV__) console.warn('[is_founder_user] threw:', e);
    return false;
  }
}

export async function previewTestDataReset(): Promise<ApiResult<TestDataPreview>> {
  try {
    const { data, error } = await db().rpc('preview_test_data_reset');
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return { ok: false, code: res?.code ?? 'rpc_failed' };
    }
    return {
      ok: true,
      data: {
        runs: Number(res.runs ?? 0),
        leaderboardEntries: Number(res.leaderboard_entries ?? 0),
        challengeProgress: Number(res.challenge_progress ?? 0),
        achievements: Number(res.achievements ?? 0),
        pioneerTrails: Number(res.pioneer_trails ?? 0),
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

export async function resetMyTestData(): Promise<ApiResult<TestDataDeleted>> {
  try {
    const { data, error } = await db().rpc('reset_my_test_data');
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return { ok: false, code: res?.code ?? 'rpc_failed' };
    }
    const d = res.deleted ?? {};
    return {
      ok: true,
      data: {
        runs: Number(d.runs ?? 0),
        leaderboardEntries: Number(d.leaderboard_entries ?? 0),
        challengeProgress: Number(d.challenge_progress ?? 0),
        achievements: Number(d.achievements ?? 0),
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

// ─────────────────────────────────────────────────────────────
// Feedback reports — TestFlight bug/idea/praise inbox.
// RLS lets any authenticated rider insert their own row; reads
// are restricted to founder/curator/moderator (see migration
// 20260427180000_feedback_reports).
// ─────────────────────────────────────────────────────────────

export type FeedbackType = 'bug' | 'unclear' | 'idea' | 'praise';

export interface FeedbackPayload {
  type: FeedbackType;
  message: string;
  screen?: string;
  trailId?: string | null;
  runId?: string | null;
  appVersion?: string;
  deviceInfo?: Record<string, unknown>;
  debugPayload?: Record<string, unknown>;
}

export async function submitFeedback(
  userId: string,
  input: FeedbackPayload,
): Promise<ApiResult<{ id: string }>> {
  const trimmed = input.message.trim();
  if (trimmed.length === 0) {
    return { ok: false, code: 'empty_message', message: 'Wpisz coś przed wysłaniem.' };
  }
  try {
    const { data, error } = await db()
      .from('feedback_reports')
      .insert({
        user_id: userId,
        screen: input.screen ?? null,
        trail_id: input.trailId ?? null,
        run_id: input.runId ?? null,
        type: input.type,
        message: trimmed.slice(0, 4000),
        app_version: input.appVersion ?? null,
        device_info: input.deviceInfo ?? null,
        debug_payload: input.debugPayload ?? null,
      })
      .select('id')
      .single();
    if (error) {
      return { ok: false, code: 'insert_failed', message: error.message };
    }
    return { ok: true, data: { id: (data as { id: string }).id } };
  } catch (e: any) {
    return { ok: false, code: 'exception', message: e?.message ?? String(e) };
  }
}

export type TestSpotDeleteOutcome =
  | { mode: 'deleted'; spotId: string; trailsDeleted: number }
  | { mode: 'archived'; spotId: string; foreignRuns: number };

export async function deleteTestSpot(
  spotId: string,
  options: { archiveIfBlocked?: boolean } = {},
): Promise<ApiResult<TestSpotDeleteOutcome>> {
  try {
    const { data, error } = await db().rpc('delete_test_spot', {
      p_spot_id: spotId,
      p_archive_if_blocked: options.archiveIfBlocked ?? false,
    });
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return {
        ok: false,
        code: res?.code ?? 'rpc_failed',
        message: res?.hint ?? undefined,
      };
    }
    if (res.mode === 'archived') {
      return {
        ok: true,
        data: {
          mode: 'archived',
          spotId,
          foreignRuns: Number(res.foreign_runs ?? 0),
        },
      };
    }
    return {
      ok: true,
      data: {
        mode: 'deleted',
        spotId,
        trailsDeleted: Number(res.trails_deleted ?? 0),
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

export type FounderContentAction = 'archive' | 'delete';

export type FounderSpotManageOutcome =
  | {
      mode: 'archived';
      spotId: string;
      trailsArchived: number;
      foreignRuns: number;
    }
  | {
      mode: 'deleted';
      spotId: string;
      trailsDeleted: number;
      runsDeleted: number;
      leaderboardEntriesDeleted: number;
      foreignRuns: number;
    };

export type FounderTrailManageOutcome =
  | {
      mode: 'archived';
      trailId: string;
      foreignRuns: number;
    }
  | {
      mode: 'deleted';
      trailId: string;
      runsDeleted: number;
      leaderboardEntriesDeleted: number;
      foreignRuns: number;
    };

export async function founderManageSpot(
  spotId: string,
  action: FounderContentAction,
  reason: string = 'founder cleanup',
): Promise<ApiResult<FounderSpotManageOutcome>> {
  try {
    const { data, error } = await db().rpc('founder_manage_spot', {
      p_spot_id: spotId,
      p_action: action,
      p_reason: reason,
    });
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return { ok: false, code: res?.code ?? 'rpc_failed', message: res?.hint ?? undefined };
    }
    if (res.mode === 'archived') {
      return {
        ok: true,
        data: {
          mode: 'archived',
          spotId,
          trailsArchived: Number(res.trails_archived ?? 0),
          foreignRuns: Number(res.foreign_runs ?? 0),
        },
      };
    }
    return {
      ok: true,
      data: {
        mode: 'deleted',
        spotId,
        trailsDeleted: Number(res.trails_deleted ?? 0),
        runsDeleted: Number(res.runs_deleted ?? 0),
        leaderboardEntriesDeleted: Number(res.leaderboard_entries_deleted ?? 0),
        foreignRuns: Number(res.foreign_runs ?? 0),
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

export async function founderManageTrail(
  trailId: string,
  action: FounderContentAction,
  reason: string = 'founder cleanup',
): Promise<ApiResult<FounderTrailManageOutcome>> {
  try {
    const { data, error } = await db().rpc('founder_manage_trail', {
      p_trail_id: trailId,
      p_action: action,
      p_reason: reason,
    });
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return { ok: false, code: res?.code ?? 'rpc_failed', message: res?.hint ?? undefined };
    }
    if (res.mode === 'archived') {
      return {
        ok: true,
        data: {
          mode: 'archived',
          trailId,
          foreignRuns: Number(res.foreign_runs ?? 0),
        },
      };
    }
    return {
      ok: true,
      data: {
        mode: 'deleted',
        trailId,
        runsDeleted: Number(res.runs_deleted ?? 0),
        leaderboardEntriesDeleted: Number(res.leaderboard_entries_deleted ?? 0),
        foreignRuns: Number(res.foreign_runs ?? 0),
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

// ─── Founder god-mode listings ──────────────────────────────
// Surface ALL spots / pioneer trails so the founder can hunt
// down test-garbage left by anyone, not just their own. RLS lets
// founders read everything ("Curators read all spots", and the
// trails table has no per-status read gate). Delete RPCs are
// the real authority — these queries just feed the picker.

export interface FounderSpotRow {
  spotId: string;
  name: string;
  status: 'pending' | 'active' | 'rejected' | string;
  submittedBy: string | null;
  submitterUsername: string | null;
  isMine: boolean;
  trailCount: number;
  createdAt: string | null;
}

export async function listAllSpotsForFounder(
  currentUserId: string,
): Promise<ApiResult<FounderSpotRow[]>> {
  const { data, error } = await db()
    .from('spots')
    .select(
      'id, name, status, submitted_by, created_at, ' +
      'submitter:profiles!spots_submitted_by_fkey(username), ' +
      'trails(count)',
    )
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  const rows = (data ?? []).map((r: any): FounderSpotRow => ({
    spotId: r.id,
    name: r.name,
    status: r.status,
    submittedBy: r.submitted_by ?? null,
    submitterUsername: r.submitter?.username ?? null,
    isMine: r.submitted_by === currentUserId,
    trailCount: Array.isArray(r.trails) ? Number(r.trails[0]?.count ?? 0) : 0,
    createdAt: r.created_at ?? null,
  }));
  return { ok: true, data: rows };
}

export interface FounderTrailRow {
  trailId: string;
  name: string;
  spotId: string;
  spotName: string | null;
  pioneerUserId: string | null;
  pioneerUsername: string | null;
  isMine: boolean;
  calibrationStatus: string | null;
  runsContributed: number;
}

export interface FounderUserRow {
  userId: string;
  username: string;
  displayName: string | null;
  role: string;
  totalRuns: number;
  pioneeredTotal: number;
  createdAt: string | null;
  isMe: boolean;
}

export async function listAllUsersForFounder(
  currentUserId: string,
): Promise<ApiResult<FounderUserRow[]>> {
  const { data, error } = await db()
    .from('profiles')
    .select('id, username, display_name, role, total_runs, pioneered_total_count, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  const rows = (data ?? []).map((r: any): FounderUserRow => ({
    userId: r.id,
    username: r.username,
    displayName: r.display_name ?? null,
    role: r.role ?? 'rider',
    totalRuns: Number(r.total_runs ?? 0),
    pioneeredTotal: Number(r.pioneered_total_count ?? 0),
    createdAt: r.created_at ?? null,
    isMe: r.id === currentUserId,
  }));
  return { ok: true, data: rows };
}

export interface UserDeleteOutcome {
  deletedUsername: string;
  cascade: {
    runs: number;
    leaderboardEntries: number;
    spotsOrphaned: number;
    trailsOrphaned: number;
  };
}

export async function deleteUserCascade(
  userId: string,
  reason: string = '',
): Promise<ApiResult<UserDeleteOutcome>> {
  try {
    const { data, error } = await db().rpc('delete_user_cascade', {
      p_user_id: userId,
      p_reason: reason,
    });
    if (error) return { ok: false, code: 'rpc_failed', message: error.message };
    const res = data as any;
    if (res?.ok !== true) {
      return { ok: false, code: res?.code ?? 'rpc_failed' };
    }
    return {
      ok: true,
      data: {
        deletedUsername: res.deleted_user,
        cascade: {
          runs: Number(res.cascade?.runs ?? 0),
          leaderboardEntries: Number(res.cascade?.leaderboard_entries ?? 0),
          spotsOrphaned: Number(res.cascade?.spots_orphaned ?? 0),
          trailsOrphaned: Number(res.cascade?.trails_orphaned ?? 0),
        },
      },
    };
  } catch (e: any) {
    return { ok: false, code: 'rpc_exception', message: e?.message ?? String(e) };
  }
}

export async function listAllTrailsForFounder(
  currentUserId: string,
): Promise<ApiResult<FounderTrailRow[]>> {
  const { data, error } = await db()
    .from('trails')
    .select(
      'id, official_name, spot_id, pioneer_user_id, calibration_status, runs_contributed, ' +
      'spot:spots!trails_spot_id_fkey(name), ' +
      'pioneer:profiles!trails_pioneer_user_id_fkey(username)',
    )
    .order('id', { ascending: false })
    .limit(300);

  if (error) return { ok: false, code: 'fetch_failed', message: error.message };
  const rows = (data ?? []).map((r: any): FounderTrailRow => ({
    trailId: r.id,
    name: r.official_name ?? r.id,
    spotId: r.spot_id,
    spotName: r.spot?.name ?? null,
    pioneerUserId: r.pioneer_user_id ?? null,
    pioneerUsername: r.pioneer?.username ?? null,
    isMine: r.pioneer_user_id === currentUserId,
    calibrationStatus: r.calibration_status ?? null,
    runsContributed: Number(r.runs_contributed ?? 0),
  }));
  return { ok: true, data: rows };
}
