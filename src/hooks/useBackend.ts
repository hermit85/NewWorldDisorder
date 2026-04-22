// ═══════════════════════════════════════════════════════════
// useBackend — typed result states: loading / data / error / signed-out
// NEVER collapses backend failure into fake empty state.
// Post-Checkpoint-C: no mock fallbacks. When Supabase is not
// configured, hooks return 'error' so the UI can tell the user
// something is off instead of showing a fake empty world.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as api from '@/lib/api';
import { LeaderboardRow } from '@/lib/api';
import { useRefreshSignal, triggerRefresh } from './useRefresh';

import { LeaderboardEntry, PeriodType, Challenge, User, Achievement, Spot, Trail } from '@/data/types';

import { logDebugEvent } from '@/systems/debugEvents';
import { shouldSimFetchFail, shouldSimFetchEmpty } from '@/systems/testMode';

export function isBackendConfigured(): boolean {
  return isSupabaseConfigured;
}

/** True when production build has no backend — app should show blocking error */
export const isProductionMisconfigured = !isSupabaseConfigured && !__DEV__;

// ── Typed fetch status ──
export type FetchStatus = 'loading' | 'ok' | 'empty' | 'error' | 'signed_out';

declare global {
  // DevTools override: global.__DEV_MOCK_HERO_BEAT__ = true
  // eslint-disable-next-line no-var
  var __DEV_MOCK_HERO_BEAT__: boolean | undefined;
}

export const __DEV_MOCK_HERO_BEAT__ = false;
const DEV_EMPTY_SPOT_ID = 'dev-kopa-empty';
const DEV_EMPTY_SPOT: Spot = {
  id: DEV_EMPTY_SPOT_ID,
  name: 'KOPA',
  slug: DEV_EMPTY_SPOT_ID,
  description: '',
  region: 'Szczyrk',
  isOfficial: false,
  coverImage: '',
  status: 'active',
  submissionStatus: 'active',
  activeRidersToday: 0,
  trailCount: 0,
};

function shouldUseDevMockHeroBeat(): boolean {
  if (!__DEV__) return false;
  return globalThis.__DEV_MOCK_HERO_BEAT__ ?? __DEV_MOCK_HERO_BEAT__;
}

// ══════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════

export function useLeaderboard(trailId: string, periodType: PeriodType = 'all_time', userId?: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    // Guard: empty trailId → skip network. Lets the home screen pass ''
    // for a featured board when no trail is actually active.
    if (!trailId) {
      setEntries([]);
      setStatus('empty');
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);
    logDebugEvent('fetch', 'leaderboard_start', 'start', { trailId, payload: { periodType } });

    // ── Simulation override ──
    if (shouldSimFetchFail('leaderboard')) {
      logDebugEvent('fetch', 'leaderboard_sim_fail', 'fail', { trailId });
      setError('Could not load leaderboard');
      setEntries([]);
      setStatus('error');
      return;
    }
    if (shouldSimFetchEmpty('leaderboard')) {
      setEntries([]);
      setStatus('empty');
      return;
    }

    try {
      let rows: api.LeaderboardRow[];
      if (periodType === 'day' || periodType === 'weekend') {
        const scope = periodType === 'day' ? 'today' : 'weekend';
        rows = await api.fetchScopedLeaderboard(trailId, scope as any, userId);
      } else {
        rows = await api.fetchLeaderboard(trailId, periodType, userId);
      }
      setEntries(rows.map(mapLeaderboardRow));
      setStatus(rows.length > 0 ? 'ok' : 'empty');
      logDebugEvent('fetch', 'leaderboard_ok', 'ok', { trailId, payload: { count: rows.length, periodType } });
    } catch (e: any) {
      logDebugEvent('fetch', 'leaderboard_fail', 'fail', { trailId, payload: { error: e?.message } });
      setError('Could not load leaderboard');
      setEntries([]);
      setStatus('error');
    }
  }, [trailId, periodType, userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, status, error, loading: status === 'loading', refresh };
}

// ══════════════════════════════════════════════════════════
// TRAIL STATS
// ══════════════════════════════════════════════════════════

