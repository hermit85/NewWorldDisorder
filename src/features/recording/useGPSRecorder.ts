// ═══════════════════════════════════════════════════════════
// useGPSRecorder — owns the Pioneer recording session.
//
// Chunk 7: migrated off watchPositionAsync (foreground-only) to
// startLocationUpdatesAsync + TaskManager. Samples now arrive in
// the headless background task handler, which appends them to
// AsyncStorage via recordingStore.appendSamples. This hook no
// longer owns the sample buffer — it polls AsyncStorage every
// 500ms and exposes a React-state snapshot to the UI.
//
// Semantics preserved from the watchPositionAsync era:
//   - 3s countdown → recording phase, user can tap cancel.
//   - 30-min timeout + 5s grace + up to 3×10min extensions.
//   - Weak-signal hysteresis: >20m accuracy for 30s → flag.
//   - Explicit stop / cancel transitions; onFinalize fires on
//     non-cancel exits only.
//
// What changed under the hood:
//   - Sample dedup moved from client-side 2m haversine to expo
//     native distanceInterval: 5m (recordingStore handles
//     timestamp dedup for iOS re-delivery races).
//   - Weak-signal + currentAccuracy derived at drain tick from
//     last persisted sample, not per-sample (max 500ms lag).
//   - Buffer persists across app suspension — the background
//     task keeps feeding AsyncStorage even when the screen
//     unmounts. Phase 4 will add the resume prompt on top.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { type BufferedPoint } from './geometryBuilder';
import * as recordingStore from './recordingStore';
import { BACKGROUND_LOCATION_TASK_NAME } from './backgroundLocationTask';

// ── Tunables ───────────────────────────────────────────────

const TIMEOUT_BASELINE_MS = 30 * 60 * 1000; // 30 min
const TIMEOUT_EXTENSION_MS = 10 * 60 * 1000; // +10 min per tap
const MAX_EXTENSIONS = 3;                    // 30 + 3 × 10 = 60 min cap
const GRACE_COUNTDOWN_MS = 5_000;            // 5 s grace → auto-stop
const COUNTDOWN_MS = 3_000;                  // pre-recording countdown
const UI_TICK_INTERVAL_MS = 500;             // drain + re-render cadence
const WEAK_SIGNAL_ACCURACY_M = 20;
const WEAK_SIGNAL_DURATION_MS = 30_000;

// Native expo-location filter: only emit a sample when the rider
// has moved at least 5m. Replaces the old client-side 2m haversine
// dedup. Chunk 6 validators (MIN_DISTANCE_M 150, MIN_POINTS 15)
// remain comfortably satisfied at this resolution. Flagged in
// Chunk 7 audit R2 for Sprint 6 re-evaluation if route-progress
// gates need denser geometry.
const DISTANCE_INTERVAL_M = 5;

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
    }
  /** Surfaced when the initial recordingStore.saveBuffer throws —
   *  e.g. AsyncStorage quota full, device storage corrupt. Retryable
   *  via startCountdown (Codex S3 fix). */
  | { phase: 'storage_error'; message: string };

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

// ── Helpers ────────────────────────────────────────────────

/** Cheap enough for our "probably unique across a session" needs;
 *  collision space is absurd (base36 timestamp + 8 chars of random
 *  = ~36^17). If Sprint 5 introduces a shared runtime uuid, swap. */
function newSessionId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// ── Hook implementation ────────────────────────────────────

