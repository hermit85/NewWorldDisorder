// ═══════════════════════════════════════════════════════════
// useGPSRecorder — owns the Pioneer recording session:
//   1. Permission prompt + denial surfacing.
//   2. 3 s countdown → GPS subscription @ 1 Hz.
//   3. 2 m distance-filter dedup into an in-memory buffer (useRef).
//   4. Median-accuracy / weak-signal tracking (banner trigger).
//   5. 30-min timeout with 5 s grace + up to 3×10 min extensions
//      (60 min hard cap).
//   6. AsyncStorage flush every 10 s via recordingStore.
//   7. Explicit stop / cancel transitions; onFinalize fires on
//      non-cancel exits only.
//
// Heavy state (the points array) lives in useRef to avoid a
// re-render per GPS sample. The `state.elapsedMs` +
// `state.currentAccuracy` + `state.weakSignal` updates drive UI.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  type BufferedPoint,
  type RawGPSSample,
  haversineDistanceM,
} from './geometryBuilder';
import * as recordingStore from './recordingStore';

// ── Tunables ───────────────────────────────────────────────

const SAMPLING_HZ = 1;
const SAMPLING_INTERVAL_MS = Math.round(1000 / SAMPLING_HZ);
const DISTANCE_FILTER_M = 2;
const TIMEOUT_BASELINE_MS = 30 * 60 * 1000; // 30 min
const TIMEOUT_EXTENSION_MS = 10 * 60 * 1000; // +10 min per tap
const MAX_EXTENSIONS = 3;                    // 30 + 3 × 10 = 60 min cap
const GRACE_COUNTDOWN_MS = 5_000;            // 5 s grace → auto-stop
const SAVE_BUFFER_INTERVAL_MS = 10_000;      // persist every 10 s
const COUNTDOWN_MS = 3_000;                  // pre-recording countdown
const UI_TICK_INTERVAL_MS = 500;             // re-render cadence for timer
const WEAK_SIGNAL_ACCURACY_M = 20;
const WEAK_SIGNAL_DURATION_MS = 30_000;

// ── Public types ───────────────────────────────────────────

export type RecorderState =
  | { phase: 'idle' }
  | { phase: 'permission_requesting' }
  | { phase: 'permission_denied' }
  | { phase: 'countdown'; remainingMs: number }
  | {
      phase: 'recording';
      elapsedMs: number;
      currentAccuracy: number | null;
      weakSignal: boolean;
      extensionsUsed: number;
    }
  | {
      phase: 'timeout_grace';
      remainingMs: number;
      extensionsUsed: number;
    }
  | {
      phase: 'stopped';
      points: BufferedPoint[];
      reason: 'user' | 'timeout' | 'cancel';
    };

export interface UseGPSRecorderParams {
  trailId: string;
  spotId: string;
  /** Fired after a non-cancel stop with the final buffered points. */
  onFinalize?: (points: BufferedPoint[]) => void;
}

export interface UseGPSRecorderResult {
  state: RecorderState;
  startCountdown: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  extendTimeout: () => void;
}

// ── Hook implementation ────────────────────────────────────