export function useUserTrailStats(userId?: string) {
  const [stats, setStats] = useState<Map<string, { pbMs: number | null; position: number | null }>>(new Map());
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setStats(new Map());
      setStatus('signed_out');
      return;
    }

    try {
      const map = await api.fetchUserTrailStats(userId);
      setStats(map);
      setStatus(map.size > 0 ? 'ok' : 'empty');
    } catch {
      console.warn('[NWD] Trail stats fetch failed');
      setStats(new Map());
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, status, loading: status === 'loading', refresh };
}

// ══════════════════════════════════════════════════════════
// CHALLENGES
// ══════════════════════════════════════════════════════════

export function useChallenges(spotId: string, userId?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    try {
      const data = await api.fetchActiveChallenges(spotId);
      const progressMap = userId
        ? await api.fetchChallengeProgress(userId, data.map(c => c.id))
        : new Map();

      const mapped = data.map(c => ({
        id: c.id,
        spotId: c.spot_id,
        trailId: c.trail_id,
        type: c.type as any,
        name: c.name,
        description: c.description,
        startAt: c.starts_at,
        endAt: c.ends_at,
        rewardXp: c.reward_xp,
        isActive: c.is_active,
        currentProgress: progressMap.get(c.id)?.current_value ?? 0,
        targetProgress: (c as any).target_value ?? 1,
      }));
      setChallenges(mapped);
      setStatus(mapped.length > 0 ? 'ok' : 'empty');
    } catch {
      setChallenges([]);
      setStatus('error');
    }
  }, [spotId, userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { challenges, status, loading: status === 'loading' };
}

// ══════════════════════════════════════════════════════════
// CHUNK 9 — Home + Bike Park data
// ══════════════════════════════════════════════════════════

export function useHeroBeat(userId?: string) {
  const [heroBeat, setHeroBeat] = useState<api.HeroBeat | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setHeroBeat(null);
      setStatus('signed_out');
      return;
    }

    if (shouldUseDevMockHeroBeat()) {
      setHeroBeat({
        trailId: 'test-background-v1',
        trailName: 'Test background v1',
        beaterName: 'Kacper',
        happenedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
        beaterTimeMs: 88_400,
        userTimeMs: 90_000,
        deltaMs: 1_600,
        previousPosition: 1,
        currentPosition: 2,
      });
      setStatus('ok');
      return;
    }

    try {
      const data = await api.fetchHeroBeat(userId);
      setHeroBeat(data);
      setStatus(data ? 'ok' : 'empty');
    } catch {
      setHeroBeat(null);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { heroBeat, status, loading: status === 'loading', refresh };
}

export function useDailyChallenges(userId?: string) {
  const [challenges, setChallenges] = useState<api.DailyChallengeProgress[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setChallenges([]);
      setStatus('signed_out');
      return;
    }

    try {
      const data = await api.fetchDailyChallenges(userId);
      setChallenges(data);
      setStatus(data.length > 0 ? 'ok' : 'empty');
    } catch {
      setChallenges([]);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { challenges, status, loading: status === 'loading', refresh };
}

export function useStreakState(userId?: string) {
  const [streak, setStreak] = useState<api.StreakState | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setStreak(null);
      setStatus('signed_out');
      return;
    }

    try {
      const data = await api.fetchStreakState(userId);
      setStreak(data);
      setStatus(data.days > 0 ? 'ok' : 'empty');
    } catch {
      setStreak(null);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { streak, status, loading: status === 'loading', refresh };
}

export function useLeagueFeed(userId?: string, limit: number = 5) {
  const [events, setEvents] = useState<api.FeedEvent[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setEvents([]);
      setStatus('signed_out');
      return;
    }

    try {
      const data = await api.fetchLeagueFeed(userId, limit);
      setEvents(data);
      setStatus(data.length > 0 ? 'ok' : 'empty');
    } catch {
      setEvents([]);
      setStatus('error');
    }
  }, [userId, limit, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { events, status, loading: status === 'loading', refresh };
}

export function useBikeParkTrails(spotId: string | null, userId?: string) {
  const [trails, setTrails] = useState<api.BikeParkTrailCardData[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!spotId) {
      setTrails([]);
      setStatus('empty');
      return;
    }
    if (__DEV__ && spotId === DEV_EMPTY_SPOT_ID) {
      setTrails([]);
      setStatus('empty');
      return;
    }

    try {
      const data = await api.fetchBikeParkTrails(userId, spotId);
      setTrails(data);
      setStatus(data.length > 0 ? 'ok' : 'empty');
    } catch {
      setTrails([]);
      setStatus('error');
    }
  }, [spotId, userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trails, status, loading: status === 'loading', refresh };
}

