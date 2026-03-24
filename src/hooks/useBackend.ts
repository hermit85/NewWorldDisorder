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
import { LeaderboardEntry, PeriodType, Challenge, User } from '@/data/types';

export function isBackendConfigured(): boolean {
  return isSupabaseConfigured;
}

const DEMO_MODE = !isSupabaseConfigured;

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

    if (DEMO_MODE) {
      const data = mockLeaderboardForTrail(trailId);
      setEntries(data);
      setStatus(data.length > 0 ? 'ok' : 'empty');
      return;
    }

    try {
      const rows = await api.fetchLeaderboard(trailId, periodType, userId);
      setEntries(rows.map(mapLeaderboardRow));
      setStatus(rows.length > 0 ? 'ok' : 'empty');
    } catch (e: any) {
      console.warn('[NWD] Leaderboard fetch failed:', e?.message);
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

  useEffect(() => {
    async function load() {
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
          targetProgress: 3,
        }));
        setChallenges(mapped);
        setStatus(mapped.length > 0 ? 'ok' : 'empty');
      } catch {
        setChallenges([]);
        setStatus('error');
      }
    }
    load();
  }, [spotId, userId]);

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

    try {
      const p = await api.fetchProfile(userId);
      if (p) {
        setProfile({
          id: p.id,
          username: p.display_name || p.username,
          rankId: p.rank_id as any,
          xp: p.xp,
          xpToNextRank: 0,
          totalRuns: p.total_runs,
          totalPbs: p.total_pbs,
          bestPosition: p.best_position ?? 0,
          favoriteTrailId: p.favorite_trail_id ?? '',
          joinedAt: p.created_at,
          achievements: [],
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
