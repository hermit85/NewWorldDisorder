// ═══════════════════════════════════════════════════════════
// Save Queue — offline-safe run submission
//
// Retries failed/queued saves automatically on:
// - App launch (after hydration)
// - Network restore (AppState 'active')
// - Manual trigger
//
// Uses canonical retryRunSubmit() — same path as manual retry.
// ═══════════════════════════════════════════════════════════

import { AppState, AppStateStatus } from 'react-native';
import { getRunsByStatus, getPendingSaveCount } from './runStore';
import { isBackendConfigured } from '@/hooks/useBackend';
import { logDebugEvent } from './debugEvents';
import { retryRunSubmit } from './retrySubmit';

// ── State ──

let _retrying = false;
let _appStateListener: { remove: () => void } | null = null;
let _lastRetryAt = 0;
const RETRY_COOLDOWN_MS = 30_000;

// ── Public API ──

/** Initialize save queue — call once at app start after hydrateRunStore */
export function initSaveQueue(): void {
  if (!_appStateListener) {
    _appStateListener = AppState.addEventListener('change', handleAppStateChange);
  }
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
    // Use canonical retry path — same as manual retry from result screen
    const { success } = await retryRunSubmit(run);
    if (success) succeeded++;
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
    flushSaveQueue();
  }
}