// ══════════════════════════════════════════════════════════
// PROFILE
// ══════════════════════════════════════════════════════════

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<User | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    logDebugEvent('fetch', 'profile_start', 'start', { sessionId: userId });

    if (!userId) {
      setProfile(null);
      setStatus('signed_out');
      return;
    }

    if (shouldSimFetchFail('profile')) {
      logDebugEvent('fetch', 'profile_sim_fail', 'fail');
      setProfile(null);
      setStatus('error');
      return;
    }

    try {
      const p = await api.fetchProfile(userId);
      if (p) {
        logDebugEvent('fetch', 'profile_ok', 'ok', { payload: { xp: p.xp, runs: p.total_runs } });
        setProfile({
          id: p.id,
          username: p.display_name || p.username,
          rankId: p.rank_id as any,
          xp: p.xp,
          xpToNextRank: 0,
          totalRuns: p.total_runs,
          totalPbs: p.total_pbs,
          // bestPosition: only show if real (> 0), otherwise hide
          bestPosition: (p.best_position && p.best_position > 0) ? p.best_position : 0,
          // favoriteTrailId: only show if non-empty
          favoriteTrailId: p.favorite_trail_id || '',
          joinedAt: p.created_at,
          achievements: [],
          avatarUrl: p.avatar_url ?? null,
          // Sprint 4 (mig 011) — Pioneer counters
          pioneeredTotalCount: (p as any).pioneered_total_count ?? 0,
          pioneeredVerifiedCount: (p as any).pioneered_verified_count ?? 0,
        });
        setStatus('ok');
      } else {
        setProfile(null);
        setStatus('empty');
      }
    } catch {
      setProfile(null);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, status, loading: status === 'loading', refresh };
}

// ══════════════════════════════════════════════════════════
// LEAGUE MOVEMENT — re-engagement signals
// ══════════════════════════════════════════════════════════

import {
  deriveSignals,
  getTopSignals,
  LeagueSignal,
  RiderBoardContext,
  VenueActivityContext,
} from '@/systems/leagueMovement';

/**
 * League movement signals for a rider across a specific trail set.
 * Checkpoint C: `trails` is passed in from the caller (derived from
 * the active spot's DB trails). Previously sourced from the mock/
 * catalogue which no longer exists.
 * TODO Sprint 3: resolve venueName from DB instead of venue registry.
 */
export function useLeagueMovement(
  userId?: string,
  venueActivity?: VenueActivity | null,
  trails?: Trail[],
) {
  const [signals, setSignals] = useState<LeagueSignal[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setSignals([]);
      setStatus('signed_out');
      return;
    }
    const trailList = trails ?? [];
    if (trailList.length === 0) {
      setSignals([]);
      setStatus('empty');
      return;
    }

    try {
      const trailIds = trailList.map(t => t.id);
      const boardData = await api.fetchRiderBoardContext(userId, trailIds);

      const trailNames: Record<string, string> = {};
      for (const t of trailList) trailNames[t.id] = t.name;

      const riderBoards: RiderBoardContext[] = boardData.map(b => ({
        ...b,
        trailName: trailNames[b.trailId] ?? b.trailId,
      }));

      const venueCtx: VenueActivityContext | null = venueActivity ? {
        venueId: 'unknown',
        venueName: 'Arena',
        verifiedRunsToday: venueActivity.verifiedRunsToday,
        activeRidersToday: venueActivity.activeRidersToday,
        hotTrailId: venueActivity.hotTrailId,
        hotTrailName: venueActivity.hotTrailId ? (trailNames[venueActivity.hotTrailId] ?? null) : null,
        hotTrailRuns: venueActivity.hotTrailRuns,
      } : null;

      const all = deriveSignals(riderBoards, venueCtx);
      const top = getTopSignals(all, 3);

      setSignals(top);
      setStatus(top.length > 0 ? 'ok' : 'empty');
    } catch {
      setSignals([]);
      setStatus('error');
    }
  }, [userId, venueActivity, trails, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { signals, status, loading: status === 'loading' };
}

