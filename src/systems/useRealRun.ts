// ═══════════════════════════════════════════════════════════
// useRealRun — orchestrates a real GPS-tracked run
//
// RESPONSIBILITIES (orchestrator only):
// - GPS lifecycle (permission, tracking start/stop)
// - Run state machine (idle → armed → running → finishing → done)
// - Gate engine wiring (callbacks, point forwarding)
// - Timer for elapsed time + debug telemetry
//
// DELEGATES TO:
// - runFinalization.ts → verify + quality + eligibility
// - runSubmit.ts → backend save + progression
// - gateEngine → start/finish detection, quality assessment
// - realVerification.ts → corridor, checkpoints, GPS quality
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import { GpsHealthTracker } from '@/features/run/gpsHealthTracker';
import {
  GpsPoint,
  requestLocationPermission,
  getCurrentPosition,
  buildGpsState,
  startTracking,
  stopTracking,
  distanceMeters,
} from './gps';
import * as realRunBgBuffer from './realRunBackgroundBuffer';
import {
  useRunGateEngine,
  type GateCrossingResult,
  type RunQualityAssessment,
  type TrailGateConfig,
  type GateAttemptDiagnostic,
} from '@/features/run';
import { signedDistanceFromGateLine, headingDifference } from '@/features/run/geometry';
import { computeReadiness, getStartGateReadinessInput } from './verification';
import { buildCheckpoints } from './realVerification';
import {
  beginTrace,
  addPoint,
  finishTrace,
  clearActiveTrace,
  RunTrace,
} from './traceCapture';
import { setTraceVerification, saveCompletedRun } from './traceCapture';
import {
  RunMode,
  RunPhaseV2,
  PreRunReadiness,
  GpsState,
  VerificationResult,
  Checkpoint,
} from '@/data/verificationTypes';
import { TrailGeoSeed } from '@/data/venueConfig';
import { isBackendConfigured } from '@/hooks/useBackend';
import { SubmitRunResult } from '@/lib/api';
import { createRunSessionId, setFinalizedRun } from './runStore';
import { logDebugEvent } from './debugEvents';
import { isTestMode, shouldSimTrackingFail } from './testMode';

// Extracted modules
import { finalizeRun } from './runFinalization';
import { submitRun, updateProgression, getInitialSaveStatus, toSaveStatus, type BackendSaveStatus } from './runSubmit';
import {
  announceAutoStart,
  announceAutoFinish,
  announceManualStart,
  stopGateSpeech,
} from './gateFeedback';

export type { BackendSaveStatus } from './runSubmit';

export interface RealRunState {
  runSessionId: string;
  phase: RunPhaseV2;
  mode: RunMode;
  trailId: string;
  trailName: string;
  startedAt: number | null;
  elapsedMs: number;
  gps: GpsState;
  readiness: PreRunReadiness;
  lastPoint: GpsPoint | null;
  pointCount: number;
  checkpoints: Checkpoint[];
  verification: VerificationResult | null;
  trace: RunTrace | null;
  error: string | null;
  permissionDenied: boolean;
  backendStatus: BackendSaveStatus;
  backendResult: SubmitRunResult | null;
  runQuality: RunQualityAssessment | null;
  gateAutoStarted: boolean;
  gateAutoFinished: boolean;
  gateHeadingDeg: number | null;
  gateSpeedKmh: number | null;
  gateTotalDistanceM: number;
  gateDistToStartM: number | null;
  gateDistToFinishM: number | null;
  gateHeadingDeltaDeg: number | null;
  /** Last start-gate crossing attempt — populated on every tick while armed.
   *  `null` means the engine hasn't evaluated a point yet. */
  gateLastStartAttempt: GateAttemptDiagnostic | null;
  /** Last finish-gate crossing attempt — populated while running. */
  gateLastFinishAttempt: GateAttemptDiagnostic | null;
  /** Perpendicular-velocity threshold (m/s) the engine rejects crossings below. */
  gateVelocityMinMps: number;
}

const isWeb = Platform.OS === 'web';

