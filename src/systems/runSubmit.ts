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
import { SubmitRunResult, incrementChallengeProgress, unlockAchievement, fetchActiveChallenges } from '@/lib/api';
import { XP_TABLE } from './xp';
import { triggerRefresh } from '@/hooks/useRefresh';
import { updateFinalizedRun } from './runStore';
import { logDebugEvent } from './debugEvents';
import { shouldSimSaveFail, getSimSaveDelay } from './testMode';

export type BackendSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'offline';

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
  trace: RunTrace;
  verification: VerificationResult;
  qualityTier?: QualityTier;
}): Promise<SubmitRunResult | null> {
  const { sessionId, userId, trailId, trace, verification, qualityTier } = params;

  // Guard: userId must be non-empty
  if (!userId || userId.length === 0) {
    logDebugEvent('save', 'submit_skip_no_user', 'fail', { runSessionId: sessionId, trailId });
    return null;
  }

  logDebugEvent('save', 'submit_start', 'start', { runSessionId: sessionId, trailId });

  // Simulation: force save failure
  if (shouldSimSaveFail()) {
    logDebugEvent('save', 'sim_save_fail', 'fail', { runSessionId: sessionId });
    updateFinalizedRun(sessionId, { saveStatus: 'failed' });
    return null;
  }

  // Simulation: artificial delay
  const simDelay = getSimSaveDelay();
  if (simDelay > 0) {
    logDebugEvent('save', 'sim_delay', 'info', { payload: { delayMs: simDelay } });
    await new Promise((r) => setTimeout(r, simDelay));
  }

  try {
    const xpAwarded = verification.isLeaderboardEligible ? XP_TABLE.validRun : 0;

    const result = await submitRunToBackend({
      userId,
      spotId: 'slotwiny-arena',
      trailId,
      mode: trace.mode,
      startedAt: trace.startedAt,
      finishedAt: trace.finishedAt ?? Date.now(),
      durationMs: trace.durationMs,
      verification,
      trace,
      xpAwarded,
      qualityTier,
    });

    if (result) {
      logDebugEvent('save', 'submit_ok', 'ok', {
        runSessionId: sessionId,
        trailId,
        payload: { isPb: result.isPb, position: result.leaderboardResult?.position },
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
  }
}

/**
 * Post-save progression — challenges + achievements (fire-and-forget).
 */
export async function updateProgression(
  userId: string,
  trailId: string,
  isPb: boolean,
  eligible: boolean,
): Promise<void> {
  try {
    const challenges = await fetchActiveChallenges('slotwiny-arena');
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

    await unlockAchievement(userId, 'first-blood');
  } catch (e) {
    console.warn('[NWD] Progression update failed:', e);
  }
}
