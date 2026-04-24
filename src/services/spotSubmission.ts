// ═══════════════════════════════════════════════════════════
// Spot Submission Service
//
// Glue layer between the submit screen and the backend RPC.
// Responsibilities:
//   - Call submit_spot RPC and normalise its result shape
//   - Queue submissions to AsyncStorage when the client is offline
//     or the RPC throws a network error
//   - Drain the queue on AppState 'active' transitions
//
// The queue is intentionally separate from saveQueue.ts — spot
// submissions and run submissions have different failure shapes
// (duplicates, name validation) so a shared abstraction would
// leak concerns in both directions. Revisit if a third queue shows up.
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import * as api from '@/lib/api';
import { SUBMISSION_QUEUE_KEY } from '@/constants';
import { logDebugEvent } from '@/systems/debugEvents';

export interface QueuedSubmission {
  name: string;
  lat: number;
  lng: number;
  /** Chunk 10.1: voivodeship slug + optional description stored
   *  alongside coords so offline submissions replay with the full
   *  payload once network returns. Absent fields on old queue rows
   *  default to '' when drained. */
  region?: string;
  description?: string;
  attemptedAt: number;
}

export type SubmitResult =
  | { ok: true; spotId: string; queued: false }
  | { ok: true; spotId: null; queued: true }
  | { ok: false; code: string; extra?: api.ApiErr['extra'] };

function isNetworkError(msg?: string): boolean {
  if (!msg) return false;
  return /network|fetch failed|timeout|offline|ECONN|Failed to fetch/i.test(msg);
}

async function readQueue(): Promise<QueuedSubmission[]> {
  try {
    const raw = await AsyncStorage.getItem(SUBMISSION_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedSubmission[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedSubmission[]): Promise<void> {
  await AsyncStorage.setItem(SUBMISSION_QUEUE_KEY, JSON.stringify(queue));
}

async function enqueue(item: QueuedSubmission): Promise<void> {
  const q = await readQueue();
  q.push(item);
  await writeQueue(q);
}

/**
 * Submit a spot. On network failure, the submission is queued
 * locally and `queued=true` is returned. The screen treats this
 * as a soft success.
 */
export async function submitSpotWithQueue(params: {
  name: string;
  lat: number;
  lng: number;
  region?: string;
  description?: string;
}): Promise<SubmitResult> {
  logDebugEvent('fetch', 'spot_submit_start', 'start', {
    payload: { nameLen: params.name.length, lat: params.lat, lng: params.lng },
  });

  try {
    const res = await api.submitSpot(params);

    if (res.ok) {
      logDebugEvent('fetch', 'spot_submit_ok', 'ok', { payload: { spotId: res.data.spotId } });
      return { ok: true, spotId: res.data.spotId, queued: false };
    }

    // The RPC returned a typed error (duplicate, validation, auth).
    // These are *not* queueable — the server already made a judgement.
    if (res.code !== 'rpc_error' || !isNetworkError(res.message)) {
      logDebugEvent('fetch', 'spot_submit_rejected', 'warn', { payload: { code: res.code } });
      return { ok: false, code: res.code, extra: res.extra };
    }

    // Network-flavoured RPC error → fall through to queue.
    throw new Error(res.message ?? 'network');
  } catch (e: any) {
    // Treat any throw as offline; queue for later.
    await enqueue({ ...params, attemptedAt: Date.now() });
    logDebugEvent('fetch', 'spot_submit_queued', 'warn', { payload: { reason: String(e?.message ?? e) } });
    return { ok: true, spotId: null, queued: true };
  }
}

// ── Queue drain ──

let _draining = false;
let _appStateListener: { remove: () => void } | null = null;

export function initSubmissionQueue(): void {
  if (!_appStateListener) {
    _appStateListener = AppState.addEventListener('change', handleAppState);
  }
  void drainSubmissionQueue();
}

function handleAppState(next: AppStateStatus) {
  if (next === 'active') void drainSubmissionQueue();
}

export async function drainSubmissionQueue(): Promise<{ drained: number; failed: number }> {
  if (_draining) return { drained: 0, failed: 0 };
  _draining = true;

  try {
    const q = await readQueue();
    if (q.length === 0) return { drained: 0, failed: 0 };

    logDebugEvent('queue', 'spot_drain_start', 'start', { payload: { count: q.length } });

    const remaining: QueuedSubmission[] = [];
    let drained = 0;
    let failed = 0;

    for (const item of q) {
      try {
        const res = await api.submitSpot({
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          region: item.region,
          description: item.description,
        });
        if (res.ok) {
          drained++;
        } else if (res.code === 'rpc_error' && isNetworkError(res.message)) {
          // Still offline — keep in queue.
          remaining.push(item);
          failed++;
        } else {
          // Hard reject (duplicate/validation/auth) — drop from queue. User's
          // submission was meaningfully refused; leaving it would loop forever.
          logDebugEvent('queue', 'spot_drain_drop', 'warn', { payload: { code: res.code } });
        }
      } catch (e) {
        remaining.push(item);
        failed++;
        logDebugEvent('queue', 'spot_drain_error', 'warn', { payload: { error: String(e) } });
      }
    }

    await writeQueue(remaining);
    logDebugEvent('queue', 'spot_drain_end', 'ok', { payload: { drained, failed, remaining: remaining.length } });
    return { drained, failed };
  } finally {
    _draining = false;
  }
}

export async function getQueuedSubmissionCount(): Promise<number> {
  const q = await readQueue();
  return q.length;
}
