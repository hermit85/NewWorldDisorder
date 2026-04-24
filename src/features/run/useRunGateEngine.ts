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
import { TrailGateConfig, GateEngineState, GateCrossingResult, SmoothedPosition, RunQualityAssessment, CrossingFlag } from './types';
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

/**
 * Last attempt to detect a gate crossing. Populated on every processPoint
 * tick while armed/running so the debug overlay can answer "why didn't the
 * gate fire?" without guessing. `crossed` is the geometric result;
 * `velocityOk` is the perpendicular-velocity post-filter; `perpMps` is the
 * velocity we computed (null when we lacked heading or speed).
 *
 * B23 telemetry: `headingDeltaDeg` and `crossingType` added so the DB
 * `verification_summary.gateDiagnostics` can answer "why did auto-start
 * fail?" after the fact, not just while the debug overlay is open. This
 * is the diagnostic-first response to the B22 walk-test where we had to
 * pull fields we never persisted to reason about a failed run.
 */
export interface GateAttemptDiagnostic {
  crossed: boolean;
  velocityOk: boolean;
  perpMps: number | null;
  /** Delta between rider heading and trail bearing (deg, 0-180). Null when
   *  we lacked either heading or we were outside the crossing branch. */
  headingDeltaDeg: number | null;
  /** 'hard' when a sign-change line cross was detected (Phase 1 in geometry.ts),
   *  'soft' when the start-zone fallback fired (Phase 3), null when no crossing
   *  was recognised at all this tick. Lets us tell a near-miss from a
   *  fallback-firing in retrospect. */
  crossingType: 'hard' | 'soft' | null;
  distanceFromCenterM: number | null;
  flags: CrossingFlag[];
  /** When this attempt was evaluated (ms). */
  at: number;
}

export interface GateDiagnostics {
  lastStartAttempt: GateAttemptDiagnostic | null;
  lastFinishAttempt: GateAttemptDiagnostic | null;
  /** Total count of crossing evaluations run while armed (start) / running
   *  (finish). Rises by 1 each GPS sample the engine considered. `attempts`
   *  without `lastAttempt.crossed` means the engine looked and rejected. */
  startAttempts: number;
  finishAttempts: number;
  /** The constant velocity threshold (m/s) — exposed for UI reference. */
  velocityMinMps: number;
}

/** Derive crossing type from CrossingFlags. 'soft_crossing' means the
 *  zone-proximity fallback fired (Phase 3, geometry.ts:277+). Otherwise a
 *  crossing=true result came from Phase 1 sign-change line crossing. */
function crossingTypeFromFlags(
  crossed: boolean,
  flags: CrossingFlag[],
): 'hard' | 'soft' | null {
  if (!crossed) return null;
  if (flags.includes('soft_crossing')) return 'soft';
  return 'hard';
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
  /** Diagnostics for the debug overlay: last crossing attempt + thresholds. */
  getDiagnostics: () => GateDiagnostics;
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
  /** Seed autoStartTimestamp from an external caller (manual-start
   *  fallback). Without this the finish lockout never unlocks because
   *  `durationSec = (now - null)` stays 0. The run is still flagged
   *  downstream as missing its real startCrossing — assessQuality
   *  downgrades it off the leaderboard — but the timer now ticks and
   *  the finish gate can still fire if the rider does cross it. */
  markManualStart: (timestamp: number) => void;
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
  const lastStartAttemptRef = useRef<GateAttemptDiagnostic | null>(null);
  const lastFinishAttemptRef = useRef<GateAttemptDiagnostic | null>(null);
  // B23 telemetry: count how many times we even tried a crossing eval.
  // If `startAttempts = 0` on a failed run → engine was never armed or
  // config was missing. If `startAttempts = N, crossed = false, lastAttempt
  // = null` → all N attempts were below the "recentPoints >= 2" guard.
  // If `startAttempts = N` with a rejecting lastAttempt → engine saw it
  // and filtered it. These are three very different bug classes.
  const startAttemptsRef = useRef(0);
  const finishAttemptsRef = useRef(0);

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
    lastStartAttemptRef.current = null;
    lastFinishAttemptRef.current = null;
    startAttemptsRef.current = 0;
    finishAttemptsRef.current = 0;
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
        startAttemptsRef.current += 1;
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
        const headingDeltaDeg = crossing.riderHeadingDeg != null
          ? headingDifference(crossing.riderHeadingDeg, config.startGate.trailBearing)
          : null;
        // B23.1 hotfix (walk-test "timer odpala się stojąc"): reject Phase 3
        // `soft_crossing` fallback for LIVE auto-start. Phase 3 has no
        // velocity gate — it accepts any point inside the gate zone with
        // a loose heading check, and stationary GPS drift (~1-2 m/s jitter)
        // trivially passes both. The fallback is still useful for offline
        // finalization (quality.ts downgrades perfect→valid when it fires),
        // but it must not arm the timer for a stationary rider. Live
        // auto-start requires a real Phase 1 sign-change crossing.
        const isSoftCrossing = crossing.flags.includes('soft_crossing');

        lastStartAttemptRef.current = {
          crossed: crossing.crossed,
          velocityOk,
          perpMps,
          headingDeltaDeg,
          crossingType: crossingTypeFromFlags(crossing.crossed, crossing.flags),
          distanceFromCenterM: crossing.distanceFromCenterM,
          flags: crossing.flags,
          at: point.timestamp,
        };

        if (crossing.crossed && velocityOk && !isSoftCrossing) {
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
            finishAttemptsRef.current += 1;
            const crossing = detectGateCrossing(recentForFinish, config.finishGate, {
              isFinish: true,
              totalDistanceM: state.totalDistanceM,
              expectedLengthM: config.expectedLengthM,
              durationSec,
              minDurationSec: config.finishUnlockMinTimeSec,
            });
            const headingDeltaDeg = crossing.riderHeadingDeg != null
              ? headingDifference(crossing.riderHeadingDeg, config.finishGate.trailBearing)
              : null;

            lastFinishAttemptRef.current = {
              crossed: crossing.crossed,
              velocityOk: true, // finish has no perp-velocity gate today
              perpMps: perpendicularVelocityMps(crossing, config.finishGate.trailBearing),
              headingDeltaDeg,
              crossingType: crossingTypeFromFlags(crossing.crossed, crossing.flags),
              distanceFromCenterM: crossing.distanceFromCenterM,
              flags: crossing.flags,
              at: point.timestamp,
            };

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
    getDiagnostics: () => ({
      lastStartAttempt: lastStartAttemptRef.current,
      lastFinishAttempt: lastFinishAttemptRef.current,
      startAttempts: startAttemptsRef.current,
      finishAttempts: finishAttemptsRef.current,
      velocityMinMps: GATE_VELOCITY_MIN_MPS,
    }),
    assessQuality,
    markManualStart: (timestamp: number) => {
      // Seed only when we haven't already detected a real crossing,
      // so a late auto-detection + earlier manual-start don't fight
      // for the same slot. Manual-started runs keep startCrossing
      // null on purpose — that's how assessQuality tells them apart.
      if (stateRef.current.autoStartTimestamp == null) {
        stateRef.current.autoStartTimestamp = timestamp;
      }
    },
    reset,
  };
}
