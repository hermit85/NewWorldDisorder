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
import { Platform } from 'react-native';
import {
  GpsPoint,
  requestLocationPermission,
  getCurrentPosition,
  buildGpsState,
  startTracking,
  stopTracking,
  isInZone,
  distanceMeters,
} from './gps';
import {
  useRunGateEngine,
  getTrailGateConfig,
  type GateCrossingResult,
  type RunQualityAssessment,
} from '@/features/run';
import { signedDistanceFromGateLine, headingDifference } from '@/features/run/geometry';
import { computeReadiness } from './verification';
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
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';
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
}

const isWeb = Platform.OS === 'web';

export function useRealRun(trailId: string, trailName: string, geo: TrailGeoSeed | null, userId?: string) {
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
  });

  // ── Gate Engine ──
  const gateStartCallbackRef = useRef<(crossing: GateCrossingResult) => void>(() => {});
  const gateFinishCallbackRef = useRef<(crossing: GateCrossingResult) => void>(() => {});

  const gateCallbacks = useMemo(() => ({
    onStartCrossing: (c: GateCrossingResult) => gateStartCallbackRef.current(c),
    onFinishCrossing: (c: GateCrossingResult) => gateFinishCallbackRef.current(c),
  }), []);

  const gateEngine = useRunGateEngine(trailId, gateCallbacks);

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

    if (isWeb) {
      const mockGps: GpsState = { readiness: 'good', accuracy: 4, satellites: 12, label: 'GPS Good' };
      const readiness = computeReadiness(mockGps, 5, geo?.startZone.radiusM ?? 30);
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
    const distToStart = pos && geo ? distanceMeters(pos, geo.startZone) : null;
    const readiness = computeReadiness(gps, distToStart, geo?.startZone.radiusM ?? 30);

    safeSetState((s) => ({ ...s, gps, readiness, lastPoint: pos }));

    const trackingStarted = await startTracking((point) => {
      const currentState = stateRef.current;
      const isRunning = currentState.phase === 'running_ranked' || currentState.phase === 'running_practice';
      const isArmed = currentState.phase === 'armed_ranked' || currentState.phase === 'armed_practice';

      gateEngine.processPoint(point, isRunning, isArmed);

      safeSetState((s) => {
        // During run: add points, check checkpoints, legacy finish fallback
        if (s.phase === 'running_ranked' || s.phase === 'running_practice') {
          addPoint(point);

          // Legacy finish fallback (gate engine should catch first)
          if (geo && isInZone(point, geo.finishZone) && !finalizingRef.current) {
            finalizingRef.current = true;
            return {
              ...s,
              gps: buildGpsState(point),
              lastPoint: point,
              pointCount: s.pointCount + 1,
              elapsedMs: s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
              phase: 'finishing' as RunPhaseV2,
            };
          }

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
            elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
          };
        }

        // Pre-run: update readiness
        const gpsUpdate = buildGpsState(point);
        const distUpdate = geo ? distanceMeters(point, geo.startZone) : null;
        const readinessUpdate = computeReadiness(gpsUpdate, distUpdate, geo?.startZone.radiusM ?? 30);
        return { ...s, gps: gpsUpdate, readiness: readinessUpdate, lastPoint: point };
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
  }, [geo, safeSetState]);

  // ══════════════════════════════════════════
  // GATE ENGINE CALLBACKS
  // ══════════════════════════════════════════

  gateStartCallbackRef.current = (crossing: GateCrossingResult) => {
    const s = stateRef.current;
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

    startRunInternal(true);
  };

  gateFinishCallbackRef.current = (crossing: GateCrossingResult) => {
    if (finalizingRef.current) return;
    const s = stateRef.current;
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
      const gateConfig = getTrailGateConfig(trailId);
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

      safeSetState((s) => ({
        ...s,
        elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
        gateHeadingDeg: heading,
        gateSpeedKmh: gateEngine.getCurrentSpeedKmh(),
        gateTotalDistanceM: gateEngine.getTotalDistanceM(),
        gateDistToStartM: distToStart,
        gateDistToFinishM: distToFinish,
        gateHeadingDeltaDeg: headingDelta,
      }));
    }, 50);
  }, [trailId, trailName, geo, safeSetState, gateEngine]);

  const startRun = useCallback(() => {
    startRunInternal(false);
  }, [startRunInternal]);

  const finishRun = useCallback(() => {
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
        trailId,
        sessionId: currentSessionId,
        gateStartCrossing: gateState.startCrossing,
        gateFinishCrossing: gateState.finishCrossing,
        assessQuality: gateEngine.assessQuality.bind(gateEngine),
      });

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
          trace: completedTrace,
          verification,
          qualityTier: qualityAssessment.quality,
        }).then((result) => {
          if (result) {
            safeSetState((s) => ({ ...s, backendStatus: 'saved', backendResult: result }));
            updateProgression(
              userId, trailId, result.isPb, verification.isLeaderboardEligible,
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