export function useGPSRecorder(params: UseGPSRecorderParams): UseGPSRecorderResult {
  const { trailId, spotId, onFinalize } = params;

  const [state, setState] = useState<RecorderState>({ phase: 'idle' });

  // Hot buffer lives outside state — 1 Hz pushes would thrash React.
  const bufferRef = useRef<BufferedPoint[]>([]);
  const startedAtRef = useRef<number>(0);
  const lastAcceptedRef = useRef<BufferedPoint | null>(null);
  const weakSignalSinceRef = useRef<number | null>(null);
  const extensionsUsedRef = useRef<number>(0);
  const phaseRef = useRef<RecorderState['phase']>('idle');

  // Side-effect handles — all cleared on stop / unmount.
  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest meta snapshot read by the UI tick (no per-render re-read).
  const latestAccuracyRef = useRef<number | null>(null);
  const latestWeakSignalRef = useRef<boolean>(false);

  // Keep phaseRef in sync for callback closures.
  useEffect(() => {
    phaseRef.current = state.phase;
  }, [state.phase]);

  // ── Cleanup helpers ──────────────────────────────────────

  const clearAllTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (uiTickIntervalRef.current) {
      clearInterval(uiTickIntervalRef.current);
      uiTickIntervalRef.current = null;
    }
    if (saveIntervalRef.current) {
      clearInterval(saveIntervalRef.current);
      saveIntervalRef.current = null;
    }
    if (graceIntervalRef.current) {
      clearInterval(graceIntervalRef.current);
      graceIntervalRef.current = null;
    }
  }, []);

  const teardownSubscription = useCallback(() => {
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.remove();
      } catch (e) {
        if (__DEV__) console.warn('[NWD] Location subscription.remove failed:', e);
      }
      subscriptionRef.current = null;
    }
  }, []);

  // ── Timeout budget ───────────────────────────────────────

  const currentBudgetMs = useCallback((): number => {
    return TIMEOUT_BASELINE_MS + extensionsUsedRef.current * TIMEOUT_EXTENSION_MS;
  }, []);

  // ── Grace countdown → timeout stop ───────────────────────

  const enterGrace = useCallback(() => {
    if (graceIntervalRef.current) clearInterval(graceIntervalRef.current);
    const graceStartedAt = Date.now();

    setState({
      phase: 'timeout_grace',
      remainingMs: GRACE_COUNTDOWN_MS,
      extensionsUsed: extensionsUsedRef.current,
    });

    graceIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - graceStartedAt;
      const remaining = GRACE_COUNTDOWN_MS - elapsed;
      if (remaining <= 0) {
        // Grace lapsed → finalize as timeout stop.
        if (graceIntervalRef.current) {
          clearInterval(graceIntervalRef.current);
          graceIntervalRef.current = null;
        }
        finalizeStop('timeout');
        return;
      }
      setState({
        phase: 'timeout_grace',
        remainingMs: remaining,
        extensionsUsed: extensionsUsedRef.current,
      });
    }, 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Finalise (stop / timeout) ────────────────────────────

  const finalizeStop = useCallback(
    (reason: 'user' | 'timeout' | 'cancel') => {
      teardownSubscription();
      clearAllTimers();

      const points = bufferRef.current;

      if (reason === 'cancel') {
        // Cancel discards everything — including persisted buffer.
        bufferRef.current = [];
        lastAcceptedRef.current = null;
        recordingStore.clearBuffer();
        setState({ phase: 'stopped', points: [], reason: 'cancel' });
        return;
      }

      // Non-cancel: hand points to caller and expose in state.
      // Persisted buffer is left alone — the finalize flow clears it
      // on success / will restore it if user bails out of the submit.
      setState({ phase: 'stopped', points, reason });
      if (onFinalize) {
        try {
          onFinalize(points);
        } catch (e) {
          if (__DEV__) console.warn('[NWD] onFinalize threw:', e);
        }
      }
    },
    [clearAllTimers, teardownSubscription, onFinalize],
  );

  // ── GPS sample handling ──────────────────────────────────

  const handleSample = useCallback((raw: RawGPSSample) => {
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'timeout_grace') {
      return;
    }

    // Distance-filter dedup. First point always accepted.
    const prev = lastAcceptedRef.current;
    if (prev) {
      const d = haversineDistanceM(prev, raw);
      if (d < DISTANCE_FILTER_M) {
        // Still update accuracy snapshot so the UI banner can react
        // even when the rider is stationary.
        latestAccuracyRef.current = raw.accuracy;
        updateWeakSignal(raw.accuracy);
        return;
      }
    }

    const point: BufferedPoint = {
      lat: raw.lat,
      lng: raw.lng,
      alt: raw.alt,
      accuracy: raw.accuracy,
      t: (raw.timestamp - startedAtRef.current) / 1000,
    };
    bufferRef.current.push(point);
    lastAcceptedRef.current = point;

    latestAccuracyRef.current = raw.accuracy;
    updateWeakSignal(raw.accuracy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateWeakSignal = useCallback((accuracy: number | null) => {
    if (accuracy === null || accuracy > WEAK_SIGNAL_ACCURACY_M) {
      if (weakSignalSinceRef.current === null) {
        weakSignalSinceRef.current = Date.now();
      } else if (
        !latestWeakSignalRef.current &&
        Date.now() - weakSignalSinceRef.current > WEAK_SIGNAL_DURATION_MS
      ) {
        latestWeakSignalRef.current = true;
      }
    } else {
      weakSignalSinceRef.current = null;
      latestWeakSignalRef.current = false;
    }
  }, []);

  // ── Recording phase kick-off (after countdown) ───────────

  const enterRecording = useCallback(async () => {
    startedAtRef.current = Date.now();
    bufferRef.current = [];
    lastAcceptedRef.current = null;
    weakSignalSinceRef.current = null;
    latestAccuracyRef.current = null;
    latestWeakSignalRef.current = false;

    setState({
      phase: 'recording',
      elapsedMs: 0,
      currentAccuracy: null,
      weakSignal: false,
      extensionsUsed: extensionsUsedRef.current,
    });

    // UI tick co 500 ms dla płynnego timer display.
    // TODO Chunk 4: zweryfikować czy recording screen nie re-renderuje
    // niepotrzebnie 2x/s. Jeśli tak — zoptymalizować przez useTimer
    // pattern albo React.memo na timer subcomponent.
    uiTickIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== 'recording') return;
      const elapsedMs = Date.now() - startedAtRef.current;

      // Budget check — enter grace once baseline + extensions exceeded.
      if (elapsedMs >= currentBudgetMs()) {
        enterGrace();
        return;
      }

      setState({
        phase: 'recording',
        elapsedMs,
        currentAccuracy: latestAccuracyRef.current,
        weakSignal: latestWeakSignalRef.current,
        extensionsUsed: extensionsUsedRef.current,
      });
    }, UI_TICK_INTERVAL_MS);

    // Persist buffer every 10 s.
    saveIntervalRef.current = setInterval(() => {
      if (phaseRef.current !== 'recording' && phaseRef.current !== 'timeout_grace') return;
      recordingStore.saveBuffer({
        trailId,
        spotId,
        startedAt: startedAtRef.current,
        points: bufferRef.current,
      });
    }, SAVE_BUFFER_INTERVAL_MS);

    // GPS subscription.
    try {
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: SAMPLING_INTERVAL_MS,
          distanceInterval: 0, // our own 2 m filter in handleSample
        },
        (loc) => {
          handleSample({
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            alt: loc.coords.altitude,
            accuracy: loc.coords.accuracy ?? null,
            timestamp: loc.timestamp,
          });
        },
      );
    } catch (e) {
      if (__DEV__) {
        console.warn(
          '[useGPSRecorder] watchPositionAsync failed, auto-finalizing with reason=user',
          e,
        );
      }
      // If subscription could not start, fall back to stop(reason=user)
      // so the caller sees an empty buffer rather than a frozen screen.
      finalizeStop('user');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailId, spotId]);

  // ── Public: startCountdown ───────────────────────────────

  const startCountdown = useCallback(async () => {
    if (phaseRef.current !== 'idle' && phaseRef.current !== 'permission_denied') {
      return;
    }
    setState({ phase: 'permission_requesting' });

    let status: Location.PermissionStatus;
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      status = res.status;
    } catch (e) {
      if (__DEV__) console.warn('[NWD] requestForegroundPermissionsAsync failed:', e);
      setState({ phase: 'permission_denied' });
      return;
    }
    if (status !== 'granted') {
      setState({ phase: 'permission_denied' });
      return;
    }

    // 3 s countdown with whole-second granularity so the UI can fire
    // a haptic tick on each new `remainingMs` bucket (Chunk 4).
    const countdownStartedAt = Date.now();
    setState({ phase: 'countdown', remainingMs: COUNTDOWN_MS });
    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - countdownStartedAt;
      const remaining = COUNTDOWN_MS - elapsed;
      if (remaining <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        void enterRecording();
        return;
      }
      setState({ phase: 'countdown', remainingMs: remaining });
    }, 100);
  }, [enterRecording]);

  // ── Public: stop / cancel / extend ───────────────────────

  const stopRecording = useCallback(() => {
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'timeout_grace') {
      return;
    }
    finalizeStop('user');
  }, [finalizeStop]);

  const cancelRecording = useCallback(() => {
    // Allowed from any live phase (permission_requesting, countdown,
    // recording, timeout_grace). No-op when already stopped.
    if (phaseRef.current === 'stopped' || phaseRef.current === 'idle') return;
    finalizeStop('cancel');
  }, [finalizeStop]);

  const extendTimeout = useCallback(() => {
    if (phaseRef.current !== 'timeout_grace') return;
    if (extensionsUsedRef.current >= MAX_EXTENSIONS) return;

    extensionsUsedRef.current += 1;
    if (graceIntervalRef.current) {
      clearInterval(graceIntervalRef.current);
      graceIntervalRef.current = null;
    }

    // Return to recording; the UI tick picks up extensionsUsed on its
    // next cadence. Force an immediate state sync so the extension
    // badge updates without a 500 ms flicker.
    setState({
      phase: 'recording',
      elapsedMs: Date.now() - startedAtRef.current,
      currentAccuracy: latestAccuracyRef.current,
      weakSignal: latestWeakSignalRef.current,
      extensionsUsed: extensionsUsedRef.current,
    });
  }, []);

  // ── Unmount cleanup ──────────────────────────────────────

  useEffect(() => {
    return () => {
      teardownSubscription();
      clearAllTimers();
    };
  }, [teardownSubscription, clearAllTimers]);

  return {
    state,
    startCountdown,
    stopRecording,
    cancelRecording,
    extendTimeout,
  };
}
