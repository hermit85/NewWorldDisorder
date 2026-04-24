// ═══════════════════════════════════════════════════════════
// Run Finalization — verify + assess quality + determine eligibility
//
// RESPONSIBILITY:
// Takes a completed trace + gate engine state and produces:
// - VerificationResult (route integrity)
// - RunQualityAssessment (gate quality tier)
// - Final leaderboard eligibility
// - Final run phase
//
// DOES NOT: save to backend, update UI state, manage GPS
//
// FROZEN CORE — changes here affect every run outcome.
// Do not modify without field test validation.
// ═══════════════════════════════════════════════════════════

import { GpsPoint } from './gps';
import { verifyRealRun, type GateTruth } from './realVerification';
import { RunTrace } from './traceCapture';
import { VerificationResult, RunPhaseV2, GpsReadiness } from '@/data/verificationTypes';
import { TrailGeoSeed } from '@/data/venueConfig';
import { type RunQualityAssessment, type TrailGateConfig } from '@/features/run';
import { logDebugEvent } from './debugEvents';

const RESCUE_COVERAGE_MIN_PERCENT = 92;
const RESCUE_MAX_DEVIATION_M = 12;
const RESCUE_GATE_APPROACH_MAX_M = 9;
const RESCUE_MAX_AVG_ACCURACY_M = 12;
const RESCUE_DISTANCE_RATIO_MIN = 0.85;
const RESCUE_DISTANCE_RATIO_MAX = 1.15;

export interface FinalizationInput {
  trace: RunTrace;
  geo: TrailGeoSeed;
  gateConfig: TrailGateConfig | null;
  trailId: string;
  sessionId: string;
  /** Gate crossing result from gateEngine — null if gate engine had no config */
  gateStartCrossing: { crossed: boolean; flags: string[] } | null;
  /** Gate crossing result from gateEngine — null if gate engine had no config */
  gateFinishCrossing: { crossed: boolean; flags: string[] } | null;
  /** Quality assessment callback from gate engine instance */
  assessQuality: (
    points: GpsPoint[],
    wasBackgrounded: boolean,
    checkpointsPassed: number,
    checkpointsTotal: number,
    corridorCoverage: number,
    gpsQuality: GpsReadiness,
    avgAccuracy: number,
  ) => RunQualityAssessment;
}

export interface FinalizationResult {
  verification: VerificationResult;
  qualityAssessment: RunQualityAssessment;
  finalPhase: RunPhaseV2;
  finalEligible: boolean;
}

/**
 * Pure finalization logic — no side effects, no UI, no backend.
 * Takes run data in, returns verification + quality + eligibility.
 *
 * NOTE: This function mutates the `verification` object when applying
 * a gate upgrade (lines below). This is safe because the verification
 * object is freshly created by verifyRealRun() within this function.
 */
