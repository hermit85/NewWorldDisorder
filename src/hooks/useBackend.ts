// ═══════════════════════════════════════════════════════════
// useBackend — bridge between Supabase and mock data
// Falls back to mock data when Supabase is not configured
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import * as api from '@/lib/api';
import { LeaderboardRow } from '@/lib/api';

// Mock fallback imports
import { mockLeaderboard } from '@/data/mock/leaderboard';
import { mockTrails } from '@/data/mock/trails';
import { mockChallenges } from '@/data/mock/challenges';
import { mockUser } from '@/data/mock/user';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { LeaderboardEntry, PeriodType, Challenge, User, Trail } from '@/data/types';

/** Returns true if Supabase env vars are configured */
export function isBackendConfigured(): boolean {
  return isSupabaseConfigured;
}

// ── Leaderboard hook ──

export function useLeaderboard(trailId: string, periodType: PeriodType = 'all_time', userId?: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);

    if (isBackendConfigured() && userId) {
      try {
        const rows = await api.fetchLeaderboard(trailId, periodType, userId);
        setEntries(rows.map(mapLeaderboardRow));
      } catch (e) {
        console.warn('[NWD] Leaderboard fetch failed, using mock', e);
        setEntries(mockLeaderboardForTrail(trailId));
      }
    } else {
      setEntries(mockLeaderboardForTrail(trailId));
    }

    setLoading(false);
  }, [trailId, periodType, userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { entries, loading, refresh };
}

// ── Trail stats hook ──

export function useUserTrailStats(userId?: string) {
  const [stats, setStats] = useState<Map<string, { pbMs: number | null; position: number | null }>>(new Map());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (isBackendConfigured() && userId) {
      try {
        const map = await api.fetchUserTrailStats(userId);
        setStats(map);
      } catch (e) {
        console.warn('[NWD] Trail stats fetch failed, using mock');
        setStats(buildMockTrailStats());
      }
    } else {
      setStats(buildMockTrailStats());
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { stats, loading, refresh };
}

// ── Challenges hook ──

export function useChallenges(spotId: string, userId?: string) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (isBackendConfigured()) {
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
            targetProgress: 3, // default target, could be stored in challenge metadata
          })));
        } catch {
          setChallenges(mockChallenges);
        }
      } else {
        setChallenges(mockChallenges);
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

  const refresh = useCallback(async () => {
    if (isBackendConfigured() && userId) {
      try {
        const p = await api.fetchProfile(userId);
        if (p) {
          setProfile({
            id: p.id,
            username: p.display_name || p.username,
            rankId: p.rank_id as any,
            xp: p.xp,
            xpToNextRank: 0, // computed client-side
            totalRuns: p.total_runs,
            totalPbs: p.total_pbs,
            bestPosition: p.best_position ?? 0,
            favoriteTrailId: p.favorite_trail_id ?? '',
            joinedAt: p.created_at,
            achievements: [],
          });
        }
      } catch {
        setProfile(mockUser);
      }
    } else {
      setProfile(mockUser);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { profile, loading, refresh };
}

// ── Run submission ──

export async function submitRunToBackend(params: api.SubmitRunParams): Promise<api.SubmitRunResult | null> {
  if (!isBackendConfigured()) {
    console.log('[NWD] Backend not configured, run saved locally only');
    return null;
  }

  return api.submitRun(params);
}

// ═══════════════════════════════════════════════════════════
// Mock data mappers (fallback when no Supabase)
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
    gapToNext: 0, // computed on display
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