export function useRealRun(
  trailId: string,
  trailName: string,
  spotId: string,
  geo: TrailGeoSeed | null,
  gateConfig: TrailGateConfig | null,
  userId?: string,
) {
  // Single source of truth for initial / post-cancel state. Before
  // this factory `cancel()` cherry-picked fields (phase, timer, etc)
  // and left others — including `mode` — leaking forward. A second
  // attempt inherited `mode='ranked'` from the cancelled one, which
  // in turn masked the P0.1 arm-routing bug (Codex review P2.1).
  const makeInitialState = useCallback((): RealRunState => ({
    runSessionId: '',
    phase: 'idle',
    mode: 'practice',
    trailId,
    trailName,
    startedAt: null,
    elapsedMs: 0,
    gps: { readiness: 'unavailable', accuracy: null, satellites: 0, label: 'Brak GPS' },
    readiness: {
      status: 'gps_locking',
      gps: { readiness: 'unavailable', accuracy: null, satellites: 0, label: 'Brak GPS' },
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM: null,
      message: 'Łączenie z GPS...',
      ctaLabel: 'CZEKAJ',
      ctaEnabled: false,
    },
    lastPoint: null,
    pointCount: 0,
    checkpoints: geo ? buildCheckpoints(geo) : [],
    verification: null,
    trace: null,
    error: null,
    permissionDenied: false,
    backendStatus: 'idle',
    backendResult: null,
    runQuality: null,
    gateAutoStarted: false,
    gateAutoFinished: false,
    gateHeadingDeg: null,
    gateSpeedKmh: null,
    gateTotalDistanceM: 0,
    gateDistToStartM: null,
    gateDistToFinishM: null,
    gateHeadingDeltaDeg: null,
    gateLastStartAttempt: null,
    gateLastFinishAttempt: null,
    gateVelocityMinMps: 1.0,
  }), [trailId, trailName, geo]);

  const [state, setState] = useState<RealRunState>(makeInitialState);

  // ── Gate Engine ──
  const gateStartCallbackRef = useRef<(crossing: GateCrossingResult) => void>(() => {});
  const gateFinishCallbackRef = useRef<(crossing: GateCrossingResult) => void>(() => {});

  const gateCallbacks = useMemo(() => ({
    onStartCrossing: (c: GateCrossingResult) => gateStartCallbackRef.current(c),
    onFinishCrossing: (c: GateCrossingResult) => gateFinishCallbackRef.current(c),
  }), []);

  const gateEngine = useRunGateEngine(gateConfig, gateCallbacks);

  // ── GPS health tracker (Chunk 10 §3.3) ──
  // Re-created fresh for each run via reset() when beginReadinessCheck
  // fires. AppState + sample feed runs alongside the existing tracking
  // callback; summary is attached to verification at finalization time.
  const gpsHealthRef = useRef<GpsHealthTracker>(new GpsHealthTracker());

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      gpsHealthRef.current.setAppState(next === 'active' ? 'active' : 'background');
    });
    return () => sub.remove();
  }, []);

  // ── Lifecycle guards ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const finalizingRef = useRef(false);
  /** Highest sample timestamp the gate engine has already consumed.
   *  Foreground watchPositionAsync and the background TaskManager
   *  task both deliver into processSample — this cursor dedups
   *  samples that arrive via both paths during a foreground window. */
  const lastProcessedTsRef = useRef<number>(0);

  const safeSetState = useCallback((updater: (s: RealRunState) => RealRunState) => {
    if (mountedRef.current) setState(updater);
  }, []);

  const stopAll = useCallback(() => {
    if (trackingActiveRef.current) {
      stopTracking();
      trackingActiveRef.current = false;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ── State ref for callbacks ──
  const stateRef = useRef(state);
  stateRef.current = state;

  // ══════════════════════════════════════════
  // GPS READINESS
  // ══════════════════════════════════════════

  const beginReadinessCheck = useCallback(async () => {
    logDebugEvent('run', 'readiness_check_start', 'start', { trailId });

    // Chunk 10: fresh GPS health window starts at readiness_check entry —
    // that is the "JEDŹ RANKINGOWO tap" moment per spec v3 §3.3.
    gpsHealthRef.current.reset();
    gpsHealthRef.current.start();
    gpsHealthRef.current.setAppState(
      AppState.currentState === 'active' ? 'active' : 'background',
    );

    if (isWeb) {
      const mockGps: GpsState = { readiness: 'good', accuracy: 4, satellites: 12, label: 'GPS Good' };
      const readiness = computeReadiness(mockGps, {
        distanceToLineM: 5,
        lateralOffsetM: 0,
        inStartGate: true,
        onApproachSide: true,
      });
      safeSetState((s) => ({ ...s, phase: 'readiness_check', gps: mockGps, readiness }));
      return;
    }

    safeSetState((s) => ({ ...s, phase: 'readiness_check' }));

    if (shouldSimTrackingFail()) {
      logDebugEvent('run', 'sim_tracking_fail', 'info', { trailId });
      safeSetState((s) => ({
        ...s,
        phase: 'readiness_check',
        readiness: {
          ...s.readiness,
          status: 'gps_locking',
          message: '[SIM] GPS tracking failure',
          ctaLabel: 'TRENING',
          ctaEnabled: true,
        },
      }));
      return;
    }

    const perm = await requestLocationPermission();
    if (!perm.foreground) {
      safeSetState((s) => ({
        ...s,
        permissionDenied: true,
        readiness: {
          ...s.readiness,
          status: 'gps_locking',
          message: 'Wymagane uprawnienia lokalizacji',
          ctaLabel: 'ZEZWÓL',
          ctaEnabled: false,
        },
      }));
      return;
    }

    const pos = await getCurrentPosition();
    const gps = buildGpsState(pos);
    const readiness = computeReadiness(gps, getStartGateReadinessInput(pos, gateConfig?.startGate ?? null));

    safeSetState((s) => ({ ...s, gps, readiness, lastPoint: pos }));

    // Fresh background-buffer window. Anything that leaked in between
    // runs (cancelled attempt, Fast Refresh) is dropped before the new
    // tracking session starts.
    realRunBgBuffer.reset();
    lastProcessedTsRef.current = 0;

    const processSample = (point: GpsPoint) => {
      // Dedup: foreground watchPositionAsync and the background task
      // both deliver while app is in foreground. Monotonic-timestamp
      // cursor keeps the gate engine / state machine from counting
      // the same physical sample twice.
      if (point.timestamp <= lastProcessedTsRef.current) return;
      lastProcessedTsRef.current = point.timestamp;

      const currentState = stateRef.current;
      const isRunning =
        currentState.phase === 'running_ranked' || currentState.phase === 'running_practice';
      const isArmed =
        currentState.phase === 'armed_ranked' || currentState.phase === 'armed_practice';
      const firstCheckpoint = currentState.checkpoints[0] ?? null;
      const hasPassedFirstCheckpoint = !!firstCheckpoint && (
        firstCheckpoint.passed ||
        distanceMeters(point, firstCheckpoint.coordinate) <= firstCheckpoint.radiusM
      );

      gateEngine.processPoint(point, isRunning, isArmed, hasPassedFirstCheckpoint);
      gpsHealthRef.current.onSample(point);

      const sampleDiagnostics = gateEngine.getDiagnostics();

      safeSetState((s) => {
        // During run: add points and update checkpoint truth.
        if (s.phase === 'running_ranked' || s.phase === 'running_practice') {
          addPoint(point);

          // Update checkpoints
          const updatedCps = s.checkpoints.map((cp) => {
            if (cp.passed) return cp;
            if (distanceMeters(point, cp.coordinate) <= cp.radiusM) {
              return { ...cp, passed: true, passedAt: point.timestamp };
            }
            return cp;
          });

          return {
            ...s,
            gps: buildGpsState(point),
            lastPoint: point,
            pointCount: s.pointCount + 1,
            checkpoints: updatedCps,
            elapsedMs: s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
            gateLastStartAttempt: sampleDiagnostics.lastStartAttempt,
            gateLastFinishAttempt: sampleDiagnostics.lastFinishAttempt,
          };
        }

        // Pre-run: update readiness
        const gpsUpdate = buildGpsState(point);
        const readinessUpdate = computeReadiness(
          gpsUpdate,
          getStartGateReadinessInput(point, gateConfig?.startGate ?? null),
        );
        return {
          ...s,
          gps: gpsUpdate,
          readiness: readinessUpdate,
          lastPoint: point,
          gateLastStartAttempt: sampleDiagnostics.lastStartAttempt,
          gateLastFinishAttempt: sampleDiagnostics.lastFinishAttempt,
        };
      });
    };

    /** Forward any samples the background task has pushed into the
     *  ring buffer since we last drained. Called at the start of
     *  every foreground sample delivery AND on AppState → 'active'
     *  transitions so a resumed app catches up immediately rather
     *  than waiting for the next watchPositionAsync fire. */
    const drainBackgroundBuffer = () => {
      const backlog = realRunBgBuffer.drainAfter(lastProcessedTsRef.current);
      for (const p of backlog) processSample(p);
    };

    const trackingStarted = await startTracking((point) => {
      // Drain BEFORE processing this foreground sample so the gate
      // engine sees a contiguous, monotonically-ordered stream even
      // when the app was just resumed from background.
      drainBackgroundBuffer();
      processSample(point);
    }, 1000);

    if (trackingStarted) {
      trackingActiveRef.current = true;
    } else {
      safeSetState((s) => ({
        ...s,
        readiness: {
          ...s.readiness,
          status: 'gps_locking',
          message: 'Nie udało się uruchomić GPS',
          ctaLabel: 'TRENING',
          ctaEnabled: true,
        },
      }));
    }
  }, [gateConfig, geo, safeSetState]);

  // ══════════════════════════════════════════
  // GATE ENGINE CALLBACKS
  // ══════════════════════════════════════════

  gateStartCallbackRef.current = (crossing: GateCrossingResult) => {
    const s = stateRef.current;
    // D1+D2: accept auto-start in either armed phase. `startRunInternal`
    // still reads `s.mode` so the resulting phase matches the user's arm
    // choice (running_ranked vs running_practice).
    if (s.phase !== 'armed_ranked' && s.phase !== 'armed_practice') return;
    if (finalizingRef.current) return;

    logDebugEvent('run', 'gate_auto_start', 'ok', {
      trailId,
      payload: {
        flags: crossing.flags,
        distance: crossing.distanceFromCenterM,
        heading: crossing.riderHeadingDeg,
        speed: crossing.speedAtCrossingKmh,
      },
    });

    announceAutoStart();
    startRunInternal(true);
  };

  gateFinishCallbackRef.current = (crossing: GateCrossingResult) => {
    if (finalizingRef.current) return;
    const s = stateRef.current;
    // D1+D2: accept auto-finish in either running phase. The finishing
    // → verifying → completed_* pipeline is mode-agnostic.
    if (s.phase !== 'running_ranked' && s.phase !== 'running_practice') return;

    logDebugEvent('run', 'gate_auto_finish', 'ok', {
      trailId,
      payload: {
        flags: crossing.flags,
        distance: crossing.distanceFromCenterM,
        heading: crossing.riderHeadingDeg,
        speed: crossing.speedAtCrossingKmh,
        totalDistanceM: gateEngine.getTotalDistanceM(),
      },
    });

    finalizingRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const finalElapsed = s.startedAt ? Date.now() - s.startedAt : s.elapsedMs;
    announceAutoFinish(finalElapsed);
    safeSetState((prev) => ({
      ...prev,
      phase: 'finishing' as RunPhaseV2,
      elapsedMs: prev.startedAt ? Date.now() - prev.startedAt : prev.elapsedMs,
      gateAutoFinished: true,
    }));
  };

  // ══════════════════════════════════════════
  // RUN LIFECYCLE: arm / start / finish / cancel
  // ══════════════════════════════════════════

  const armRun = useCallback((mode: RunMode) => {
    logDebugEvent('run', 'armed', 'info', { trailId, payload: { mode } });
    gpsHealthRef.current.markArmed();
    safeSetState((s) => ({
      ...s,
      mode,
      phase: mode === 'ranked' ? 'armed_ranked' : 'armed_practice',
    }));
  }, [safeSetState]);

  const startRunInternal = useCallback((autoStarted: boolean = false) => {
    finalizingRef.current = false;
    const sessionId = createRunSessionId();
    const currentMode = stateRef.current.mode;
    logDebugEvent('run', 'started', 'ok', {
      runSessionId: sessionId,
      trailId,
      payload: { mode: currentMode, autoStarted },
    });
    const trace = beginTrace(trailId, trailName, currentMode);
    const now = Date.now();

    safeSetState((s) => ({
      ...s,
      runSessionId: sessionId,
      phase: s.mode === 'ranked' ? 'running_ranked' : 'running_practice',
      startedAt: now,
      elapsedMs: 0,
      trace,
      checkpoints: geo ? buildCheckpoints(geo) : [],
      verification: null,
      backendStatus: 'idle',
      backendResult: null,
      runQuality: null,
      gateAutoStarted: autoStarted,
      gateAutoFinished: false,
      gateTotalDistanceM: 0,
    }));

    // Timer: elapsed time + gate telemetry for debug overlay
    timerRef.current = setInterval(() => {
      const smoothed = gateEngine.getSmoothedPosition();
      const heading = gateEngine.getCurrentHeading();

      let distToStart: number | null = null;
      let distToFinish: number | null = null;
      let headingDelta: number | null = null;

      if (smoothed && gateConfig) {
        distToStart = signedDistanceFromGateLine(smoothed, gateConfig.startGate);
        distToFinish = signedDistanceFromGateLine(smoothed, gateConfig.finishGate);
        if (heading !== null) {
          headingDelta = headingDifference(heading, gateConfig.startGate.trailBearing);
        }
      }

      const diagnostics = gateEngine.getDiagnostics();

      safeSetState((s) => ({
        ...s,
        elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
        gateHeadingDeg: heading,
        gateSpeedKmh: gateEngine.getCurrentSpeedKmh(),
        gateTotalDistanceM: gateEngine.getTotalDistanceM(),
        gateDistToStartM: distToStart,
        gateDistToFinishM: distToFinish,
        gateHeadingDeltaDeg: headingDelta,
        gateLastStartAttempt: diagnostics.lastStartAttempt,
        gateLastFinishAttempt: diagnostics.lastFinishAttempt,
        gateVelocityMinMps: diagnostics.velocityMinMps,
      }));
    }, 50);
  }, [gateConfig, trailId, trailName, geo, safeSetState, gateEngine]);

  const startRun = useCallback(() => {
    if (stateRef.current.mode !== 'practice' || stateRef.current.phase !== 'armed_practice') return;
    startRunInternal(false);
  }, [startRunInternal]);

  /**
   * D3 manual-start fallback. Fires when auto-detection gets stuck in
   * on_line_ready and the rider hits the "START RĘCZNY" button. Works in
   * EITHER armed phase — unlike startRun() which is practice-only.
   *
   * Since this skips the gate crossing, state.gateAutoStarted stays false
   * and assessRunQuality downgrades the run on the "missing start crossing"
   * branch — which is exactly the semantics we want (timer honoured, no
   * leaderboard entry).
   */
  const manualStart = useCallback(() => {
    const s = stateRef.current;
    if (s.phase !== 'armed_ranked' && s.phase !== 'armed_practice') return;
    if (finalizingRef.current) return;
    logDebugEvent('run', 'manual_start_fallback', 'info', {
      trailId,
      payload: { mode: s.mode, phaseBefore: s.phase },
    });
    announceManualStart();
    // Seed the gate engine's autoStartTimestamp so the finish lockout
    // has a reference time (getFinishGateLockoutReason computes
    // durationSec = now - autoStartTimestamp). Without this the ranked
    // manual-start path produced a run that could never unlock meta
    // — durationSec stayed 0, finishLockoutReason was always 'time'
    // (Codex review P0.2).
    gateEngine.markManualStart(Date.now());
    startRunInternal(false);
  }, [startRunInternal, trailId, gateEngine]);

  const finishRun = useCallback(() => {
    const s = stateRef.current;
    // Manual finish is allowed for practice as before, and for ranked
    // runs that started via manualStart() (gateAutoStarted=false).
    // An auto-started ranked run still has to cross the finish gate —
    // no manual bailout there, that's how ranked stays honest.
    const canFinishManually =
      s.phase === 'running_practice' ||
      (s.phase === 'running_ranked' && s.gateAutoStarted === false);
    if (!canFinishManually) return;
    if (finalizingRef.current) return;
    finalizingRef.current = true;
    logDebugEvent('run', 'finishing', 'start', { trailId, payload: { elapsed: state.elapsedMs } });

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    safeSetState((s) => ({
      ...s,
      phase: 'finishing',
      elapsedMs: s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
    }));
  }, [safeSetState]);

  const cancel = useCallback(() => {
    finalizingRef.current = false;
    stopAll();
    stopGateSpeech();
    clearActiveTrace();
    gateEngine.reset();
    // Drop any samples the background task may have pushed after
    // the rider bailed — they would otherwise replay into the next
    // attempt via drainBackgroundBuffer on the first fresh sample.
    realRunBgBuffer.reset();
    lastProcessedTsRef.current = 0;
    // Full reset via the factory — previous partial reset leaked
    // `mode`, `runSessionId`, `lastPoint`, `gps`, `readiness`,
    // `pointCount` and checkpoints into the next attempt. Permission-
    // denied state is deliberately preserved through the reset so a
    // cancelled run on a locked-out device doesn't silently re-arm.
    safeSetState((s) => ({
      ...makeInitialState(),
      permissionDenied: s.permissionDenied,
    }));
  }, [stopAll, safeSetState, gateEngine, makeInitialState]);

  // ══════════════════════════════════════════
  // FINALIZATION EFFECT
  // Triggers when phase becomes 'finishing'
  // Delegates to runFinalization + runSubmit
  // ══════════════════════════════════════════

  const sessionIdRef = useRef(state.runSessionId);
  sessionIdRef.current = state.runSessionId;

  useEffect(() => {
    if (state.phase !== 'finishing') return;
    if (!state.startedAt) return;

    stopAll();

    const timeout = setTimeout(() => {
      if (!mountedRef.current) return;
      safeSetState((s) => ({ ...s, phase: 'verifying' }));

      const completedTrace = finishTrace();
      const currentSessionId = sessionIdRef.current;

      if (!completedTrace || !geo) {
        safeSetState((s) => ({
          ...s,
          phase: 'invalidated',
          error: 'Brak danych trasy',
          backendStatus: 'offline',
        }));
        logDebugEvent('run', 'finalize_no_trace', 'fail', {
          trailId,
          payload: { hasTrace: !!completedTrace, hasGeo: !!geo },
        });
        setFinalizedRun({
          sessionId: currentSessionId,
          trailId,
          spotId,
          trailName,
          mode: state.mode,
          durationMs: state.elapsedMs,
          startedAt: state.startedAt ?? Date.now(),
          userId: userId ?? null,
          verification: null,
          saveStatus: 'offline',
          backendResult: null,
          traceSnapshot: null,
          qualityTier: null,
          updatedAt: Date.now(),
        });
        return;
      }

      // ── Delegate to finalization module ──
      const gateState = gateEngine.getState();
      const { verification, qualityAssessment, finalPhase } = finalizeRun({
        trace: completedTrace,
        geo,
        gateConfig,
        trailId,
        sessionId: currentSessionId,
        gateStartCrossing: gateState.startCrossing,
        gateFinishCrossing: gateState.finishCrossing,
        assessQuality: gateEngine.assessQuality.bind(gateEngine),
      });

      // Chunk 10 §3.3: attach GPS health summary so runs.verification_summary
      // carries the signal-quality fields that run_kpi_daily +
      // verified_pass_rate_weekly materialize into dashboards.
      verification.gpsHealth = gpsHealthRef.current.summary();

      setTraceVerification(verification);
      saveCompletedRun({ ...completedTrace, verification });

      const saveStatus = getInitialSaveStatus(userId);

      safeSetState((s) => ({
        ...s,
        phase: finalPhase,
        verification,
        trace: completedTrace,
        backendStatus: saveStatus,
        runQuality: qualityAssessment,
      }));

      // Build trace snapshot for retry
      const traceSnapshot = {
        pointCount: completedTrace.points.length,
        startedAt: completedTrace.startedAt,
        finishedAt: completedTrace.finishedAt,
        durationMs: completedTrace.durationMs,
        mode: completedTrace.mode,
        sampledPoints: completedTrace.points
          .filter((_: any, i: number) => i % 3 === 0)
          .map((p: any) => ({
            lat: p.latitude, lng: p.longitude, alt: p.altitude ?? null, ts: p.timestamp,
          })),
      };

      setFinalizedRun({
        sessionId: currentSessionId,
        trailId,
        spotId,
        trailName,
        mode: completedTrace.mode,
        durationMs: completedTrace.durationMs,
        startedAt: completedTrace.startedAt,
        userId: userId ?? null,
        verification,
        saveStatus: toSaveStatus(saveStatus),
        backendResult: null,
        traceSnapshot,
        qualityTier: qualityAssessment.quality,
        updatedAt: Date.now(),
      });

      // ── Delegate backend submit (async, non-blocking) ──
      if (isBackendConfigured() && userId) {
        submitRun({
          sessionId: currentSessionId,
          userId,
          trailId,
          spotId,
          trace: completedTrace,
          verification,
          qualityTier: qualityAssessment.quality,
        }).then((result) => {
          if (result) {
            safeSetState((s) => ({ ...s, backendStatus: 'saved', backendResult: result }));
            updateProgression(
              userId, trailId, spotId, result.isPb, verification.isLeaderboardEligible,
              result.leaderboardResult?.position ?? null,
            );
          } else {
            safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
          }
        });
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [state.phase]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (trackingActiveRef.current) {
        stopTracking();
        trackingActiveRef.current = false;
      }
      stopGateSpeech();
    };
  }, []);

  return {
    state,
    beginReadinessCheck,
    armRun,
    startRun,
    manualStart,
    finishRun,
    cancel,
    reset: cancel,
    gateEngine,
  };
}