// ══════════════════════════════════════════════════════════
// RESULT IMPACT — scoped board positions after a run
// ══════════════════════════════════════════════════════════

export interface ScopeImpact {
  scope: 'today' | 'weekend' | 'all_time';
  position: number | null;
  totalRiders: number;
}

export function useResultImpact(userId?: string, trailId?: string, saved?: boolean) {
  const [impact, setImpact] = useState<ScopeImpact[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');

  useEffect(() => {
    if (!userId || !trailId || !saved) {
      setImpact([]);
      setStatus('empty');
      return;
    }

    let mounted = true;
    logDebugEvent('fetch', 'result_impact_start', 'start', { trailId });

    if (shouldSimFetchFail('resultImpact')) {
      logDebugEvent('fetch', 'result_impact_sim_fail', 'fail', { trailId });
      setStatus('error');
      return;
    }

    async function load() {
      try {
        const data = await api.fetchResultImpact(userId!, trailId!);
        if (mounted) {
          setImpact(data);
          setStatus(data.length > 0 ? 'ok' : 'empty');
          logDebugEvent('fetch', 'result_impact_ok', 'ok', { trailId, payload: { scopes: data.length } });
        }
      } catch {
        logDebugEvent('fetch', 'result_impact_fail', 'fail', { trailId });
        if (mounted) setStatus('error');
      }
    }
    load();
    return () => { mounted = false; };
  }, [userId, trailId, saved]);

  return { impact, status, loading: status === 'loading' };
}

// ══════════════════════════════════════════════════════════
// VENUE ACTIVITY — today's live stats
// ══════════════════════════════════════════════════════════

export interface VenueActivity {
  verifiedRunsToday: number;
  activeRidersToday: number;
  hotTrailId: string | null;
  hotTrailRuns: number;
}

export function useVenueActivity(spotId: string) {
  const [activity, setActivity] = useState<VenueActivity | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    logDebugEvent('fetch', 'venue_activity_start', 'start', { venueId: spotId });

    if (shouldSimFetchFail('venueActivity')) {
      logDebugEvent('fetch', 'venue_activity_sim_fail', 'fail', { venueId: spotId });
      setActivity(null);
      setStatus('error');
      return;
    }

    try {
      const data = await api.fetchVenueActivity(spotId);
      setActivity(data);
      setStatus(data.verifiedRunsToday > 0 ? 'ok' : 'empty');
      logDebugEvent('fetch', 'venue_activity_ok', 'ok', { venueId: spotId, payload: { runs: data.verifiedRunsToday, riders: data.activeRidersToday } });
    } catch {
      logDebugEvent('fetch', 'venue_activity_fail', 'fail', { venueId: spotId });
      setActivity(null);
      setStatus('error');
    }
  }, [spotId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { activity, status, loading: status === 'loading' };
}

// ══════════════════════════════════════════════════════════
// ACHIEVEMENTS — real unlocked achievements from backend
// ══════════════════════════════════════════════════════════

export function useAchievements(userId?: string) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setAchievements([]);
      setStatus('signed_out');
      return;
    }

    try {
      const data = await api.fetchUserAchievements(userId);
      const mapped: Achievement[] = data.map((row: any) => ({
        id: row.achievement_id,
        slug: row.achievements?.slug ?? row.achievement_id,
        name: row.achievements?.name ?? row.achievement_id,
        description: row.achievements?.description ?? '',
        icon: row.achievements?.icon ?? '?',
        xpReward: row.achievements?.xp_reward ?? 0,
        isUnlocked: true,
        unlockedAt: row.created_at,
      }));
      setAchievements(mapped);
      setStatus(mapped.length > 0 ? 'ok' : 'empty');
    } catch {
      setAchievements([]);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { achievements, status, loading: status === 'loading' };
}

// ══════════════════════════════════════════════════════════
// RUN SUBMISSION
// ══════════════════════════════════════════════════════════

export async function submitRunToBackend(params: api.SubmitRunParams): Promise<api.SubmitRunResult | null> {
  return api.submitRun(params);
}

// ══════════════════════════════════════════════════════════
// SPOT SUBMISSION (Sprint 2)
// ══════════════════════════════════════════════════════════

export type PendingSpotsStatus = 'loading' | 'ok' | 'empty' | 'error' | 'unauthorized' | 'signed_out';

