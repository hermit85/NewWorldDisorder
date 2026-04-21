// ═══════════════════════════════════════════════════════════
// Recording store — single-key AsyncStorage persistence for
// the in-flight pioneer GPS buffer. Survives app kill up to 1 hour.
//
// Chunk 7: the background TaskManager handler appends samples here
// directly (headless context, no React state). The recording screen
// polls this store every 500 ms for UI updates.
//
// Chunk 7 Phase 3.5 (Codex C1 + C2 fixes):
//   - All mutations serialise through a module-scoped promise
//     chain (`mutationChain`). Concurrent task callbacks + finalize
//     + cancel no longer race the read-modify-write path that
//     appendSamples performs.
//   - appendSamples + updateBufferPoints take a sessionId argument
//     and no-op when the persisted buffer's sessionId doesn't match.
//     Prevents a stale task callback (fired after a cancel +
//     restart) from corrupting the new session's buffer.
//   - drainAndSettle() lets callers await the queue to idle before
//     reading the buffer — used by finalizeStop so the stop-time
//     snapshot includes every sample the task got to enqueue.
//
// saveBuffer is the only mutation that does NOT swallow errors —
// callers need to know when the initial write fails so they can
// abort a start rather than press ahead with no persistence (Chunk
// 7 Phase 3.5 / Codex S3).
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BufferedPoint } from './geometryBuilder';

const STORAGE_KEY = 'nwd:recording-buffer';
const RESTORE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour

export interface PersistedRecording {
  trailId: string;
  spotId: string;
  /** ms since epoch — when the recording phase began. Task handler
   *  uses this to derive each sample's relative `t` in seconds. */
  startedAt: number;
  /** ms since epoch — when this record was last flushed to storage. */
  lastSavedAt: number;
  /** Unique id for this recording attempt. Persisted across headless
   *  task invocations so Phase 4's resume prompt can match stale
   *  buffers against the screen's current session. Optional for
   *  backward compat with pre-Chunk-7 buffers — null/undefined is
   *  treated as "legacy, no session". */
  sessionId?: string;
  points: BufferedPoint[];
}

/** Raw GPS sample shape the background task receives from
 *  expo-location. Minimal subset we need to translate into a
 *  BufferedPoint at append time. */
export interface RawTaskSample {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  /** ms since epoch from the platform. */
  timestamp: number;
}

// ── Mutation mutex ──────────────────────────────────────────
//
// Every mutation (write / append / clear) chains onto this
// promise so concurrent callers (task handler + component
// finalize + cancel) see a serialised view of the store.
// Reads intentionally stay outside the chain — RestoreBuffer +
// peekRestorable are snapshot operations and don't need the
// fence; callers that need a point-in-time-after-mutations view
// call `drainAndSettle()` explicitly.

let mutationChain: Promise<unknown> = Promise.resolve();

function enqueueMutation<T>(fn: () => Promise<T>): Promise<T> {
  const next = mutationChain.then(fn, fn);
  // Keep the chain a Promise<unknown> so a rejection in fn doesn't
  // poison later links. We re-swallow in a .catch so rejected
  // promises don't show up as unhandled when no one waits on them.
  mutationChain = next.catch(() => undefined);
  return next;
}

/** Await the mutation queue to drain and return the current buffer
 *  snapshot. Use this at stop/finalize time when you need to be
 *  certain every task-appended sample has been committed before
 *  reading. Returns null if no buffer exists (same semantics as
 *  restoreBuffer, minus the age gate — stop-time semantics always
 *  want the raw truth). */
export async function drainAndSettle(): Promise<PersistedRecording | null> {
  // Wait for anything currently queued to finish.
  try {
    await mutationChain;
  } catch {
    // mutationChain itself was already .catch-guarded above; this is
    // defensive against future refactors.
  }
  // Fresh read, no age gate.
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRecording;
    if (
      !parsed ||
      typeof parsed.lastSavedAt !== 'number' ||
      !Array.isArray(parsed.points)
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    if (__DEV__) console.warn('[NWD] drainAndSettle failed:', e);
    return null;
  }
}

// ── Public mutation API (all go through the chain) ──────────

/** Initial buffer write for a recording attempt. Unlike the append
 *  helpers, this DOES propagate errors — the caller (startCountdown)
 *  needs to know when storage is unavailable so it can abort the
 *  start rather than fire the background task with no persistence
 *  downstream. Chunk 7 Phase 3.5 Codex S3 fix. */
export function saveBuffer(
  recording: Omit<PersistedRecording, 'lastSavedAt'>,
): Promise<void> {
  return enqueueMutation(() => doSaveBuffer(recording));
}

/** Append raw task samples. Sessionid-fenced — if the persisted
 *  buffer's sessionId differs from the caller's, the append is a
 *  no-op. Protects against a delayed task callback from a prior
 *  session polluting a freshly started one. */
export function appendSamples(
  sessionId: string,
  samples: RawTaskSample[],
): Promise<void> {
  return enqueueMutation(() => doAppendSamples(sessionId, samples));
}

/** Replace the points array wholesale (metadata preserved).
 *  Sessionid-fenced. Not currently called, provided for Phase 4+
 *  use cases (e.g. trimming points on resume prompt decline) so
 *  every mutation path stays on the mutex. */
export function updateBufferPoints(
  sessionId: string,
  points: BufferedPoint[],
): Promise<void> {
  return enqueueMutation(() => doUpdateBufferPoints(sessionId, points));
}

/** Delete the persisted buffer. Serialised so an in-flight append
 *  either runs before the clear (result: written then cleared, no
 *  leakage) or after (result: the doAppendSamples no-active-buffer
 *  branch — samples dropped, new session not polluted). */
