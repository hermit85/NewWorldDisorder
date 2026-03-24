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

export type BackendSaveStatus = 'idle' | 'saving' | 'saved' | 'failed' | 'offline';

export interface RealRunState {
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
    phase: 'idle',
    mode: 'practice',
    trailId,
    trailName,
    startedAt: null,
    elapsedMs: 0,
    gps: { readiness: 'unavailable', accuracy: null, satellites: 0, label: 'No GPS' },
    readiness: {
      status: 'gps_locking',
      gps: { readiness: 'unavailable', accuracy: null, satellites: 0, label: 'No GPS' },
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM: null,
      message: 'Initializing...',
      ctaLabel: 'WAITING',
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

  // ── Stop all timers and GPS ──
  const stopAll = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (trackingActiveRef.current) {
      stopTracking();
      trackingActiveRef.current = false;
    }
  }, []);

  // ── Request permission and start readiness check ──

  const beginReadinessCheck = useCallback(async () => {
    if (isWeb) {
      const mockGps: GpsState = { readiness: 'good', accuracy: 4, satellites: 12, label: 'GPS Good' };
      const readiness = computeReadiness(mockGps, 5, geo?.startZone.radiusM ?? 30);
      safeSetState((s) => ({ ...s, phase: 'readiness_check', gps: mockGps, readiness }));
      return;
    }

    safeSetState((s) => ({ ...s, phase: 'readiness_check' }));

    const perm = await requestLocationPermission();
    if (!perm.foreground) {
      safeSetState((s) => ({
        ...s,
        permissionDenied: true,
        readiness: {
          ...s.readiness,
          status: 'gps_locking',
          message: 'Location permission required',
          ctaLabel: 'ALLOW LOCATION',
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

    await startTracking((point) => {
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

    trackingActiveRef.current = true;
  }, [geo, safeSetState]);

  // ── Arm run ──

  const armRun = useCallback((mode: RunMode) => {
    safeSetState((s) => ({
      ...s,
      mode,
      phase: mode === 'ranked' ? 'armed_ranked' : 'armed_practice',
    }));
  }, [safeSetState]);

  // ── Start run ──

  const startRun = useCallback(() => {
    finalizingRef.current = false; // reset finalize guard for this run
    const trace = beginTrace(trailId, trailName, state.mode);
    const now = Date.now();

    safeSetState((s) => ({
      ...s,
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

  useEffect(() => {
    if (state.phase !== 'finishing') return;
    if (!state.startedAt) return;

    // Stop GPS tracking — run is done
    stopAll();

    // Delay slightly for UX transition, then verify
    const timeout = setTimeout(() => {
      safeSetState((s) => ({ ...s, phase: 'verifying' }));

      const completedTrace = finishTrace();
      if (!completedTrace || !geo) {
        safeSetState((s) => ({
          ...s,
          phase: 'invalidated',
          error: 'No trace data',
          backendStatus: 'offline',
        }));
        return;
      }

      // Verify
      const verification = verifyRealRun(completedTrace.mode, completedTrace.points, geo);
      setTraceVerification(verification);
      saveCompletedRun({ ...completedTrace, verification });

      const finalPhase: RunPhaseV2 = verification.isLeaderboardEligible
        ? 'completed_verified'
        : verification.status === 'practice_only'
          ? 'completed_unverified'
          : 'invalidated';

      safeSetState((s) => ({
        ...s,
        phase: finalPhase,
        verification,
        trace: completedTrace,
        backendStatus: isBackendConfigured() && userId ? 'saving' : 'offline',
      }));

      // Submit to backend (async, non-blocking)
      if (isBackendConfigured() && userId) {
        submitToBackend(userId, completedTrace, verification);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [state.phase === 'finishing']); // only trigger on finishing

  // ── Submit to backend ──

  const submitToBackend = async (
    uid: string,
    trace: RunTrace,
    verification: VerificationResult,
  ) => {
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
        safeSetState((s) => ({
          ...s,
          backendStatus: 'saved',
          backendResult: result,
        }));

        // Post-save progression (fire-and-forget)
        updateProgression(uid, trailId, result.isPb, verification.isLeaderboardEligible);
        triggerRefresh();
      } else {
        safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
      }
    } catch (e) {
      console.error('[NWD] Backend submission failed:', e);
      safeSetState((s) => ({ ...s, backendStatus: 'failed' }));
    }
  };

  // ── Post-save progression (fire-and-forget) ──

  const updateProgression = async (uid: string, tid: string, isPb: boolean, eligible: boolean) => {
    try {
      const challenges = await fetchActiveChallenges('slotwiny-arena');
      for (const ch of challenges) {
        if (ch.type === 'run_count') await incrementChallengeProgress(uid, ch.id, 1);
        if (ch.type === 'pb_improvement' && isPb) await incrementChallengeProgress(uid, ch.id, 1);
        if (ch.type === 'fastest_time' && ch.trail_id === tid && eligible) await incrementChallengeProgress(uid, ch.id, 1);
      }
      await unlockAchievement(uid, 'ach-first-blood');
      if (eligible) await unlockAchievement(uid, 'ach-top-10');
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
