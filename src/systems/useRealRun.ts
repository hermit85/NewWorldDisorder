// ═══════════════════════════════════════════════════════════
// useRealRun — orchestrates a real GPS-tracked run
// INTEGRITY: one run → one finish → one verify → one save
// Guards: idempotent finish, mounted check, GPS cleanup
// ═══════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';
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
import { computeReadiness } from './verification';
import { verifyRealRun, buildCheckpoints } from './realVerification';
import {
  beginTrace,
  addPoint,
  finishTrace,
  setTraceVerification,
  saveCompletedRun,
  clearActiveTrace,
  RunTrace,
} from './traceCapture';
import {
  RunMode,
  RunPhaseV2,
  PreRunReadiness,
  GpsState,
  VerificationResult,
  Checkpoint,
} from '@/data/verificationTypes';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';
import { submitRunToBackend, isBackendConfigured } from '@/hooks/useBackend';
import { SubmitRunResult, incrementChallengeProgress, unlockAchievement, fetchActiveChallenges } from '@/lib/api';
import { XP_TABLE } from './xp';
import { triggerRefresh } from '@/hooks/useRefresh';
import { createRunSessionId, setFinalizedRun, updateFinalizedRun } from './runStore';
import { logDebugEvent } from './debugEvents';
import { isTestMode, shouldSimTrackingFail, shouldSimSaveFail, getSimSaveDelay } from './testMode';

