// ═══════════════════════════════════════════════════════════
// useRunGateEngine — Official gate-based run engine
//
// Integrates with useRealRun to provide:
// - GPS smoothing
// - Line-crossing start/finish detection
// - Auto-start on start gate crossing
// - Auto-finish on finish gate crossing (+ soft fallback)
// - Quality assessment
// - Anti-cheat
//
// This hook WRAPS existing GPS tracking from useRealRun.
// It does NOT replace the run orchestrator — it enhances it.
// ═══════════════════════════════════════════════════════════

import { useRef, useCallback } from 'react';
import { GpsPoint, distanceMeters } from '@/systems/gps';
import { TrailGateConfig, GateEngineState, GateCrossingResult, SmoothedPosition, RunQualityAssessment } from './types';
import { smoothPosition, computeHeading, computeSpeedKmh, detectGateCrossing, headingDifference } from './geometry';
import { runAntiCheat } from './antiCheat';
import { assessRunQuality } from './quality';
import { GATE_VELOCITY_MIN_MPS } from './gates';

const SMOOTHING_BUFFER_SIZE = 4;
const DEG_TO_RAD = Math.PI / 180;

/**
 * Chunk 10 §A: velocity component perpendicular to the gate line. The
 * line itself is perpendicular to trailBearing, so "perpendicular to the
 * line" means "along the trail direction" — which is exactly what a
 * rider crossing the gate is doing.
 *
 * Returns null when we lack heading or speed info (let the caller decide
 * whether to fall back to accepting). Otherwise m/s along the trail axis.
 */
function perpendicularVelocityMps(
  crossing: GateCrossingResult,
  trailBearing: number,
): number | null {
  if (crossing.riderHeadingDeg == null || crossing.speedAtCrossingKmh == null) {
    return null;
  }
  const speedMps = crossing.speedAtCrossingKmh / 3.6;
  const deltaDeg = headingDifference(crossing.riderHeadingDeg, trailBearing);
  return Math.abs(speedMps * Math.cos(deltaDeg * DEG_TO_RAD));
}

export interface GateEngineCallbacks {
  /** Called when start gate is crossed — orchestrator should start the run */
  onStartCrossing: (crossing: GateCrossingResult) => void;
  /** Called when finish gate is crossed — orchestrator should finish the run */
  onFinishCrossing: (crossing: GateCrossingResult) => void;
}

export interface GateEngine {
  /** Process a new GPS point. Call this from the tracking callback. */
  processPoint: (
    point: GpsPoint,
    isRunning: boolean,
    isArmed: boolean,
    hasPassedFirstCheckpoint: boolean,
  ) => void;
  /** Get current engine state (for debug overlay) */
  getState: () => GateEngineState;
  /** Get smoothed position */
  getSmoothedPosition: () => SmoothedPosition | null;
  /** Get current computed heading */
  getCurrentHeading: () => number | null;
  /** Get current speed km/h */
  getCurrentSpeedKmh: () => number | null;
  /** Get total accumulated distance */
  getTotalDistanceM: () => number;
  /** Run full quality assessment after run completion */
  assessQuality: (
    allPoints: GpsPoint[],
    wasBackgrounded: boolean,
    checkpointsPassed: number,
    checkpointsTotal: number,
    corridorCoveragePercent: number,
    gpsQuality: 'unavailable' | 'locking' | 'weak' | 'good' | 'excellent',
    avgAccuracyM: number,
  ) => RunQualityAssessment;
  /** Reset engine state */
  reset: () => void;
}

export type FinishGateLockoutReason = 'time' | 'checkpoint' | 'distance';

export function getFinishGateLockoutReason(
  config: Pick<TrailGateConfig, 'finishUnlockMinTimeSec' | 'finishUnlockMinDistanceM'>,
  durationSec: number,
  totalDistanceM: number,
  hasPassedFirstCheckpoint: boolean,
): FinishGateLockoutReason | null {
  if (durationSec < config.finishUnlockMinTimeSec) return 'time';
  if (!hasPassedFirstCheckpoint) return 'checkpoint';
  if (totalDistanceM < config.finishUnlockMinDistanceM) return 'distance';
  return null;
}

