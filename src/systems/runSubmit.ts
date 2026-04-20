// ═══════════════════════════════════════════════════════════
// Run Submit — backend save + progression + retry
//
// RESPONSIBILITY:
// - Submit run result to backend
// - Handle save failure → queue for retry
// - Fire-and-forget progression (challenges, achievements)
// - Simulation hooks for testing
//
// DOES NOT: verify, assess quality, manage GPS, manage UI state
// ═══════════════════════════════════════════════════════════

import { RunTrace } from './traceCapture';
import { VerificationResult } from '@/data/verificationTypes';
import { submitRunToBackend, isBackendConfigured } from '@/hooks/useBackend';
import { SubmitRunResult, incrementChallengeProgress, unlockAchievement, fetchActiveChallenges, updateProfileXp, fetchProfile } from '@/lib/api';
import { calculateRunXp, type XpBreakdown } from './xp';
import { DEFAULT_SPOT_ID } from '@/constants';
import { getVenueForTrail } from '@/data/venueConfig';
import { triggerRefresh } from '@/hooks/useRefresh';
import { updateFinalizedRun } from './runStore';
import { logDebugEvent } from './debugEvents';
import { shouldSimSaveFail, getSimSaveDelay } from './testMode';

export type BackendSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'offline';

const SUBMIT_TIMEOUT_MS = 30_000;
const _submittingSessionIds = new Set<string>();

const ACHIEVEMENT_IDS = {
  firstBlood: 'ach-first-blood',
  top10Entry: 'ach-top-10',
  slotwinyLocal: 'ach-slotwiny-local',
  gravityAddict: 'ach-gravity-addict',
} as const;

/**
 * Determine initial save status based on backend + user availability.
 * Returns BackendSaveStatus for hook state and SaveStatus-compatible for runStore.
 */
export function getInitialSaveStatus(userId?: string): BackendSaveStatus {
  return isBackendConfigured() && userId ? 'saving' : 'offline';
}

/**
 * Map BackendSaveStatus to runStore's SaveStatus type.
 * 'idle' maps to 'pending' (not yet attempted).
 */
export function toSaveStatus(status: BackendSaveStatus): 'pending' | 'saving' | 'saved' | 'failed' | 'offline' | 'queued' {
  return status === 'idle' ? 'pending' : status;
}

/**
 * Submit a finalized run to the backend.
 * Returns the result or null on failure. Updates runStore on success/failure.
 */
/** Quality tier type — matches gate engine output */
export type QualityTier = 'perfect' | 'valid' | 'rough';