export type BackendSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'offline';

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
  });

  // ── Lifecycle guards ──
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingActiveRef = useRef(false);
  const mountedRef = useRef(true);
  const finalizingRef = useRef(false); // idempotency: only one finish pass

  // Safe setState that checks mount status
  const safeSetState = useCallback((updater: (s: RealRunState) => RealRunState) => {
    if (mountedRef.current) setState(updater);
  }, []);

  // ── Stop all timers and GPS (GPS first to prevent stale callbacks) ──
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

  // ── Request permission and start readiness check ──

  const beginReadinessCheck = useCallback(async () => {
    logDebugEvent('run', 'readiness_check_start', 'start', { trailId });

    if (isWeb) {
      const mockGps: GpsState = { readiness: 'good', accuracy: 4, satellites: 12, label: 'GPS Good' };
      const readiness = computeReadiness(mockGps, 5, geo?.startZone.radiusM ?? 30);
      safeSetState((s) => ({ ...s, phase: 'readiness_check', gps: mockGps, readiness }));
      return;
    }

    safeSetState((s) => ({ ...s, phase: 'readiness_check' }));

    // ── Simulation: force tracking failure ──
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
      safeSetState((s) => {
        // During run: add points, check gates/checkpoints
        if (s.phase === 'running_ranked' || s.phase === 'running_practice') {
          addPoint(point);

          // Auto-finish on finish gate (only if not already finalizing)
          if (geo && isInZone(point, geo.finishZone) && !finalizingRef.current) {
            // Don't call finishRun from inside setState — just set phase
            // The finalize logic runs below via the effect
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
      // GPS tracking failed to start — degrade readiness
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

  // ── Arm run ──

  const armRun = useCallback((mode: RunMode) => {
    logDebugEvent('run', 'armed', 'info', { trailId, payload: { mode } });
    safeSetState((s) => ({
      ...s,
      mode,
      phase: mode === 'ranked' ? 'armed_ranked' : 'armed_practice',
    }));
  }, [safeSetState]);

  // ── Start run ──

  const startRun = useCallback(() => {
    finalizingRef.current = false;
    const sessionId = createRunSessionId();
    logDebugEvent('run', 'started', 'ok', { runSessionId: sessionId, trailId, payload: { mode: state.mode } });
    const trace = beginTrace(trailId, trailName, state.mode);
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
    }));

    timerRef.current = setInterval(() => {
      safeSetState((s) => ({
        ...s,
        elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
      }));
    }, 50);
  }, [trailId, trailName, state.mode, geo, safeSetState]);

  // ── Finish run (manual tap) ──

  const finishRun = useCallback(() => {
    if (finalizingRef.current) return; // idempotency guard
    finalizingRef.current = true;
    logDebugEvent('run', 'finishing', 'start', { trailId, payload: { elapsed: state.elapsedMs } });

    // Stop timer immediately
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

  // ── Finalize: verify + save (runs ONCE when phase becomes 'finishing') ──
  // Capture sessionId in a ref so the effect closure always has the current value
  const sessionIdRef = useRef(state.runSessionId);
  sessionIdRef.current = state.runSessionId;

  useEffect(() => {
    if (state.phase !== 'finishing') return;
    if (!state.startedAt) return;

    // Stop GPS tracking — run is done
    stopAll();

    // Delay slightly for UX transition, then verify
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
        logDebugEvent('run', 'finalize_no_trace', 'fail', { trailId, payload: { hasTrace: !!completedTrace, hasGeo: !!geo } });
        // Still write a finalized run record so result screen has context
        setFinalizedRun({
          sessionId: currentSessionId,
          trailId,
          trailName,
          mode: state.mode,
          durationMs: state.elapsedMs,
          startedAt: state.startedAt ?? Date.now(),
          verification: null,
          saveStatus: 'offline',
          backendResult: null,
          traceSnapshot: null,
          updatedAt: Date.now(),
        });
        return;
      }

      // Verify
      logDebugEvent('run', 'verifying', 'start', { trailId, payload: { pointCount: completedTrace.points.length, mode: completedTrace.mode } });
      const verification = verifyRealRun(completedTrace.mode, completedTrace.points, geo);
      setTraceVerification(verification);
      saveCompletedRun({ ...completedTrace, verification });

      const finalPhase: RunPhaseV2 = verification.isLeaderboardEligible
        ? 'completed_verified'
        : verification.status === 'practice_only'
          ? 'completed_unverified'
          : 'invalidated';

      const saveStatus = isBackendConfigured() && userId ? 'saving' as const : 'offline' as const;

      logDebugEvent('run', 'finalized', 'ok', {
        runSessionId: currentSessionId,
        trailId,
        payload: {
          phase: finalPhase,
          verificationStatus: verification.status,
          eligible: verification.isLeaderboardEligible,
          durationMs: completedTrace.durationMs,
          saveStatus,
          issues: verification.issues,
        },
      });

      safeSetState((s) => ({
        ...s,
        phase: finalPhase,
        verification,
        trace: completedTrace,
        backendStatus: saveStatus,
      }));

      // Build trace snapshot for retry (same slim format as initial submit)
      const traceSnapshot = {
        pointCount: completedTrace.points.length,
        startedAt: completedTrace.startedAt,
        finishedAt: completedTrace.finishedAt,
        durationMs: completedTrace.durationMs,
        mode: completedTrace.mode,
        sampledPoints: completedTrace.points.filter((_: any, i: number) => i % 3 === 0).map((p: any) => ({
          lat: p.latitude, lng: p.longitude, alt: p.altitude ?? null, ts: p.timestamp,
        })),
      };

      // Write to shared run store — result screen reads from here
      setFinalizedRun({
        sessionId: currentSessionId,
        trailId,
        trailName,
        mode: completedTrace.mode,
        durationMs: completedTrace.durationMs,
        startedAt: completedTrace.startedAt,
        verification,
        saveStatus,
        backendResult: null,
        traceSnapshot,
        updatedAt: Date.now(),
      });

      // Submit to backend (async, non-blocking)
      if (isBackendConfigured() && userId) {
        submitToBackend(currentSessionId, userId, completedTrace, verification);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [state.phase]); // trigger when phase changes to 'finishing'

  // ── Submit to backend ──

  const submitToBackend = async (
    sessionId: string,
    uid: string,
    trace: RunTrace,
    verification: VerificationResult,
  ) => {
    logDebugEvent('save', 'submit_start', 'start', { runSessionId: sessionId, trailId });

    // ── Simulation: force save failure ──
    if (shouldSimSaveFail()) {
      logDebugEvent('save', 'sim_save_fail', 'fail', { runSessionId: sessionId });
      safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
      updateFinalizedRun(sessionId, { saveStatus: 'failed' });
      return;
    }

    // ── Simulation: add artificial delay ──
    const simDelay = getSimSaveDelay();
    if (simDelay > 0) {
      logDebugEvent('save', 'sim_delay', 'info', { payload: { delayMs: simDelay } });
      await new Promise((r) => setTimeout(r, simDelay));
    }

    try {
      const xpAwarded = verification.isLeaderboardEligible ? XP_TABLE.validRun : 0;

      const result = await submitRunToBackend({
        userId: uid,
        spotId: 'slotwiny-arena',
        trailId,
        mode: trace.mode,
        startedAt: trace.startedAt,
        finishedAt: trace.finishedAt ?? Date.now(),
        durationMs: trace.durationMs,
        verification,
        trace,
        xpAwarded,
      });

      if (result) {
        logDebugEvent('save', 'submit_ok', 'ok', { runSessionId: sessionId, trailId, payload: { isPb: result.isPb, position: result.leaderboardResult?.position } });
        safeSetState((s) => ({ ...s, backendStatus: 'saved', backendResult: result }));
        // Update shared store — result screen will see this
        updateFinalizedRun(sessionId, { saveStatus: 'saved', backendResult: result });

        updateProgression(uid, trailId, result.isPb, verification.isLeaderboardEligible);
        triggerRefresh();
      } else {
        logDebugEvent('save', 'submit_null', 'fail', { runSessionId: sessionId, trailId });
        safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
        updateFinalizedRun(sessionId, { saveStatus: 'failed' });
      }
    } catch (e) {
      logDebugEvent('save', 'submit_error', 'fail', { runSessionId: sessionId, trailId, payload: { error: String(e) } });
      safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
      updateFinalizedRun(sessionId, { saveStatus: 'failed' });
    }
  };

  // ── Post-save progression (fire-and-forget) ──

  const updateProgression = async (uid: string, tid: string, isPb: boolean, eligible: boolean) => {
    try {
      const challenges = await fetchActiveChallenges('slotwiny-arena');
      const now = new Date();
      for (const ch of challenges) {
        // Skip expired challenges
        if (ch.ends_at && new Date(ch.ends_at) < now) continue;
        // Skip challenges not yet started
        if (ch.starts_at && new Date(ch.starts_at) > now) continue;

        if (ch.type === 'run_count' && eligible) {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
        if (ch.type === 'pb_improvement' && isPb) {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
        // fastest_time: only counts if PB on the matching trail (actually fast, not just any run)
        if (ch.type === 'fastest_time' && ch.trail_id === tid && eligible && isPb) {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
      }
      // Achievement unlock — use correct IDs matching the achievements table
      await unlockAchievement(uid, 'first-blood');
    } catch (e) {
      console.warn('[NWD] Progression update failed:', e);
    }
  };

  // ── Cancel ──

  const cancel = useCallback(() => {
    finalizingRef.current = false;
    stopAll();
    clearActiveTrace();
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
    }));
  }, [stopAll, safeSetState]);

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
  };
}