/** Curator-only view of the pending-spots queue. Returns `unauthorized`
 *  for non-curator/non-moderator profiles so the screen can redirect. */
export function usePendingSpots(role: string | null | undefined, userId?: string) {
  const [spots, setSpots] = useState<api.PendingSpot[]>([]);
  const [status, setStatus] = useState<PendingSpotsStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setSpots([]);
      setStatus('signed_out');
      return;
    }
    if (role !== 'curator' && role !== 'moderator') {
      setSpots([]);
      setStatus('unauthorized');
      return;
    }

    const res = await api.listPendingSpots();
    if (!res.ok) {
      setSpots([]);
      setStatus('error');
      return;
    }
    setSpots(res.data);
    setStatus(res.data.length > 0 ? 'ok' : 'empty');
  }, [role, userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spots, status, loading: status === 'loading', refresh };
}

/** Rider's own pending + rejected spots. Used for the "oczekuje" / "odrzucone"
 *  strip on home. */
export function useMyPendingSpots(userId?: string) {
  const [spots, setSpots] = useState<api.PendingSpot[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) {
      setSpots([]);
      setStatus('signed_out');
      return;
    }

    const res = await api.listMyPendingSpots(userId);
    if (!res.ok) {
      setSpots([]);
      setStatus('error');
      return;
    }
    setSpots(res.data);
    setStatus(res.data.length > 0 ? 'ok' : 'empty');
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spots, status, loading: status === 'loading', refresh };
}

// ── DB row → app type mapper ──

function mapLeaderboardRow(row: LeaderboardRow): LeaderboardEntry {
  return {
    userId: row.userId,
    username: row.displayName || row.username,
    rankId: row.rankId as any,
    trailId: row.trailId,
    periodType: row.periodType as any,
    bestDurationMs: row.bestDurationMs,
    currentPosition: row.rankPosition,
    previousPosition: row.previousPosition ?? row.rankPosition,
    delta: row.delta,
    gapToNext: 0,
    gapToLeader: row.gapToLeader,
    isCurrentUser: row.isCurrentUser,
    avatarUrl: (row as any).avatarUrl ?? null,
  };
}

// ══════════════════════════════════════════════════════════
// SPOTS & TRAILS (Checkpoint A — DB-backed, replace mock data)
// ══════════════════════════════════════════════════════════

// usePrimarySpot — "Twój bike park" home shortcut data. Null when the
// user has no runs yet (home renders empty CTA instead).
export function usePrimarySpot(userId: string | null) {
  const [data, setData] = useState<api.PrimarySpotSummary | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!userId) { setData(null); setStatus('signed_out'); return; }
    if (!isSupabaseConfigured) { setData(null); setStatus('error'); return; }
    setStatus('loading');
    try {
      const res = await api.fetchPrimarySpot(userId);
      if (!res.ok) { setData(null); setStatus('error'); return; }
      setData(res.data);
      setStatus(res.data ? 'ok' : 'empty');
    } catch {
      setData(null);
      setStatus('error');
    }
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);
  return { data, status, loading: status === 'loading', refresh };
}

export function useActiveSpots() {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setSpots([]);
      setStatus('error');
      return;
    }
    setStatus('loading');
    const res = await api.fetchSpots();
    if (!res.ok) {
      setSpots([]);
      setStatus('error');
      return;
    }
    setSpots(res.data);
    setStatus(res.data.length > 0 ? 'ok' : 'empty');
  }, [refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spots, status, loading: status === 'loading', refresh };
}

export function useSpot(id: string | null) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!id) { setSpot(null); setStatus('empty'); return; }
    if (__DEV__ && id === DEV_EMPTY_SPOT_ID) {
      setSpot(DEV_EMPTY_SPOT);
      setStatus('ok');
      return;
    }
    if (!isSupabaseConfigured) { setSpot(null); setStatus('error'); return; }
    setStatus('loading');
    const res = await api.fetchSpot(id);
    if (!res.ok) {
      setSpot(null);
      setStatus(res.code === 'not_found' ? 'empty' : 'error');
      return;
    }
    setSpot(res.data);
    setStatus('ok');
  }, [id, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { spot, status, loading: status === 'loading', refresh };
}