export function useRunGateEngine(
  config: TrailGateConfig | null,
  callbacks: GateEngineCallbacks
): GateEngine {
  const stateRef = useRef<GateEngineState>({
    phase: 'idle',
    positionBuffer: [],
    smoothedPosition: null,
    currentHeading: null,
    currentSpeedKmh: null,
    startCrossing: null,
    finishCrossing: null,
    totalDistanceM: 0,
    runPointCount: 0,
    autoStartTimestamp: null,
    autoFinishTimestamp: null,
  });

  const allRunPointsRef = useRef<GpsPoint[]>([]);
  const lastRunPointRef = useRef<GpsPoint | null>(null);

  const reset = useCallback(() => {
    stateRef.current = {
      phase: 'idle',
      positionBuffer: [],
      smoothedPosition: null,
      currentHeading: null,
      currentSpeedKmh: null,
      startCrossing: null,
      finishCrossing: null,
      totalDistanceM: 0,
      runPointCount: 0,
      autoStartTimestamp: null,
      autoFinishTimestamp: null,
    };
    allRunPointsRef.current = [];
    lastRunPointRef.current = null;
  }, []);

  const processPoint = useCallback((
    point: GpsPoint,
    isRunning: boolean,
    isArmed: boolean,
    hasPassedFirstCheckpoint: boolean,
  ) => {
    if (!config) return;

    const state = stateRef.current;

    // ── Update position buffer ──
    state.positionBuffer.push(point);
    if (state.positionBuffer.length > SMOOTHING_BUFFER_SIZE + 2) {
      state.positionBuffer = state.positionBuffer.slice(-SMOOTHING_BUFFER_SIZE - 1);
    }

    // ── Smooth position ──
    state.smoothedPosition = smoothPosition(state.positionBuffer, SMOOTHING_BUFFER_SIZE);

    // ── Update heading and speed ──
    if (state.positionBuffer.length >= 2) {
      const prev = state.positionBuffer[state.positionBuffer.length - 2];
      const curr = state.positionBuffer[state.positionBuffer.length - 1];
      state.currentHeading = computeHeading(prev, curr);
      state.currentSpeedKmh = computeSpeedKmh(prev, curr);
    }

    // ── ARMED: Check for start gate crossing ──
    if (isArmed && !state.startCrossing?.crossed) {
      state.phase = 'approaching_start';

      // Use last few points for crossing detection
      const recentPoints = state.positionBuffer.slice(-6);
      if (recentPoints.length >= 2) {
        const crossing = detectGateCrossing(recentPoints, config.startGate, {
          isFinish: false,
          currentHeading: state.currentHeading,
        });

        // Chunk 10: reject the crossing when perpendicular velocity across
        // the gate line is below GATE_VELOCITY_MIN_MPS. Filters out a
        // stationary rider who happens to be parked on the line — this
        // was a live walk-test-v4 failure mode where the gate fired
        // before the rider actually committed downhill. We only enforce
        // when we have real speed + heading numbers; missing data falls
        // back to the Chunk 8 detection rules so we don't regress on
        // low-data runs.
        const perpMps = perpendicularVelocityMps(crossing, config.startGate.trailBearing);
        const velocityOk = perpMps == null || perpMps >= GATE_VELOCITY_MIN_MPS;

        if (crossing.crossed && velocityOk) {
          state.startCrossing = crossing;
          state.autoStartTimestamp = crossing.crossingTimestamp;
          state.phase = 'running';
          // Reset run tracking — including position buffer to avoid
          // pre-run points affecting smoothing after auto-start
          allRunPointsRef.current = [];
          lastRunPointRef.current = null;
          state.totalDistanceM = 0;
          state.runPointCount = 0;
          state.positionBuffer = [point];
          callbacks.onStartCrossing(crossing);
        }
      }
    }

    // ── RUNNING: Accumulate distance + check finish ──
    if (isRunning) {
      allRunPointsRef.current.push(point);
      state.runPointCount++;

      // Accumulate distance
      if (lastRunPointRef.current) {
        state.totalDistanceM += distanceMeters(lastRunPointRef.current, point);
      }
      lastRunPointRef.current = point;

      // Check finish gate
      if (!state.finishCrossing?.crossed) {
        const durationSec = state.autoStartTimestamp
          ? (point.timestamp - state.autoStartTimestamp) / 1000
          : 0;

        // On loop trails, finish cannot be armed just because the rider is
        // physically close to the finish. Require elapsed time, true route
        // progress, and CP1 before we even look for a crossing.
        const finishLockoutReason = getFinishGateLockoutReason(
          config,
          durationSec,
          state.totalDistanceM,
          hasPassedFirstCheckpoint,
        );

        if (finishLockoutReason === null) {
          state.phase = 'approaching_finish';

          const recentForFinish = allRunPointsRef.current.slice(-8);
          if (recentForFinish.length >= 2) {
            const crossing = detectGateCrossing(recentForFinish, config.finishGate, {
              isFinish: true,
              totalDistanceM: state.totalDistanceM,
              expectedLengthM: config.expectedLengthM,
              durationSec,
              minDurationSec: config.finishUnlockMinTimeSec,
            });

            if (crossing.crossed) {
              state.finishCrossing = crossing;
              state.autoFinishTimestamp = crossing.crossingTimestamp;
              state.phase = 'finished';
              callbacks.onFinishCrossing(crossing);
            }
          }
        }
      }
    }
  }, [config, callbacks]);

  const assessQuality = useCallback((
    allPoints: GpsPoint[],
    wasBackgrounded: boolean,
    checkpointsPassed: number,
    checkpointsTotal: number,
    corridorCoveragePercent: number,
    gpsQuality: 'unavailable' | 'locking' | 'weak' | 'good' | 'excellent',
    avgAccuracyM: number,
  ): RunQualityAssessment => {
    if (!config) {
      return {
        quality: 'rough',
        degradationReasons: [],
        leaderboardEligible: false,
        summary: 'Brak konfiguracji trasy.',
      };
    }

    const state = stateRef.current;
    const durationSec = state.autoStartTimestamp && state.autoFinishTimestamp
      ? (state.autoFinishTimestamp - state.autoStartTimestamp) / 1000
      : allPoints.length > 1
        ? (allPoints[allPoints.length - 1].timestamp - allPoints[0].timestamp) / 1000
        : 0;

    const antiCheat = runAntiCheat(allPoints, config, durationSec, state.totalDistanceM);

    return assessRunQuality({
      startCrossing: state.startCrossing ?? {
        crossed: false, crossingIndex: null, crossingTimestamp: null,
        distanceFromCenterM: null, riderHeadingDeg: null, speedAtCrossingKmh: null,
        correctSide: false, flags: [],
      },
      finishCrossing: state.finishCrossing ?? {
        crossed: false, crossingIndex: null, crossingTimestamp: null,
        distanceFromCenterM: null, riderHeadingDeg: null, speedAtCrossingKmh: null,
        correctSide: false, flags: [],
      },
      antiCheat,
      gpsQuality,
      avgAccuracyM,
      checkpointsPassed,
      checkpointsTotal,
      corridorCoveragePercent,
      wasBackgrounded,
    });
  }, [config]);

  return {
    processPoint,
    getState: () => stateRef.current,
    getSmoothedPosition: () => stateRef.current.smoothedPosition,
    getCurrentHeading: () => stateRef.current.currentHeading,
    getCurrentSpeedKmh: () => stateRef.current.currentSpeedKmh,
    getTotalDistanceM: () => stateRef.current.totalDistanceM,
    assessQuality,
    reset,
  };
}