export function clearBuffer(): Promise<void> {
  return enqueueMutation(() => doClearBuffer());
}

// ── Private implementations (run under the mutex) ───────────

async function doSaveBuffer(
  recording: Omit<PersistedRecording, 'lastSavedAt'>,
): Promise<void> {
  const payload: PersistedRecording = {
    ...recording,
    lastSavedAt: Date.now(),
  };
  // No try/catch — Codex S3: caller needs to know when storage
  // itself is broken. If the initial write fails, the session
  // can't be trusted and the UI should surface the failure.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

async function doAppendSamples(
  sessionId: string,
  samples: RawTaskSample[],
): Promise<void> {
  if (samples.length === 0) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (__DEV__) console.warn('[NWD] appendSamples: no active buffer, skipping');
      return;
    }
    const parsed = JSON.parse(raw) as PersistedRecording;
    if (!parsed || typeof parsed.startedAt !== 'number' || !Array.isArray(parsed.points)) {
      if (__DEV__) console.warn('[NWD] appendSamples: malformed buffer, skipping');
      return;
    }

    // Codex C2 sessionId fencing — a task callback may arrive after
    // the session it was started in has been cancelled + replaced.
    // Drop samples destined for a dead sessionId rather than
    // polluting the live one.
    if (parsed.sessionId !== sessionId) {
      if (__DEV__) {
        console.warn(
          '[NWD] appendSamples: sessionId mismatch — dropping batch',
          { buffer: parsed.sessionId, caller: sessionId, count: samples.length },
        );
      }
      return;
    }

    // Codex S2 monotonic-timestamp guard. iOS is free to deliver
    // batches in any order, and at foreground transitions it can
    // backfill samples whose timestamps predate the recording's
    // startedAt entirely. Sort ascending so we process in causal
    // order, drop anything <= startedAt (pre-session noise) and
    // anything <= the last accepted absolute timestamp (already
    // covered). Debug-only log — every drop is expected iOS
    // behaviour, not a bug.
    const sorted = [...samples].sort((a, b) => a.timestamp - b.timestamp);

    const lastPoint = parsed.points[parsed.points.length - 1];
    let maxAcceptedTs = lastPoint
      ? parsed.startedAt + lastPoint.t * 1000
      : parsed.startedAt;

    const newPoints: BufferedPoint[] = [];
    let droppedPreStart = 0;
    let droppedOutOfOrder = 0;
    for (const s of sorted) {
      if (s.timestamp < parsed.startedAt) {
        droppedPreStart += 1;
        continue;
      }
      if (s.timestamp <= maxAcceptedTs) {
        droppedOutOfOrder += 1;
        continue;
      }
      newPoints.push({
        lat: s.latitude,
        lng: s.longitude,
        alt: s.altitude,
        accuracy: s.accuracy,
        t: (s.timestamp - parsed.startedAt) / 1000,
      });
      maxAcceptedTs = s.timestamp;
    }

    if (__DEV__ && (droppedPreStart > 0 || droppedOutOfOrder > 0)) {
      // console.debug instead of warn — these are routine drops,
      // not a fault. Warn-level would spam the Metro log under
      // normal operation on iOS.
      // eslint-disable-next-line no-console
      console.debug('[NWD] appendSamples: dropped samples', {
        preStart: droppedPreStart,
        outOfOrder: droppedOutOfOrder,
        accepted: newPoints.length,
      });
    }

    if (newPoints.length === 0) return;

    const next: PersistedRecording = {
      ...parsed,
      points: [...parsed.points, ...newPoints],
      lastSavedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.appendSamples failed:', e);
  }
}

async function doUpdateBufferPoints(
  sessionId: string,
  points: BufferedPoint[],
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedRecording;
    if (!parsed || typeof parsed.startedAt !== 'number') return;
    if (parsed.sessionId !== sessionId) {
      if (__DEV__) {
        console.warn('[NWD] updateBufferPoints: sessionId mismatch, skipping');
      }
      return;
    }
    const next: PersistedRecording = {
      ...parsed,
      points,
      lastSavedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.updateBufferPoints failed:', e);
  }
}

async function doClearBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.clearBuffer failed:', e);
  }
}

// ── Public read API (snapshot, no mutation chain) ───────────

/** Return the persisted recording if one exists and it is younger
 *  than 1 hour. Older records are left in storage (so `peekRestorable`
 *  can still describe them) — it is the caller's choice to `clearBuffer`.
 *  Returns null on parse failure or missing key. */
export async function restoreBuffer(): Promise<PersistedRecording | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRecording;
    if (
      !parsed ||
      typeof parsed.lastSavedAt !== 'number' ||
      !Array.isArray(parsed.points)
    ) {
      return null;
    }
    if (Date.now() - parsed.lastSavedAt > RESTORE_MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.restoreBuffer failed:', e);
    return null;
  }
}

/** Metadata-only peek for the "Restore?" prompt. Returns null if no
 *  record exists. Does not filter by age — caller decides whether
 *  to display stale records (current Sprint 3 UI only shows those
 *  under `RESTORE_MAX_AGE_MS`, but we expose the raw ageMs). */
export async function peekRestorable(): Promise<{
  trailId: string;
  startedAt: number;
  pointCount: number;
  ageMs: number;
} | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRecording;
    if (
      !parsed ||
      typeof parsed.lastSavedAt !== 'number' ||
      !Array.isArray(parsed.points) ||
      typeof parsed.trailId !== 'string'
    ) {
      return null;
    }
    return {
      trailId: parsed.trailId,
      startedAt: parsed.startedAt,
      pointCount: parsed.points.length,
      ageMs: Date.now() - parsed.lastSavedAt,
    };
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.peekRestorable failed:', e);
    return null;
  }
}
