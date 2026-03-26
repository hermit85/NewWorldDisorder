// ═══════════════════════════════════════════════════════════
// Save Queue — offline-safe run submission
//
// Retries failed saves automatically on:
// - App launch (after hydration)
// - Network restore (AppState 'active')
// - Manual trigger
//
// Persisted via runStore (AsyncStorage-backed).
// No heavy sync engine. Just a simple retry loop.
// ═══════════════════════════════════════════════════════════

import { AppState, AppStateStatus } from 'react-native';
import {
  getRunsByStatus,
  updateFinalizedRun,
  FinalizedRun,
  getPendingSaveCount,
} from './runStore';
import { submitRunToBackend, isBackendConfigured } from '@/hooks/useBackend';
import { XP_TABLE } from './xp';
import { logDebugEvent } from './debugEvents';
import { triggerRefresh } from '@/hooks/useRefresh';

// ── State ──

let _retrying = false;
let _appStateListener: { remove: () => void } | null = null;
let _lastRetryAt = 0;
const RETRY_COOLDOWN_MS = 30_000; // don't retry more than once per 30s

// ── Public API ──

/** Initialize save queue — call once at app start after hydrateRunStore */
export function initSaveQueue(): void {
  // Listen for app returning to foreground
  if (!_appStateListener) {
    _appStateListener = AppState.addEventListener('change', handleAppStateChange);
  }

  // Attempt immediate flush
  flushSaveQueue();
}

/** Manually trigger retry of all queued/failed saves */
export async function flushSaveQueue(): Promise<{ retried: number; succeeded: number }> {
  if (_retrying) return { retried: 0, succeeded: 0 };
  if (!isBackendConfigured()) return { retried: 0, succeeded: 0 };

  const now = Date.now();
  if (now - _lastRetryAt < RETRY_COOLDOWN_MS) return { retried: 0, succeeded: 0 };

  _retrying = true;
  _lastRetryAt = now;

  const queued = [
    ...getRunsByStatus('queued'),
    ...getRunsByStatus('failed'),
  ];

  if (queued.length === 0) {
    _retrying = false;
    return { retried: 0, succeeded: 0 };
  }

  logDebugEvent('queue', 'flush_start', 'start', {
    payload: { count: queued.length },
  });

  let succeeded = 0;

  for (const run of queued) {
    const ok = await retrySubmit(run);
    if (ok) succeeded++;
  }

  if (succeeded > 0) {
    triggerRefresh();
  }

  logDebugEvent('queue', 'flush_done', succeeded > 0 ? 'ok' : 'info', {
    payload: { retried: queued.length, succeeded },
  });

  _retrying = false;
  return { retried: queued.length, succeeded };
}

/** Get current queue status for debug visibility */
export function getSaveQueueStatus(): {
  pending: number;
  isRetrying: boolean;
  lastRetryAt: number;
} {
  return {
    pending: getPendingSaveCount(),
    isRetrying: _retrying,
    lastRetryAt: _lastRetryAt,
  };
}

// ── Internal ──

function handleAppStateChange(state: AppStateStatus): void {
  if (state === 'active') {
    // App came to foreground — try flushing queue
    flushSaveQueue();
  }
}

async function retrySubmit(run: FinalizedRun): Promise<boolean> {
  // Guard: all three are required for retry. Explicit null/empty checks.
  const userId = run.userId;
  const snapshot = run.traceSnapshot;
  const verification = run.verification;

  if (!snapshot || !verification || !userId || userId.length === 0) {
    logDebugEvent('queue', 'retry_skip_no_data', 'info', {
      runSessionId: run.sessionId,
      payload: {
        hasTrace: !!snapshot,
        hasVerification: !!verification,
        hasUserId: !!userId,
        userIdEmpty: userId === '',
      },
    });
    return false;
  }

  // Mark as saving
  updateFinalizedRun(run.sessionId, { saveStatus: 'saving' });

  try {
    // Reconstruct trace from snapshot for backend submission.
    // TraceSnapshot stores sampled points in compact format (lat/lng/alt/ts).
    // Backend expects full GpsPoint shape, so we fill speed/accuracy with null.
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

    const xpAwarded = verification.isLeaderboardEligible ? XP_TABLE.validRun : 0;

    // NOTE: `trace: traceForRetry as any` — the reconstructed trace lacks
    // full RunTrace type compliance (no trailId, trailName fields).
    // Backend submitRunToBackend only reads .points, .startedAt, .finishedAt,
    // .durationMs, .mode from the trace object. This cast is safe for retry.
    const result = await submitRunToBackend({
      userId,
      spotId: 'slotwiny-arena',
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
      logDebugEvent('queue', 'retry_ok', 'ok', {
        runSessionId: run.sessionId,
        trailId: run.trailId,
      });
      updateFinalizedRun(run.sessionId, {
        saveStatus: 'saved',
        backendResult: result,
      });
      return true;
    } else {
      logDebugEvent('queue', 'retry_null', 'fail', {
        runSessionId: run.sessionId,
      });
      updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
      return false;
    }
  } catch (e) {
    logDebugEvent('queue', 'retry_error', 'fail', {
      runSessionId: run.sessionId,
      payload: { error: String(e) },
    });
    updateFinalizedRun(run.sessionId, { saveStatus: 'queued' });
    return false;
  }
}
