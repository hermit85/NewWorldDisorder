// ═══════════════════════════════════════════════════════════
// useBackend — typed result states: loading / data / error / signed-out
// NEVER collapses backend failure into fake empty state.
// Mock data ONLY when Supabase is not configured (DEMO_MODE).
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as api from '@/lib/api';
import { LeaderboardRow } from '@/lib/api';
import { useRefreshSignal } from './useRefresh';

// Mock fallback — ONLY in DEMO_MODE
import { mockLeaderboard } from '@/data/mock/leaderboard';
import { mockTrails } from '@/data/mock/trails';
import { mockChallenges } from '@/data/mock/challenges';
import { mockUser } from '@/data/mock/user';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { LeaderboardEntry, PeriodType, Challenge, User, Achievement } from '@/data/types';

import { logDebugEvent } from '@/systems/debugEvents';
import { shouldSimFetchFail, shouldSimFetchEmpty } from '@/systems/testMode';

export function isBackendConfigured(): boolean {
  return isSupabaseConfigured;
}

/** True when production build has no backend — app should show blocking error */
export const isProductionMisconfigured = !isSupabaseConfigured && !__DEV__;

// DEMO_MODE: only in dev. Production without env vars = hard fail, not mock league.
const DEMO_MODE = !isSupabaseConfigured && __DEV__;

// ── Typed fetch status ──
export type FetchStatus = 'loading' | 'ok' | 'empty' | 'error' | 'signed_out';

// ══════════════════════════════════════════════════════════
// LEADERBOARD
// ══════════════════════════════════════════════════════════

export function useLeaderboard(trailId: string, periodType: PeriodType = 'all_time', userId?: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    logDebugEvent('fetch', 'leaderboard_start', 'start', { trailId, payload: { periodType } });

    if (DEMO_MODE) {
      const data = mockLeaderboardForTrail(trailId);
      setEntries(data);
      setStatus(data.length > 0 ? 'ok' : 'empty');
      return;
    }

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
    if (DEMO_MODE) {
      setStats(buildMockTrailStats());
      setStatus('ok');
      return;
    }

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
    if (DEMO_MODE) {
      setChallenges(mockChallenges);
      setStatus('ok');
      return;
    }

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
// PROFILE
// ══════════════════════════════════════════════════════════

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<User | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    logDebugEvent('fetch', 'profile_start', 'start', { sessionId: userId });

    if (DEMO_MODE) {
      setProfile(mockUser);
      setStatus('ok');
      return;
    }

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

export function useLeagueMovement(userId?: string, venueActivity?: VenueActivity | null) {
  const [signals, setSignals] = useState<LeagueSignal[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (DEMO_MODE || !userId) {
      setSignals([]);
      setStatus(userId ? 'empty' : 'signed_out');
      return;
    }

    try {
      const trailIds = mockTrails.map(t => t.id);
      const boardData = await api.fetchRiderBoardContext(userId, trailIds);

      const trailNames: Record<string, string> = {};
      for (const t of mockTrails) trailNames[t.id] = t.name;

      const riderBoards: RiderBoardContext[] = boardData.map(b => ({
        ...b,
        trailName: trailNames[b.trailId] ?? b.trailId,
      }));

      // Resolve venue name from registry instead of hardcoding
      const _venueMatch = venueActivity ? (() => {
        const { getVenue, getAllVenues } = require('@/data/venues');
        // Try to find which venue this activity belongs to by hotTrailId
        if (venueActivity.hotTrailId) {
          const { getVenueForTrail } = require('@/data/venueConfig');
          const match = getVenueForTrail(venueActivity.hotTrailId);
          if (match) return { id: match.venueId, name: match.venue.name };
        }
        // Fallback: first venue
        const all = getAllVenues();
        return all.length > 0 ? { id: all[0].id, name: all[0].name } : { id: 'unknown', name: 'Arena' };
      })() : null;

      const venueCtx: VenueActivityContext | null = venueActivity && _venueMatch ? {
        venueId: _venueMatch.id,
        venueName: _venueMatch.name,
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
  }, [userId, venueActivity, refreshSignal]);

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
    if (!userId || !trailId || !saved || DEMO_MODE) {
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

    if (DEMO_MODE) {
      setActivity(null);
      setStatus('empty');
      return;
    }

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
    if (DEMO_MODE) {
      // Demo mode: no fake achievements — show empty
      setAchievements([]);
      setStatus('empty');
      return;
    }

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
  if (DEMO_MODE) {
    console.log('[NWD] Demo mode — run saved locally only');
    return null;
  }
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
    if (DEMO_MODE) {
      setSpots([]);
      setStatus('empty');
      return;
    }
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
    if (DEMO_MODE) {
      setSpots([]);
      setStatus('empty');
      return;
    }
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

// ══════════════════════════════════════════════════════════
// Mock mappers — DEMO_MODE only
// ══════════════════════════════════════════════════════════

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

function mockLeaderboardForTrail(trailId: string): LeaderboardEntry[] {
  return mockLeaderboard
    .filter(e => e.trailId === trailId || trailId === 'all')
    .sort((a, b) => a.currentPosition - b.currentPosition);
}

function buildMockTrailStats(): Map<string, { pbMs: number | null; position: number | null }> {
  const map = new Map();
  for (const trail of mockTrails) {
    const stats = getUserTrailStats(trail.id);
    if (stats) map.set(trail.id, { pbMs: stats.pbMs, position: stats.position });
  }
  return map;
}
