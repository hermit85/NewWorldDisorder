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
import { AppState } from 'react-native';
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
  | { phase: 'storage_error'; message: string }
  /** Phase 4 resume detection: mount found a recent buffer for this
   *  trailId with a valid sessionId and enough points to be worth
   *  continuing. UI should prompt the rider ("Kontynuować poprzedni
   *  zjazd?") and call resumeSession() or discardResumable(). */
  | {
      phase: 'resumable';
      sessionId: string;
      trailId: string;
      startedAt: number;
      pointCount: number;
      ageMs: number;
    }
  /** Phase 4 edge case: mount found a recent buffer for this trailId
   *  but it is malformed (no sessionId or < 10 points). User can only
   *  clear it; resume is not offered. */
  | { phase: 'resumable_broken' };

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
  /** Accept a resumable buffer. Reconnects the recorder state to the
   *  persisted sessionId + startedAt and ensures the background task
   *  is running so samples continue to flow. No-op outside 'resumable'. */
  resumeSession: () => Promise<void>;
  /** Decline a resumable / resumable_broken buffer. Stops the task
   *  if running, clears the buffer, returns to 'idle'. No-op outside
   *  those two phases. */
  discardResumable: () => Promise<void>;
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

  // ── Resume public methods ────────────────────────────────

  /** Accept the resumable buffer: reconnect the recorder to the
   *  persisted sessionId + startedAt, ensure the background task is
   *  running, start the drain tick. The task may have survived an
   *  app suspension (iOS keeps location tasks alive briefly after
   *  foreground death) or it may have been killed — either way we
   *  confirm via hasStartedLocationUpdatesAsync and start it if not.
   *  Extension count cannot be recovered and resets to 0; if the
   *  rider was past 30 min of real time, the next drain tick will
   *  drop them into grace. */
  const resumeSession = useCallback(async () => {
    if (state.phase !== 'resumable') return;
    const { sessionId, startedAt } = state;

    sessionIdRef.current = sessionId;
    startedAtRef.current = startedAt;
    weakSignalSinceRef.current = null;
    latestAccuracyRef.current = null;
    latestWeakSignalRef.current = false;
    extensionsUsedRef.current = 0;

    try {
      const running = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK_NAME,
      );
      if (!running) {
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: DISTANCE_INTERVAL_M,
          activityType: Location.LocationActivityType.Fitness,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true,
        });
      }
    } catch (e) {
      if (__DEV__) {
        console.warn('[useGPSRecorder] resume startLocationUpdates failed:', e);
      }
      await finalizeStop('user');
      return;
    }

    // Restart the drain tick. UI refreshes every 500 ms from the
    // persisted buffer; first tick commits elapsedMs + latest sample.
    if (uiTickIntervalRef.current) {
      clearInterval(uiTickIntervalRef.current);
    }
    uiTickIntervalRef.current = setInterval(() => {
      void drainToState();
    }, UI_TICK_INTERVAL_MS);

    setState({
      phase: 'recording',
      elapsedMs: Date.now() - startedAt,
      currentAccuracy: null,
      weakSignal: false,
      extensionsUsed: 0,
    });
  }, [state, drainToState, finalizeStop]);

  /** Decline the resumable buffer: stop the task (if running), clear
   *  the buffer, return to 'idle'. Warm-up then takes over normally. */
  const discardResumable = useCallback(async () => {
    if (state.phase !== 'resumable' && state.phase !== 'resumable_broken') return;
    await stopBackgroundTask();
    await recordingStore.clearBuffer();
    sessionIdRef.current = null;
    setState({ phase: 'idle' });
  }, [state.phase, stopBackgroundTask]);

  // ── Mount: resume detection (Phase 4) ────────────────────
  //
  // Replaces the Phase 3 defensive stale-task cleanup (Codex S1
  // flagged it as destroying legitimate resume candidates). New
  // decision tree:
  //   - No persisted buffer               → nothing to do, stay 'idle'
  //   - Buffer trailId ≠ current          → silent stop + clear
  //   - Buffer age > 1h                   → silent stop + clear
  //   - Buffer matches + valid            → 'resumable'
  //   - Buffer matches but malformed      → 'resumable_broken'

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const persisted = await recordingStore.peekRestorable();
        if (cancelled) return;
        if (!persisted) return;

        // Buffer belongs to a different recording session — silent
        // cleanup. Offering resume here would confuse the rider
        // ("why is it asking me to resume a different trail?").
        if (persisted.trailId !== trailId) {
          if (__DEV__) {
            console.log('[useGPSRecorder] buffer trailId mismatch — cleaning', {
              bufferTrail: persisted.trailId,
              currentTrail: trailId,
            });
          }
          await stopBackgroundTask();
          await recordingStore.clearBuffer();
          return;
        }

        // 1h ceiling matches recordingStore.RESTORE_MAX_AGE_MS — the
        // same window review.tsx trusts to restore.
        const MAX_RESUMABLE_AGE_MS = 60 * 60 * 1000;
        if (persisted.ageMs > MAX_RESUMABLE_AGE_MS) {
          await stopBackgroundTask();
          await recordingStore.clearBuffer();
          return;
        }

        const hasSession = !!persisted.sessionId;
        const enoughPoints = persisted.pointCount > 10;

        if (cancelled) return;
        if (hasSession && enoughPoints) {
          setState({
            phase: 'resumable',
            sessionId: persisted.sessionId!,
            trailId: persisted.trailId,
            startedAt: persisted.startedAt,
            pointCount: persisted.pointCount,
            ageMs: persisted.ageMs,
          });
        } else {
          setState({ phase: 'resumable_broken' });
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[useGPSRecorder] resume detection failed:', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trailId, stopBackgroundTask]);

  // ── AppState: immediate drain on foreground return ───────
  //
  // Without this the UI would sit stale until the next 500 ms tick
  // after returning from lock screen / app switcher. On slow drain
  // iteration that's a visible lag; piggyback on AppState to fire
  // an extra drain immediately.

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && phaseRef.current === 'recording') {
        void drainToState();
      }
    });
    return () => sub.remove();
  }, [drainToState]);

  // ── Unmount cleanup ──────────────────────────────────────
  //
  // Important post-Phase-4: we do NOT stop the background task on
  // unmount. The task is a cross-mount resource — the recording
  // screen may unmount for navigation (e.g. user backgrounds into
  // settings) while the task keeps collecting samples. Stopping it
  // here would defeat Phase 3's whole purpose. The task is stopped
  // only by explicit finalize / cancel / discardResumable / mismatch
  // cleanup. Timers are component-scoped though — clear those so a
  // remounted screen starts with a clean tick.

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    state,
    startCountdown,
    stopRecording,
    cancelRecording,
    extendTimeout,
    resumeSession,
    discardResumable,
  };
}
