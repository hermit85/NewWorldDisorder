// ═══════════════════════════════════════════════════════════
// Canonical Retry Submit — single path for all retry scenarios
//
// Used by:
// - saveQueue.ts (automatic offline retry)
// - result.tsx (manual retry from result screen)
//
// Ensures consistent:
// - Trace reconstruction from snapshot
// - XP calculation
// - Backend submission payload
// - Status updates
// ═══════════════════════════════════════════════════════════

import { FinalizedRun, updateFinalizedRun } from './runStore';
import { submitRunToBackend } from '@/hooks/useBackend';
import { SubmitRunResult } from '@/lib/api';
import { calculateRunXp } from './xp';
import { logDebugEvent } from './debugEvents';
import { triggerRefresh } from '@/hooks/useRefresh';
import { DEFAULT_SPOT_ID } from '@/constants';

export interface RetryResult {
  success: boolean;
  result: SubmitRunResult | null;
  error?: string;
}

/**
 * Canonical retry submit for a finalized run.
 * Validates inputs, reconstructs trace, submits to backend,
 * updates runStore status.
 *
 * Call this from saveQueue (automatic) or result screen (manual).
 */
export async function retryRunSubmit(run: FinalizedRun): Promise<RetryResult> {
  const userId = run.userId;
  const snapshot = run.traceSnapshot;
  const verification = run.verification;

  // Guard: all required data present
  if (!snapshot || !verification || !userId || userId.length === 0) {
    logDebugEvent('save', 'retry_skip_no_data', 'info', {
      runSessionId: run.sessionId,
      payload: {
        hasTrace: !!snapshot,
        hasVerification: !!verification,
        hasUserId: !!userId,
      },
    });
    return { success: false, result: null, error: 'Missing data for retry' };
  }

  // Mark as saving
  updateFinalizedRun(run.sessionId, { saveStatus: 'saving' });

  try {
    // Reconstruct trace from snapshot.
    // TraceSnapshot stores sampled points in compact format (lat/lng/alt/ts).
    // Backend expects GpsPoint shape, so we fill speed/accuracy with null.
    const traceForRetry = {
      points: snapshot.sampledPoints.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
        altitude: p.alt,
        timestamp: p.ts,
        speed: null,
        accuracy: null,
      })),
      startedAt: snapshot.startedAt,
      finishedAt: snapshot.finishedAt,
      durationMs: snapshot.durationMs,
      mode: snapshot.mode,
    };

    // Calculate XP using same logic as initial submit
    const xpCalc = calculateRunXp({
      isEligible: verification.isLeaderboardEligible,
      isPractice: run.mode === 'practice',
      isPb: false, // unknown on retry — backend determines
      position: null,
      previousPosition: null,
    });

    const result = await submitRunToBackend({
      userId,
      spotId: DEFAULT_SPOT_ID,
      trailId: run.trailId,
      mode: run.mode,
      startedAt: run.startedAt,
      finishedAt: run.startedAt + run.durationMs,
      durationMs: run.durationMs,
      verification,
      trace: traceForRetry as any,
      xpAwarded: xpCalc.total,
      qualityTier: run.qualityTier ?? undefined,
    });

    if (result) {
      logDebugEvent('save', 'retry_ok', 'ok', {
        runSessionId: run.sessionId,
        trailId: run.trailId,
        payload: { isPb: result.isPb, position: result.leaderboardResult?.position },
      });
      updateFinalizedRun(run.sessionId, { saveStatus: 'saved', backendResult: result });
      triggerRefresh();
      return { success: true, result };
    } else {
      logDebugEvent('save', 'retry_null', 'fail', { runSessionId: run.sessionId });
      updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
      return { success: false, result: null };
    }
  } catch (e) {
    logDebugEvent('save', 'retry_error', 'fail', {
      runSessionId: run.sessionId,
      payload: { error: String(e) },
    });
    updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
    return { success: false, result: null, error: String(e) };
  }
}
