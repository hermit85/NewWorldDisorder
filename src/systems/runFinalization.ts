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
import { type RunQualityAssessment } from '@/features/run';
import { logDebugEvent } from './debugEvents';

export interface FinalizationInput {
  trace: RunTrace;
  geo: TrailGeoSeed;
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
  const { trace, geo, trailId, sessionId, gateStartCrossing, gateFinishCrossing, assessQuality } = input;

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
  const corridorRescueEligible = trace.mode === 'ranked'
    && (verification.status === 'outside_start_gate' || verification.status === 'outside_finish_gate')
    && verification.checkpointsPassed === verification.checkpointsTotal
    && verification.corridor.coveragePercent >= 90
    && verification.corridor.maxDeviationM <= 10
    && verification.gpsQuality !== 'weak';

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
      issues: verification.issues,
    },
  });

  return { verification, qualityAssessment, finalPhase, finalEligible };
}
