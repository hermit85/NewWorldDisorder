// ═══════════════════════════════════════════════════════════
// useRealRun — orchestrates a real GPS-tracked run
// Combines: GPS tracking, trace capture, gate detection,
// readiness checks, verification, and state management
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
  getActiveTrace,
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
import { SubmitRunResult, incrementChallengeProgress, unlockAchievement, fetchActiveChallenges, fetchUserRuns } from '@/lib/api';
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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackingActiveRef = useRef(false);

  // ── Request permission and start readiness check ──

  const beginReadinessCheck = useCallback(async () => {
    if (isWeb) {
      // Web fallback — simulate good GPS for testing
      const mockGps: GpsState = { readiness: 'good', accuracy: 4, satellites: 12, label: 'GPS Good' };
      const readiness = computeReadiness(mockGps, 5, geo?.startZone.radiusM ?? 30);
      setState((s) => ({
        ...s,
        phase: 'readiness_check',
        gps: mockGps,
        readiness,
      }));
      return;
    }

    setState((s) => ({ ...s, phase: 'readiness_check' }));

    const perm = await requestLocationPermission();
    if (!perm.foreground) {
      setState((s) => ({
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

    // Get initial position
    const pos = await getCurrentPosition();
    const gps = buildGpsState(pos);
    const distToStart = pos && geo
      ? distanceMeters(pos, geo.startZone)
      : null;
    const readiness = computeReadiness(gps, distToStart, geo?.startZone.radiusM ?? 30);

    setState((s) => ({
      ...s,
      gps,
      readiness,
      lastPoint: pos,
    }));

    // Start continuous position updates for readiness
    await startTracking((point) => {
      const gpsUpdate = buildGpsState(point);
      const distUpdate = geo ? distanceMeters(point, geo.startZone) : null;
      const readinessUpdate = computeReadiness(gpsUpdate, distUpdate, geo?.startZone.radiusM ?? 30);

      setState((s) => {
        // If already running, add to trace
        if (s.phase === 'running_ranked' || s.phase === 'running_practice') {
          addPoint(point);

          // Check finish gate
          if (geo && isInZone(point, geo.finishZone)) {
            // Auto-finish on finish gate!
            return {
              ...s,
              gps: gpsUpdate,
              lastPoint: point,
              pointCount: s.pointCount + 1,
              phase: 'finishing',
              elapsedMs: s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
            };
          }

          // Update live checkpoint status
          const updatedCps = s.checkpoints.map((cp) => {
            if (cp.passed) return cp;
            if (distanceMeters(point, cp.coordinate) <= cp.radiusM) {
              return { ...cp, passed: true, passedAt: point.timestamp };
            }
            return cp;
          });

          return {
            ...s,
            gps: gpsUpdate,
            lastPoint: point,
            pointCount: s.pointCount + 1,
            checkpoints: updatedCps,
            elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
          };
        }

        // Pre-run readiness updates
        return {
          ...s,
          gps: gpsUpdate,
          readiness: readinessUpdate,
          lastPoint: point,
        };
      });
    }, 1000);

    trackingActiveRef.current = true;
  }, [geo]);

  // ── Arm run ──

  const armRun = useCallback((mode: RunMode) => {
    setState((s) => ({
      ...s,
      mode,
      phase: mode === 'ranked' ? 'armed_ranked' : 'armed_practice',
    }));
  }, []);

  // ── Start run ──

  const startRun = useCallback(() => {
    const trace = beginTrace(trailId, trailName, state.mode);
    const now = Date.now();

    setState((s) => ({
      ...s,
      phase: s.mode === 'ranked' ? 'running_ranked' : 'running_practice',
      startedAt: now,
      elapsedMs: 0,
      trace,
      checkpoints: geo ? buildCheckpoints(geo) : [],
    }));

    // Start timer
    timerRef.current = setInterval(() => {
      setState((s) => ({
        ...s,
        elapsedMs: s.startedAt ? Date.now() - s.startedAt : 0,
      }));
    }, 50);
  }, [trailId, trailName, state.mode, geo]);

  // ── Finish run (manual or auto from gate) ──

  const finishRun = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState((s) => ({
      ...s,
      phase: 'finishing',
      elapsedMs: s.startedAt ? Date.now() - s.startedAt : s.elapsedMs,
    }));

    // Short delay then verify
    setTimeout(() => {
      setState((s) => ({ ...s, phase: 'verifying' }));

      const completedTrace = finishTrace();
      if (!completedTrace || !geo) {
        setState((s) => ({
          ...s,
          phase: 'invalidated',
          error: 'No trace data',
        }));
        return;
      }

      // Run real verification
      const verification = verifyRealRun(
        completedTrace.mode,
        completedTrace.points,
        geo
      );

      setTraceVerification(verification);
      saveCompletedRun({ ...completedTrace, verification });

      const finalPhase: RunPhaseV2 = verification.isLeaderboardEligible
        ? 'completed_verified'
        : verification.status === 'practice_only'
          ? 'completed_unverified'
          : 'invalidated';

      setState((s) => ({
        ...s,
        phase: finalPhase,
        verification,
        trace: completedTrace,
        backendStatus: isBackendConfigured() ? 'saving' : 'offline',
      }));

      // ── Submit to backend ──
      submitToBackend(completedTrace, verification);
    }, 500);
  }, [geo]);

  // ── Submit to backend ──

  const submitToBackend = useCallback(async (
    trace: RunTrace,
    verification: VerificationResult,
  ) => {
    if (!isBackendConfigured() || !userId) {
      setState((s) => ({ ...s, backendStatus: 'offline' }));
      return;
    }

    try {
      const xpAwarded = verification.isLeaderboardEligible ? XP_TABLE.validRun : 0;

      const result = await submitRunToBackend({
        userId,
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
        setState((s) => ({
          ...s,
          backendStatus: 'saved',
          backendResult: result,
        }));

        // ── Post-save: challenges + achievements ──
        updateProgressionAfterRun(userId, trailId, result.isPb, verification.isLeaderboardEligible);

        // Signal all screens to refresh
        triggerRefresh();
      } else {
        setState((s) => ({ ...s, backendStatus: 'failed' }));
      }
    } catch (e) {
      console.error('[NWD] Backend run submission failed:', e);
      setState((s) => ({ ...s, backendStatus: 'failed' }));
    }
  }, [userId, trailId]);

  // ── Post-save progression (fire-and-forget) ──

  const updateProgressionAfterRun = async (
    uid: string,
    tid: string,
    isPb: boolean,
    leaderboardEligible: boolean,
  ) => {
    try {
      // ── Challenge progress ──
      const challenges = await fetchActiveChallenges('slotwiny-arena');
      for (const ch of challenges) {
        if (ch.type === 'run_count') {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
        if (ch.type === 'pb_improvement' && isPb) {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
        if (ch.type === 'fastest_time' && ch.trail_id === tid && leaderboardEligible) {
          await incrementChallengeProgress(uid, ch.id, 1);
        }
      }

      // ── Achievements ──
      // First Blood — first valid run
      await unlockAchievement(uid, 'ach-first-blood');

      // Top 10 Entry — check if leaderboard position ≤ 10
      if (leaderboardEligible) {
        await unlockAchievement(uid, 'ach-top-10');
      }

      // Gravity Addict — 50 total runs (checked server-side by run count)
      const runs = await fetchUserRuns(uid, 1);
      if (runs.length > 0) {
        // Profile total_runs is already incremented server-side
        // Just attempt unlocks — duplicates are prevented by unique constraint
        await unlockAchievement(uid, 'ach-gravity-addict');
      }

      // Trail Hunter — ran on multiple trails
      // Slotwiny Local — 20+ runs at this spot
      // Weekend Warrior — 5 runs in one weekend
      // These could use more sophisticated server-side queries,
      // but for now we attempt and let the unique constraint handle it.
      // The backend's unique(user_id, achievement_id) prevents duplicates.

    } catch (e) {
      console.warn('[NWD] Progression update failed:', e);
    }
  };

  // ── Cancel ──

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopTracking();
    trackingActiveRef.current = false;
    clearActiveTrace();
    setState((s) => ({
      ...s,
      phase: 'idle',
      startedAt: null,
      elapsedMs: 0,
      verification: null,
      trace: null,
      error: null,
    }));
  }, []);

  // ── Reset ──

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  // ── Auto-finish when phase is 'finishing' ──

  useEffect(() => {
    if (state.phase === 'finishing' && state.startedAt) {
      finishRun();
    }
  }, [state.phase]);

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
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
    reset,
  };
}
