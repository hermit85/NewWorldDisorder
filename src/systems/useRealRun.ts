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
  const [state, setState] = useState<RealRunState>({
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
  });

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

    const trackingStarted = await startTracking((point) => {
      const currentState = stateRef.current;
      const isRunningRanked = currentState.phase === 'running_ranked';
      const isArmedRanked = currentState.phase === 'armed_ranked';
      const firstCheckpoint = currentState.checkpoints[0] ?? null;
      const hasPassedFirstCheckpoint = !!firstCheckpoint && (
        firstCheckpoint.passed ||
        distanceMeters(point, firstCheckpoint.coordinate) <= firstCheckpoint.radiusM
      );

      gateEngine.processPoint(point, isRunningRanked, isArmedRanked, hasPassedFirstCheckpoint);
      gpsHealthRef.current.onSample(point);

      // Snapshot diagnostics once per sample — cheap (ref reads only) and
      // keeps the debug overlay fresh in armed/pre-run phases where the
      // 50ms timer tick isn't running yet.
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
    if (s.phase !== 'armed_ranked') return;
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

    startRunInternal(true);
  };

  gateFinishCallbackRef.current = (crossing: GateCrossingResult) => {
    if (finalizingRef.current) return;
    const s = stateRef.current;
    if (s.phase !== 'running_ranked') return;

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

  const finishRun = useCallback(() => {
    if (stateRef.current.phase !== 'running_practice') return;
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
    clearActiveTrace();
    gateEngine.reset();
    safeSetState((s) => ({
      ...s,
      phase: 'idle',
      startedAt: null,
      elapsedMs: 0,
      verification: null,
      trace: null,
      error: null,
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
    }));
  }, [stopAll, safeSetState, gateEngine]);

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
    };
  }, []);

  return {
    state,
    beginReadinessCheck,
    armRun,
    startRun,
    finishRun,
    cancel,
    reset: cancel,
    gateEngine,
  };
}
