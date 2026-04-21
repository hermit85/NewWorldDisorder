// ═══════════════════════════════════════════════════════════
// Recording store — single-key AsyncStorage persistence for
// the in-flight pioneer GPS buffer. Survives app kill up to 1 hour.
//
// Chunk 7: the background TaskManager handler appends samples here
// directly (headless context, no React state). The recording screen
// polls this store every 500 ms for UI updates. `appendSamples` is
// the atomic read-modify-write path the task calls — it dedupes on
// absolute timestamp so iOS sample re-delivery doesn't corrupt t.
//
// Never throws. AsyncStorage failures are logged in __DEV__ and
// swallowed; the user never sees a storage error from this module.
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

/** Throttled persistence. Caller decides how often to invoke (the
 *  recorder hook fires every 10 s). */
export async function saveBuffer(
  recording: Omit<PersistedRecording, 'lastSavedAt'>,
): Promise<void> {
  const payload: PersistedRecording = {
    ...recording,
    lastSavedAt: Date.now(),
  };
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.saveBuffer failed:', e);
  }
}

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

/** Delete the persisted buffer. Invoke after successful finalize
 *  or an explicit cancel. Silent on failure. */
export async function clearBuffer(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    if (__DEV__) console.warn('[NWD] recordingStore.clearBuffer failed:', e);
  }
}

/** Atomic append of raw task samples to the persisted buffer.
 *  Called from the headless TaskManager handler — runs outside any
 *  React context. Dedupes on absolute platform timestamp so iOS
 *  re-delivering a sample during foreground/background transitions
 *  doesn't produce duplicate `t` values in the buffer.
 *
 *  No-op + warn when no recording is currently persisted — a task
 *  callback firing without an initialised buffer indicates the task
 *  outlived its session (cleanup race) and should be ignored. */
export async function appendSamples(samples: RawTaskSample[]): Promise<void> {
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

    // Last-point absolute timestamp derived from stored relative t.
    // All new samples must be strictly newer than this.
    const lastPoint = parsed.points[parsed.points.length - 1];
    const lastAbsoluteTs = lastPoint
      ? parsed.startedAt + lastPoint.t * 1000
      : 0;

    const newPoints: BufferedPoint[] = [];
    for (const s of samples) {
      if (s.timestamp <= lastAbsoluteTs) continue;
      newPoints.push({
        lat: s.latitude,
        lng: s.longitude,
        alt: s.altitude,
        accuracy: s.accuracy,
        t: (s.timestamp - parsed.startedAt) / 1000,
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