export async function submitRun(params: {
  sessionId: string;
  userId: string;
  trailId: string;
  /** Parent spot id — threaded from the UI via useRealRun / FinalizedRun.
   *  Must be non-empty; no silent fallback to a default spot any more. */
  spotId: string;
  trace: RunTrace;
  verification: VerificationResult;
  qualityTier?: QualityTier;
}): Promise<SubmitRunResult | null> {
  const { sessionId, userId, trailId, spotId, trace, verification, qualityTier } = params;

  // Guard: userId must be non-empty
  if (!userId || userId.length === 0) {
    logDebugEvent('save', 'submit_skip_no_user', 'fail', { runSessionId: sessionId, trailId });
    return null;
  }

  // Guard: spotId must be resolved. Explicit failure beats a stale FK.
  if (!spotId || spotId.length === 0) {
    logDebugEvent('save', 'submit_skip_no_spot', 'fail', { runSessionId: sessionId, trailId });
    throw new Error('spot_id missing on finalized run');
  }

  // Guard: double-tap prevention — skip if already submitting this session
  if (_submittingSessionIds.has(sessionId)) {
    logDebugEvent('save', 'submit_skip_duplicate', 'info', { runSessionId: sessionId });
    return null;
  }
  _submittingSessionIds.add(sessionId);

  logDebugEvent('save', 'submit_start', 'start', { runSessionId: sessionId, trailId });

  // Simulation: force save failure
  if (shouldSimSaveFail()) {
    logDebugEvent('save', 'sim_save_fail', 'fail', { runSessionId: sessionId });
    updateFinalizedRun(sessionId, { saveStatus: 'failed' });
    _submittingSessionIds.delete(sessionId);
    return null;
  }

  // Simulation: artificial delay
  const simDelay = getSimSaveDelay();
  if (simDelay > 0) {
    logDebugEvent('save', 'sim_delay', 'info', { payload: { delayMs: simDelay } });
    await new Promise((r) => setTimeout(r, simDelay));
  }

  try {
    // Calculate real XP based on run outcome (not hardcoded)
    // Note: position bonuses require the result, so we do two passes:
    // 1. Submit with base XP
    // 2. After result, award bonus XP if position improved
    const baseXp = calculateRunXp({
      isEligible: verification.isLeaderboardEligible,
      isPractice: trace.mode === 'practice',
      isPb: false, // don't know yet — backend determines this
      position: null,
      previousPosition: null,
    });

    // Submit with timeout protection
    const submitPromise = submitRunToBackend({
      userId,
      spotId,
      trailId,
      mode: trace.mode,
      startedAt: trace.startedAt,
      finishedAt: trace.finishedAt ?? Date.now(),
      durationMs: trace.durationMs,
      verification,
      trace,
      xpAwarded: baseXp.total,
      qualityTier,
    });
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), SUBMIT_TIMEOUT_MS),
    );
    const result = await Promise.race([submitPromise, timeoutPromise]);

    if (result) {
      // Calculate bonus XP now that we know PB + position
      const fullXp = calculateRunXp({
        isEligible: verification.isLeaderboardEligible,
        isPractice: trace.mode === 'practice',
        isPb: result.isPb,
        position: result.leaderboardResult?.position ?? null,
        previousPosition: result.leaderboardResult?.previousPosition ?? null,
      });

      // Award bonus XP difference if any (atomic via RPC)
      const bonusXp = fullXp.total - baseXp.total;
      if (bonusXp > 0) {
        const xpResult = await updateProfileXp(userId, bonusXp);
        if (!xpResult) {
          logDebugEvent('save', 'bonus_xp_fail', 'warn', {
            runSessionId: sessionId,
            payload: { bonusXp, reasons: fullXp.reasons },
          });
        }
      }

      logDebugEvent('save', 'submit_ok', 'ok', {
        runSessionId: sessionId,
        trailId,
        payload: {
          isPb: result.isPb,
          position: result.leaderboardResult?.position,
          xpBase: baseXp.total,
          xpBonus: bonusXp,
          xpTotal: fullXp.total,
          xpReasons: fullXp.reasons,
        },
      });
      updateFinalizedRun(sessionId, { saveStatus: 'saved', backendResult: result });
      triggerRefresh();
      return result;
    } else {
      logDebugEvent('save', 'submit_null', 'fail', { runSessionId: sessionId, trailId });
      updateFinalizedRun(sessionId, { saveStatus: 'queued' });
      return null;
    }
  } catch (e) {
    logDebugEvent('save', 'submit_error', 'fail', {
      runSessionId: sessionId,
      trailId,
      payload: { error: String(e) },
    });
    updateFinalizedRun(sessionId, { saveStatus: 'queued' });
    return null;
  } finally {
    _submittingSessionIds.delete(sessionId);
  }
}

/**
 * Post-save progression — challenges + achievements (fire-and-forget).
 */
export async function updateProgression(
  userId: string,
  trailId: string,
  spotId: string,
  isPb: boolean,
  eligible: boolean,
  position?: number | null,
  totalRuns?: number,
): Promise<void> {
  try {
    let effectiveTotalRuns = totalRuns ?? null;
    if (effectiveTotalRuns == null) {
      const profile = await fetchProfile(userId);
      effectiveTotalRuns = profile?.total_runs ?? null;
    }

    // ── Challenges ──
    // spotId already resolved at submit entry; reuse it for challenge scoping.
    const challenges = await fetchActiveChallenges(spotId);
    const now = new Date();

    for (const ch of challenges) {
      if (ch.ends_at && new Date(ch.ends_at) < now) continue;
      if (ch.starts_at && new Date(ch.starts_at) > now) continue;

      if (ch.type === 'run_count' && eligible) {
        await incrementChallengeProgress(userId, ch.id, 1);
      }
      if (ch.type === 'pb_improvement' && isPb) {
        await incrementChallengeProgress(userId, ch.id, 1);
      }
      if (ch.type === 'fastest_time' && ch.trail_id === trailId && eligible && isPb) {
        await incrementChallengeProgress(userId, ch.id, 1);
      }
    }

    // ── Achievements (fire-and-forget, idempotent) ──
    // First Blood — always fire (upsert is safe)
    await unlockAchievement(userId, ACHIEVEMENT_IDS.firstBlood);

    // Top 10 Entry — if rider entered top 10 on this run
    if (position != null && position <= 10) {
      await unlockAchievement(userId, ACHIEVEMENT_IDS.top10Entry);
    }

    // Słotwiny Local — 20+ total runs (global count, not venue-filtered yet)
    // TODO: filter by venue-specific run count when backend supports per-venue aggregation
    if (effectiveTotalRuns != null && effectiveTotalRuns >= 20) {
      await unlockAchievement(userId, ACHIEVEMENT_IDS.slotwinyLocal);
    }

    // Gravity Addict — 50+ total runs
    if (effectiveTotalRuns != null && effectiveTotalRuns >= 50) {
      await unlockAchievement(userId, ACHIEVEMENT_IDS.gravityAddict);
    }
  } catch (e) {
    console.warn('[NWD] Progression update failed:', e);
  }
}