export function finalizeRun(input: FinalizationInput): FinalizationResult {
  const {
    trace,
    geo,
    gateConfig,
    trailId,
    sessionId,
    gateStartCrossing,
    gateFinishCrossing,
    assessQuality,
  } = input;

  // ── 1. Gate truth — from gateEngine (single source of truth for gate crossings) ──
  const gateTruth: GateTruth = {
    startCrossed: gateStartCrossing?.crossed ?? false,
    finishCrossed: gateFinishCrossing?.crossed ?? false,
    startFallback: gateStartCrossing?.flags?.includes('soft_crossing') ?? false,
    finishFallback: gateFinishCrossing?.flags?.includes('fallback_proximity') ?? false,
  };

  // ── 2. Route verification — corridor, checkpoints, GPS quality ──
  logDebugEvent('run', 'verifying', 'start', {
    trailId,
    payload: { pointCount: trace.points.length, mode: trace.mode },
  });
  const verification = verifyRealRun(trace.mode, trace.points, geo, gateTruth);

  // ── 3. Quality assessment — gate crossing quality + route verification context ──
  const qualityAssessment = assessQuality(
    trace.points,
    false, // wasBackgrounded — tracked separately via AppState in useRealRun
    verification.checkpointsPassed,
    verification.checkpointsTotal,
    verification.corridor.coveragePercent,
    verification.gpsQuality,
    verification.avgAccuracyM,
  );

  logDebugEvent('run', 'quality_assessed', 'info', {
    trailId,
    payload: {
      quality: qualityAssessment.quality,
      eligible: qualityAssessment.leaderboardEligible,
      reasons: qualityAssessment.degradationReasons,
      gateTruth,
    },
  });

  // ── 4. Final eligibility — combining two independent layers ──
  //
  // GATE UPGRADE POLICY:
  // If route verification fails but gate engine says the run is eligible,
  // we can upgrade eligibility ONLY when the rider demonstrably completed
  // most of the course (≥2 checkpoints, ≥60% corridor coverage).
  //
  // This prevents gate engine from "magically" making a shortcut run eligible,
  // while still rescuing runs where legacy verification was too strict on
  // gate proximity but the rider clearly rode the full trail.
  //
  const routeOk = verification.isLeaderboardEligible;
  const majorDeviationCount = verification.corridor.deviations.filter((d) => d.type === 'major').length;
  const shortcutDeviationCount = verification.corridor.deviations.filter((d) => d.type === 'shortcut').length;
  const checkpointsOrdered = verification.checkpoints.every((cp, index, arr) => {
    if (!cp.passed || cp.passedAt === null) return false;
    if (index === 0) return true;
    const prev = arr[index - 1];
    return prev.passedAt !== null && prev.passedAt <= cp.passedAt;
  });
  const expectedLengthM = gateConfig?.expectedLengthM ?? 0;
  const distanceRatio = expectedLengthM > 0 ? trace.durationMs >= 0 ? totalTraceDistanceM(trace.points) / expectedLengthM : 0 : 0;
  const startClosestApproachM = gateConfig
    ? closestApproachM(trace.points, gateConfig.startGate.center)
    : Infinity;
  const finishClosestApproachM = gateConfig
    ? closestApproachM(trace.points, gateConfig.finishGate.center)
    : Infinity;

  const corridorRescueEligible = trace.mode === 'ranked'
    && (verification.status === 'outside_start_gate' || verification.status === 'outside_finish_gate')
    && verification.checkpointsTotal === 3
    && verification.checkpointsPassed === 3
    && checkpointsOrdered
    && verification.corridor.coveragePercent >= RESCUE_COVERAGE_MIN_PERCENT
    && verification.corridor.maxDeviationM <= RESCUE_MAX_DEVIATION_M
    && majorDeviationCount === 0
    && shortcutDeviationCount === 0
    && distanceRatio >= RESCUE_DISTANCE_RATIO_MIN
    && distanceRatio <= RESCUE_DISTANCE_RATIO_MAX
    && startClosestApproachM <= RESCUE_GATE_APPROACH_MAX_M
    && finishClosestApproachM <= RESCUE_GATE_APPROACH_MAX_M
    && verification.avgAccuracyM <= RESCUE_MAX_AVG_ACCURACY_M;

  const finalEligible = routeOk || corridorRescueEligible;

  // Apply corridor rescue — mutates the freshly-created verification object.
  if (corridorRescueEligible && !routeOk) {
    verification.isLeaderboardEligible = true;
    verification.status = 'verified';
    verification.acceptedVia = 'corridor_rescue';
    verification.label = 'Verified';
    verification.explanation = 'Zaliczone na podstawie pełnego przebiegu trasy mimo niepełnego odczytu bramki.';
    verification.issues = verification.issues.filter(
      (issue) => issue !== 'Start gate not crossed' && issue !== 'Finish gate not crossed',
    );
  }

  // ── 5. Map to run phase ──
  const finalPhase: RunPhaseV2 = finalEligible
    ? 'completed_verified'
    : verification.status === 'practice_only'
      ? 'completed_unverified'
      : 'invalidated';

  logDebugEvent('run', 'finalized', 'ok', {
    runSessionId: sessionId,
    trailId,
    payload: {
      phase: finalPhase,
      verificationStatus: verification.status,
      eligible: verification.isLeaderboardEligible,
      durationMs: trace.durationMs,
      corridorRescueApplied: corridorRescueEligible && !routeOk,
      corridorRescueDetail: corridorRescueEligible && !routeOk ? {
        distanceRatio,
        startClosestApproachM,
        finishClosestApproachM,
      } : null,
      issues: verification.issues,
    },
  });

  return { verification, qualityAssessment, finalPhase, finalEligible };
}

// Defense-in-depth: the live path (useRealRun.processSample) already rejects
// out-of-order samples via lastProcessedTsRef, so trace.points SHOULD be
// monotonic by timestamp. We re-sort here anyway because a single out-of-order
// sample leaking through (future code path, deserialized trace, test fixture)
// would inflate distanceRatio and hand a rider a false corridor_rescue pass.
// Cost is O(n log n) on a few hundred points, runs once per finalization.
function totalTraceDistanceM(points: GpsPoint[]): number {
  if (points.length < 2) return 0;
  const ordered = [...points].sort((a, b) => a.timestamp - b.timestamp);
  let total = 0;
  for (let i = 1; i < ordered.length; i++) {
    total += distanceBetween(ordered[i - 1], ordered[i]);
  }
  return total;
}

function closestApproachM(
  points: GpsPoint[],
  target: { latitude: number; longitude: number },
): number {
  let best = Infinity;
  for (const point of points) {
    best = Math.min(best, distanceBetween(point, target));
  }
  return best;
}

function distanceBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
