// ═══════════════════════════════════════════════════════════
// Recording store — single-key AsyncStorage persistence for
// the in-flight pioneer GPS buffer. Survives app kill up to 1 hour.
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
  /** ms since epoch — when the recording phase began. */
  startedAt: number;
  /** ms since epoch — when this record was last flushed to storage. */
  lastSavedAt: number;
  points: BufferedPoint[];
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
