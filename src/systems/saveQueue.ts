// ═══════════════════════════════════════════════════════════
// Save Queue — offline-safe run submission
//
// Retries failed/queued saves automatically on:
// - App launch (after hydration)
// - App foreground (AppState 'active')
// - True offline → online connectivity edge (NetInfo)
// - Manual trigger
//
// AppState alone misses the case where the rider stays inside the app
// (mounted + foreground) while leaving / re-entering signal. NetInfo
// closes that gap; both listeners are kept because NetInfo can lag on
// some devices and an AppState tick is a useful belt-and-braces.
//
// Uses canonical retryRunSubmit() — same path as manual retry.
// ═══════════════════════════════════════════════════════════

import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { getRetryableRuns, getPendingSaveCount } from './runStore';
import { isBackendConfigured } from '@/hooks/useBackend';
import { logDebugEvent } from './debugEvents';
import { retryRunSubmit } from './retrySubmit';

// ── State ──

let _retrying = false;
let _appStateListener: { remove: () => void } | null = null;
let _netInfoUnsubscribe: (() => void) | null = null;
// Track last known offline state so we only flush on a real offline → online
// edge. NetInfo fires immediately on subscribe with the current state, and
// we don't want to flush on every connectivity tick — only when the rider
// actually came back into signal.
let _wasOffline = false;
let _lastRetryAt = 0;
let _consecutiveFailures = 0;

// Exponential backoff: 5s → 10s → 20s → 40s → 60s (cap)
function getRetryCooldown(): number {
  const base = 5_000;
  const cooldown = Math.min(base * Math.pow(2, _consecutiveFailures), 60_000);
  return cooldown;
}

// ── Public API ──

/** Initialize save queue — call once at app start after hydrateRunStore */
export function initSaveQueue(): void {
  if (!_appStateListener) {
    _appStateListener = AppState.addEventListener('change', handleAppStateChange);
  }
  if (!_netInfoUnsubscribe) {
    _netInfoUnsubscribe = NetInfo.addEventListener(handleConnectivityChange);
  }
  flushSaveQueue();
}

/** Trigger retry of all queued/failed saves. Manual UI calls can ignore cooldown. */
export async function flushSaveQueue(
  options: { ignoreCooldown?: boolean } = {},
): Promise<{ retried: number; succeeded: number }> {
  if (_retrying) return { retried: 0, succeeded: 0 };
  if (!isBackendConfigured()) return { retried: 0, succeeded: 0 };

  const now = Date.now();
  if (!options.ignoreCooldown && now - _lastRetryAt < getRetryCooldown()) {
    return { retried: 0, succeeded: 0 };
  }

  _retrying = true;
  _lastRetryAt = now;

  const queued = getRetryableRuns();

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

  // Backoff: reset on any success, increment on all-fail
  if (succeeded > 0) {
    _consecutiveFailures = 0;
  } else {
    _consecutiveFailures++;
  }

  logDebugEvent('queue', 'flush_done', succeeded > 0 ? 'ok' : 'info', {
    payload: { retried: queued.length, succeeded, nextCooldown: getRetryCooldown() },
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

function handleConnectivityChange(state: NetInfoState): void {
  // isConnected can be null while NetInfo is still resolving the initial
  // state; treat that as a no-op rather than guessing.
  if (state.isConnected === null) return;

  if (state.isConnected === false) {
    _wasOffline = true;
    return;
  }

  // Online. Only flush if we transitioned from a confirmed-offline state —
  // skips the immediate fire-on-subscribe case when the app boots online.
  // ignoreCooldown because the previous backoff was driven by being offline,
  // and signal-just-returned is exactly when we want to retry now, not in
  // 30s.
  if (_wasOffline) {
    _wasOffline = false;
    logDebugEvent('queue', 'flush_on_reconnect', 'info');
    void flushSaveQueue({ ignoreCooldown: true });
  }
}
