// ═══════════════════════════════════════════════════════════
// useTablicaSections — Stan A data adapter for Tablica Phase 1.
//
// Aggregates rider's runs / spots / trails / per-trail PB+rank
// into per-bike-park sections. Client-side adapter — no migration
// (per Q1.A in cc_prompt_tablica_phase1_final). All queries fan
// out via Promise.all so the round-trip stays parallel.
//
// Sort order: spots by MAX(run.created_at) DESC — most-recently
// ridden park first (rider's mental "what was I just on" wins).
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import {
  fetchSpots,
  fetchTrails,
  fetchUserRuns,
  fetchUserTrailStats,
} from '@/lib/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useRefreshSignal } from './useRefresh';
import type { Spot, Trail } from '@/data/types';

export interface TablicaTrailRow {
  trail: Trail;
  /** Rider's PB on this trail (current trail version). null when no
   *  verified run exists. */
  userPbMs: number | null;
  /** Rider's all_time position on this trail. null when no verified
   *  run / not on the leaderboard. */
  userPosition: number | null;
  /** Rider's run count on this trail (from filtered runs array).
   *  Phase 1 first ship — Phase 2 will swap for trail-wide total. */
  userRunCount: number;
}

export interface TablicaSection {
  spot: Spot;
  trails: TablicaTrailRow[];
  /** Most-recent run timestamp on this spot — drives section order. */
  lastRunAt: string;
}

export type TablicaStatus = 'loading' | 'ok' | 'error' | 'empty';

export function useTablicaSections(userId: string | null | undefined) {
  const [sections, setSections] = useState<TablicaSection[]>([]);
  const [status, setStatus] = useState<TablicaStatus>('loading');
  const refreshSignal = useRefreshSignal();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setSections([]);
        setStatus('empty');
        return;
      }
      if (!isSupabaseConfigured) {
        setSections([]);
        setStatus('error');
        return;
      }

      setStatus('loading');

      try {
        // Three queries in parallel — runs for grouping, stats for
        // PB/position per trail, all-spots for spot metadata. Total
        // round-trip = max(t1, t2, t3) instead of t1+t2+t3.
        const [runs, statsMap, spotsResult] = await Promise.all([
          fetchUserRuns(userId, 200),
          fetchUserTrailStats(userId),
          fetchSpots(),
        ]);

        if (cancelled) return;

        if (runs.length === 0) {
          setSections([]);
          setStatus('empty');
          return;
        }

        // Group user runs by spot — derive each spot's lastRunAt
        // from the most-recent run timestamp on that spot. DbRun
        // is the raw DB row shape (snake_case) — fetchUserRuns
        // returns these without normalization.
        const runsBySpot = new Map<string, typeof runs>();
        for (const run of runs) {
          if (!run.spot_id) continue;
          const list = runsBySpot.get(run.spot_id) ?? [];
          list.push(run);
          runsBySpot.set(run.spot_id, list);
        }

        const userSpotIds = Array.from(runsBySpot.keys());
        const allSpots = spotsResult.ok ? spotsResult.data : [];
        const spotsById = new Map(allSpots.map((s) => [s.id, s]));

        // Fetch trails for each user-spot in parallel.
        const trailResults = await Promise.all(
          userSpotIds.map((spotId) => fetchTrails(spotId)),
        );
        if (cancelled) return;

        const sectionsBuild: TablicaSection[] = [];
        for (let i = 0; i < userSpotIds.length; i++) {
          const spotId = userSpotIds[i];
          const spot = spotsById.get(spotId);
          if (!spot) continue; // orphan spot — handled in commit 4 (separate "INNE TRASY" section)

          const trailResult = trailResults[i];
          const trails = trailResult.ok ? trailResult.data : [];

          const spotRuns = runsBySpot.get(spotId) ?? [];
          const lastRunAt = spotRuns
            .map((r) => r.created_at ?? '')
            .reduce((max, ts) => (ts > max ? ts : max), '');

          // Per-trail rows. Order trails as they come from fetchTrails
          // (already deterministic per spot).
          const trailRows: TablicaTrailRow[] = trails.map((trail) => {
            const userRunCount = spotRuns.filter((r) => r.trail_id === trail.id).length;
            const stats = statsMap.get(trail.id);
            return {
              trail,
              userPbMs: stats?.pbMs ?? null,
              userPosition: stats?.position ?? null,
              userRunCount,
            };
          });

          sectionsBuild.push({ spot, trails: trailRows, lastRunAt });
        }

        // Sort by lastRunAt DESC — most-recently ridden first.
        sectionsBuild.sort((a, b) => b.lastRunAt.localeCompare(a.lastRunAt));

        setSections(sectionsBuild);
        setStatus(sectionsBuild.length > 0 ? 'ok' : 'empty');
      } catch (err) {
        if (cancelled) return;
        setSections([]);
        setStatus('error');
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshSignal]);

  return { sections, status };
}