export function useTrails(spotId: string | null) {
  const [trails, setTrails] = useState<Trail[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!spotId) { setTrails([]); setStatus('empty'); return; }
    if (!isSupabaseConfigured) { setTrails([]); setStatus('error'); return; }
    setStatus('loading');
    const res = await api.fetchTrails(spotId);
    if (!res.ok) {
      setTrails([]);
      setStatus('error');
      return;
    }
    setTrails(res.data);
    setStatus(res.data.length > 0 ? 'ok' : 'empty');
  }, [spotId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trails, status, loading: status === 'loading', refresh };
}

export function useTrail(id: string | null) {
  const [trail, setTrail] = useState<Trail | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (!id) { setTrail(null); setStatus('empty'); return; }
    if (!isSupabaseConfigured) { setTrail(null); setStatus('error'); return; }
    setStatus('loading');
    const res = await api.fetchTrail(id);
    if (!res.ok) {
      setTrail(null);
      setStatus(res.code === 'not_found' ? 'empty' : 'error');
      return;
    }
    setTrail(res.data);
    setStatus('ok');
  }, [id, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { trail, status, loading: status === 'loading', refresh };
}

// ══════════════════════════════════════════════════════════
// PIONEER TRAIL FLOW (Sprint 3)
// ══════════════════════════════════════════════════════════

/**
 * Imperative create-trail wrapper.
 * Returns the raw ApiResult so the caller (e.g. /trail/new screen)
 * can decide how to surface error copy — the Polish message is
 * already populated by api.createTrail. On success, triggers a
 * global refresh so useTrails / useSpot across the app re-query.
 *
 * No finalizePioneerRun hook — that call happens inline inside the
 * recording flow where the UI needs fine-grained error handling
 * (weak-signal retry, already-pioneered messaging). See Sprint 3 §2.
 */
export function useCreateTrail() {
  const submit = useCallback(async (params: api.CreateTrailParams) => {
    const result = await api.createTrail(params);
    if (result.ok) {
      triggerRefresh();
    }
    return result;
  }, []);

  return { submit };
}

/**
 * Fetch the raw geometry jsonb for a single trail. Kept separate from
 * useTrail so list screens / headers don't pay the payload cost. Used
 * by the run screen to rehydrate gate corridors from Pioneer line.
 */
export function useTrailGeometry(trailId: string | null) {
  const [geometry, setGeometry] = useState<unknown>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  useEffect(() => {
    let cancelled = false;
    if (!trailId) {
      setGeometry(null);
      setStatus('empty');
      return;
    }
    setStatus('loading');
    (async () => {
      const result = await api.fetchTrailGeometry(trailId);
      if (cancelled) return;
      if (result.ok) {
        setGeometry(result.data);
        setStatus(result.data ? 'ok' : 'empty');
      } else {
        setGeometry(null);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [trailId, refreshSignal]);

  return { geometry, status, loading: status === 'loading' };
}

/**
 * Fetch a single run by id. Used by the Pioneer result screen which
 * navigates in with a runId (not a runSessionId) and needs durationMs /
 * trail_id for the celebration hero.
 */
export function useRun(runId: string | null) {
  const [run, setRun] = useState<import('@/lib/database.types').DbRun | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  useEffect(() => {
    let cancelled = false;
    if (!runId) {
      setRun(null);
      setStatus('empty');
      return;
    }
    setStatus('loading');
    (async () => {
      const result = await api.fetchRun(runId);
      if (cancelled) return;
      if (result.ok) {
        setRun(result.data);
        setStatus('ok');
      } else {
        setRun(null);
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [runId, refreshSignal]);

  return { run, status, loading: status === 'loading' };
}

/**
 * Curator cleanup — delete a spot and all its trails/runs/leaderboards
 * (migration 009 cascade). Server-side gated by profiles.role; the hook
 * does not pre-check — we trust the RPC and surface its error codes.
 */
export function useDeleteSpot() {
  const submit = useCallback(async (spotId: string) => {
    const result = await api.deleteSpot(spotId);
    if (result.ok) triggerRefresh();
    return result;
  }, []);
  return { submit };
}

export function useDeleteTrail() {
  const submit = useCallback(async (trailId: string) => {
    const result = await api.deleteTrail(trailId);
    if (result.ok) triggerRefresh();
    return result;
  }, []);
  return { submit };
}
