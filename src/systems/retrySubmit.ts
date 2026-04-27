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

import { FinalizedRun, recordSaveAttempt, updateFinalizedRun } from './runStore';
import { submitRunToBackend } from '@/hooks/useBackend';
import { SubmitRunResult, getLastSubmitRunError } from '@/lib/api';
import { calculateRunXp } from './xp';
import { logDebugEvent } from './debugEvents';
import { triggerRefresh } from '@/hooks/useRefresh';

export interface RetryResult {
  success: boolean;
  result: SubmitRunResult | null;
  error?: string;
  /** B23.1: surface the RPC rejection code (from api.submitRun's
   *  _lastSubmitRunError cache). Populated after a null result so
   *  result.tsx can render "Serwer odrzucił: corridor_coverage_low"
   *  instead of an invisible console.warn. */
  errorCode?: string;
  errorDetail?: string;
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

  // Guard: all required data present — spotId must be threaded from
  // when the run was originally finalized; retry never guesses.
  if (!snapshot || !verification || !userId || userId.length === 0 || !run.spotId) {
    logDebugEvent('save', 'retry_skip_no_data', 'info', {
      runSessionId: run.sessionId,
      payload: {
        hasTrace: !!snapshot,
        hasVerification: !!verification,
        hasUserId: !!userId,
        hasSpotId: !!run.spotId,
      },
    });
    // Pin the missing-data outcome on the run so the Sync Outbox can
    // render it as stale instead of showing "Wysyłam…" forever.
    recordSaveAttempt(run.sessionId, {
      success: false,
      error: { code: 'missing_data', detail: 'Brak danych do wysłania', at: Date.now() },
    });
    return { success: false, result: null, error: 'Missing data for retry', errorCode: 'missing_data' };
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

    // Reuse the local reward snapshot when present. Queued runs are
    // created before backend PB/rank context exists, so this is normally
    // base XP; the important part is that retry submits the same value
    // the rider saw locally instead of recalculating a different one.
    const xpCalc = calculateRunXp({
      isEligible: verification.isLeaderboardEligible,
      isPractice: run.mode === 'practice',
      isPb: false, // unknown on retry — backend determines
      position: null,
      previousPosition: null,
    });
    const xpAwarded = run.xpAwarded ?? xpCalc.total;

    const result = await submitRunToBackend({
      userId,
      spotId: run.spotId,
      trailId: run.trailId,
      mode: run.mode,
      startedAt: run.startedAt,
      finishedAt: run.startedAt + run.durationMs,
      durationMs: run.durationMs,
      verification,
      trace: traceForRetry as any,
      xpAwarded,
      qualityTier: run.qualityTier ?? undefined,
    });

    if (result) {
      logDebugEvent('save', 'retry_ok', 'ok', {
        runSessionId: run.sessionId,
        trailId: run.trailId,
        payload: { isPb: result.isPb, position: result.leaderboardResult?.position },
      });
      updateFinalizedRun(run.sessionId, { saveStatus: 'saved', backendResult: result, xpAwarded });
      recordSaveAttempt(run.sessionId, { success: true });
      triggerRefresh();
      return { success: true, result };
    } else {
      const rpcError = getLastSubmitRunError();
      logDebugEvent('save', 'retry_null', 'fail', {
        runSessionId: run.sessionId,
        payload: { errorCode: rpcError?.code, errorDetail: rpcError?.detail },
      });
      updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
      recordSaveAttempt(run.sessionId, {
        success: false,
        error: {
          code: rpcError?.code ?? 'rpc_null',
          detail: rpcError?.detail,
          at: Date.now(),
        },
      });
      return {
        success: false,
        result: null,
        errorCode: rpcError?.code,
        errorDetail: rpcError?.detail,
      };
    }
  } catch (e) {
    logDebugEvent('save', 'retry_error', 'fail', {
      runSessionId: run.sessionId,
      payload: { error: String(e) },
    });
    updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
    recordSaveAttempt(run.sessionId, {
      success: false,
      error: { code: 'exception', detail: String(e), at: Date.now() },
    });
    return {
      success: false,
      result: null,
      error: String(e),
      errorCode: 'exception',
      errorDetail: String(e),
    };
  }
}