export function useGPSRecorder(params: UseGPSRecorderParams): UseGPSRecorderResult {
  const { trailId, spotId, onFinalize } = params;

  const [state, setState] = useState<RecorderState>({ phase: 'idle' });

  // Session metadata — lives in refs so the UI tick + drain
  // closures see current values without adding render-phase reads.
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const extensionsUsedRef = useRef<number>(0);
  const phaseRef = useRef<RecorderState['phase']>('idle');

  // Weak-signal hysteresis — preserved semantics from pre-Chunk-7.
  // Evaluated at drain time against the most recent sample's accuracy.
  const weakSignalSinceRef = useRef<number | null>(null);

  // Timer handles — cleared on stop / unmount.
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const graceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Latest derived snapshot surfaced to the UI. These feed the
  // extendTimeout immediate-sync path; drain writes to them as
  // it commits state.
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
    if (graceIntervalRef.current) {
      clearInterval(graceIntervalRef.current);
      graceIntervalRef.current = null;
    }
  }, []);

  /** Stop the background task if it is registered + running.
   *  Idempotent; safe to call from unmount cleanup even when the
   *  task never started (e.g. permission denied mid-countdown). */
  const stopBackgroundTask = useCallback(async (): Promise<void> => {
    try {
      const running = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK_NAME,
      );
      if (running) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
      }
    } catch (e) {
      if (__DEV__) console.warn('[useGPSRecorder] stopLocationUpdates failed:', e);
    }
  }, []);

  /** Stateless weak-signal evaluator — called from drain with the
   *  most recent sample's accuracy. Preserves the pre-Chunk-7 30s
   *  hysteresis window. Max detection lag is now 500ms (one drain
   *  tick) instead of per-sample, which is below the human-perceivable
   *  threshold and well under the 30s duration gate. */
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

  // ── Finalise (stop / timeout / cancel) ───────────────────

  const finalizeStop = useCallback(
    async (reason: 'user' | 'timeout' | 'cancel') => {
      await stopBackgroundTask();
      clearAllTimers();

      if (reason === 'cancel') {
        // Cancel discards everything — including persisted buffer.
        await recordingStore.clearBuffer();
        sessionIdRef.current = null;
        setState({ phase: 'stopped', points: [], reason: 'cancel' });
        return;
      }

      // Non-cancel: drain the persisted buffer one last time so
      // the 'stopped' state snapshot contains every sample the task
      // collected. `drainAndSettle` awaits the recordingStore mutex
      // queue to idle first — ensures any task callback that arrived
      // in the ~500ms before stop has flushed to AsyncStorage before
      // we read. Prevents a race where finalizeStop resolves with an
      // N-1-batch snapshot while a final batch lands moments later.
      const persisted = await recordingStore.drainAndSettle();
      const points = persisted?.points ?? [];

      setState({ phase: 'stopped', points, reason });
      if (onFinalize) {
        try {
          onFinalize(points);
        } catch (e) {
          if (__DEV__) console.warn('[NWD] onFinalize threw:', e);
        }
      }
    },
    [stopBackgroundTask, clearAllTimers, onFinalize],
  );

  // ── UI drain — the 500ms heartbeat ────────────────────────
  //
  // Reads the persisted buffer, derives elapsedMs / currentAccuracy /
  // weakSignal, commits to React state. Runs only while the recorder
  // is in 'recording' phase (grace has its own interval).

  const drainToState = useCallback(async () => {
    if (phaseRef.current !== 'recording') return;

    const elapsedMs = Date.now() - startedAtRef.current;
    if (elapsedMs >= currentBudgetMs()) {
      enterGrace();
      return;
    }

    const persisted = await recordingStore.restoreBuffer();
    const points = persisted?.points ?? [];
    const lastAccuracy =
      points.length > 0 ? points[points.length - 1].accuracy : null;

    latestAccuracyRef.current = lastAccuracy;
    updateWeakSignal(lastAccuracy);

    // Guard against state commits after phase flipped mid-await.
    if (phaseRef.current !== 'recording') return;

    setState({
      phase: 'recording',
      elapsedMs,
      currentAccuracy: lastAccuracy,
      weakSignal: latestWeakSignalRef.current,
      extensionsUsed: extensionsUsedRef.current,
    });
  }, [currentBudgetMs, enterGrace, updateWeakSignal]);

  // ── Recording phase kick-off (after countdown) ───────────

  const enterRecording = useCallback(async () => {
    const sessionId = newSessionId();
    const startedAt = Date.now();
    sessionIdRef.current = sessionId;
    startedAtRef.current = startedAt;
    weakSignalSinceRef.current = null;
    latestAccuracyRef.current = null;
    latestWeakSignalRef.current = false;

    // Initialise the persisted buffer so the task handler has a
    // record to append into. Must complete before start-updates
    // fires or the first sample batch lands in "no active buffer"
    // and gets dropped. Codex S3: storage failure here is fatal —
    // starting the task with no target buffer would mean every
    // sample the rider produces silently vanishes. Surface the
    // error so the UI can offer a retry.
    try {
      await recordingStore.saveBuffer({
        trailId,
        spotId,
        startedAt,
        sessionId,
        points: [],
      });
    } catch (e) {
      if (__DEV__) {
        console.warn('[useGPSRecorder] initial saveBuffer failed:', e);
      }
      sessionIdRef.current = null;
      setState({
        phase: 'storage_error',
        message:
          'Nie udało się rozpocząć nagrywania. Spróbuj ponownie za chwilę.',
      });
      return;
    }

    setState({
      phase: 'recording',
      elapsedMs: 0,
      currentAccuracy: null,
      weakSignal: false,
      extensionsUsed: extensionsUsedRef.current,
    });

    // UI tick — drains AsyncStorage, updates state.
    uiTickIntervalRef.current = setInterval(() => {
      void drainToState();
    }, UI_TICK_INTERVAL_MS);

    // Start the background task. Config chosen for Chunk 7 spec:
    //  - BestForNavigation: same accuracy tier as pre-Chunk-7.
    //  - distanceInterval 5m: platform-native dedup replaces our
    //    2m haversine.
    //  - activityType Fitness: iOS power model for bike/run, NOT
    //    Automotive (wrong heuristics for gravity runs).
    //  - pausesUpdatesAutomatically: false — a standing rider at a
    //    gate would get paused + lose samples otherwise.
    //  - showsBackgroundLocationIndicator: true — non-negotiable for
    //    App Store review ("Always" justification relies on the
    //    blue-bar user signal).
    try {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: DISTANCE_INTERVAL_M,
        activityType: Location.LocationActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
      });
    } catch (e) {
      if (__DEV__) {
        console.warn(
          '[useGPSRecorder] startLocationUpdates failed, auto-finalizing with reason=user',
          e,
        );
      }
      // Symmetric fallback with the pre-Chunk-7 code path: surface
      // the caller a stopped state rather than a frozen screen.
      await finalizeStop('user');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailId, spotId, drainToState, finalizeStop]);

  // ── Public: startCountdown ───────────────────────────────

  const startCountdown = useCallback(async () => {
    if (
      phaseRef.current !== 'idle' &&
      phaseRef.current !== 'permission_denied' &&
      phaseRef.current !== 'storage_error'
    ) {
      return;
    }
    setState({ phase: 'permission_requesting' });

    // Permission is owned by useLocationPermission (Chunk 7 Phase 2).
    // The recording screen has already walked the rider through stage 1
    // (WIU) + the Always explainer + stage 2 by the time startCountdown
    // fires. We still re-verify WIU here as a defensive floor — if the
    // system revoked it between explainer and START, we surface the
    // permission_denied phase so the existing UI falls back cleanly.
    let status: Location.PermissionStatus;
    try {
      const res = await Location.getForegroundPermissionsAsync();
      status = res.status;
    } catch (e) {
      if (__DEV__) console.warn('[NWD] getForegroundPermissionsAsync failed:', e);
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
    void finalizeStop('user');
  }, [finalizeStop]);

  const cancelRecording = useCallback(() => {
    // Allowed from any live phase (permission_requesting, countdown,
    // recording, timeout_grace). No-op when already stopped.
    if (phaseRef.current === 'stopped' || phaseRef.current === 'idle') return;
    void finalizeStop('cancel');
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

  // ── Mount: defensive stale-task cleanup ──────────────────
  //
  // If a prior session left the task running (app force-killed, dev
  // reload mid-session, etc.) stop it and clear the buffer. Phase 4
  // will replace this with a resume prompt; for Phase 3 we take the
  // safe path — discard stale state rather than risk a confused UI.

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const running = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK_NAME,
        );
        if (cancelled) return;
        if (running) {
          await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME);
          await recordingStore.clearBuffer();
          if (__DEV__) {
            console.log('[useGPSRecorder] Stopped stale task + cleared buffer on mount');
          }
        }
      } catch (e) {
        if (__DEV__) console.warn('[useGPSRecorder] stale-task check failed:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Unmount cleanup ──────────────────────────────────────

  useEffect(() => {
    return () => {
      void stopBackgroundTask();
      clearAllTimers();
    };
  }, [stopBackgroundTask, clearAllTimers]);

  return {
    state,
    startCountdown,
    stopRecording,
    cancelRecording,
    extendTimeout,
  };
}
