// ═══════════════════════════════════════════════════════════
// useBackend — bridge between Supabase and mock data
// Uses REAL backend when configured. Mock ONLY for dev/demo.
// When backend is live, empty data = real empty, not fake.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as api from '@/lib/api';
import { LeaderboardRow } from '@/lib/api';
import { useRefreshSignal } from './useRefresh';

// Mock fallback imports — ONLY used when Supabase is NOT configured
import { mockLeaderboard } from '@/data/mock/leaderboard';
import { mockTrails } from '@/data/mock/trails';
import { mockChallenges } from '@/data/mock/challenges';
import { mockUser } from '@/data/mock/user';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { LeaderboardEntry, PeriodType, Challenge, User } from '@/data/types';

/** Returns true if Supabase env vars are configured */
export function isBackendConfigured(): boolean {
  return isSupabaseConfigured;
}

// Demo mode = Supabase not configured, use mock data
const DEMO_MODE = !isSupabaseConfigured;

// ── Leaderboard hook ──

export function useLeaderboard(trailId: string, periodType: PeriodType = 'all_time', userId?: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (DEMO_MODE) {
      setEntries(mockLeaderboardForTrail(trailId));
      setLoading(false);
      return;
    }

    try {
      const rows = await api.fetchLeaderboard(trailId, periodType, userId);
      // Real backend: empty = really empty. No fake fill.
      setEntries(rows.map(mapLeaderboardRow));
    } catch (e: any) {
      console.warn('[NWD] Leaderboard fetch failed:', e?.message);
      setError('Could not load leaderboard');
      setEntries([]);
    }

    setLoading(false);
  }, [trailId, periodType, userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, error, refresh };
}

// ── Trail stats hook ──

export function useUserTrailStats(userId?: string) {
  const [stats, setStats] = useState<Map<string, { pbMs: number | null; position: number | null }>>(new Map());
  const [loading, setLoading] = useState(true);
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (DEMO_MODE) {
      setStats(buildMockTrailStats());
      setLoading(false);
      return;
    }

    if (!userId) {
      setStats(new Map());
      setLoading(false);
      return;
    }

    try {
      const map = await api.fetchUserTrailStats(userId);
      setStats(map);
    } catch (e) {
      console.warn('[NWD] Trail stats fetch failed');
      setStats(new Map());
    }
    setLoading(false);
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}

// ── Challenges hook ──

export function useChallenges(spotId: string, userId?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (DEMO_MODE) {
        setChallenges(mockChallenges);
        setLoading(false);
        return;
      }

      try {
        const data = await api.fetchActiveChallenges(spotId);
        const progressMap = userId
          ? await api.fetchChallengeProgress(userId, data.map(c => c.id))
          : new Map();

        setChallenges(data.map(c => ({
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
        })));
      } catch {
        setChallenges([]);
      }
      setLoading(false);
    }
    load();
  }, [spotId, userId]);

  return { challenges, loading };
}

// ── User profile hook ──

export function useProfile(userId?: string) {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshSignal = useRefreshSignal();

  const refresh = useCallback(async () => {
    if (DEMO_MODE) {
      setProfile(mockUser);
      setLoading(false);
      return;
    }

    if (!userId) {
      setProfile(null);
      setLoading(false);
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
      } else {
        setProfile(null);
      }
    } catch {
      setProfile(null);
    }
    setLoading(false);
  }, [userId, refreshSignal]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}

// ── Run submission ──

export async function submitRunToBackend(params: api.SubmitRunParams): Promise<api.SubmitRunResult | null> {
  if (DEMO_MODE) {
    console.log('[NWD] Demo mode — run saved locally only');
    return null;
  }

  return api.submitRun(params);
}

// ═══════════════════════════════════════════════════════════
// Mock data mappers — ONLY used in DEMO_MODE
// ═══════════════════════════════════════════════════════════

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
    if (stats) {
      map.set(trail.id, { pbMs: stats.pbMs, position: stats.position });
    }
  }
  return map;
}
