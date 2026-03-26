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
// ═══════════════════════════════════════════════════════════

import { verifyRealRun, type GateTruth } from './realVerification';
import { RunTrace } from './traceCapture';
import { VerificationResult, RunPhaseV2 } from '@/data/verificationTypes';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';
import { type RunQualityAssessment } from '@/features/run';
import { logDebugEvent } from './debugEvents';

export interface FinalizationInput {
  trace: RunTrace;
  geo: TrailGeoSeed;
  trailId: string;
  sessionId: string;
  gateStartCrossing: { crossed: boolean; flags: string[] } | null;
  gateFinishCrossing: { crossed: boolean; flags: string[] } | null;
  assessQuality: (
    points: any[],
    wasBackgrounded: boolean,
    checkpointsPassed: number,
    checkpointsTotal: number,
    corridorCoverage: number,
    gpsQuality: any,
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
 */
export function finalizeRun(input: FinalizationInput): FinalizationResult {
  const { trace, geo, trailId, sessionId, gateStartCrossing, gateFinishCrossing, assessQuality } = input;

  // 1. Gate truth — from gateEngine (single source)
  const gateTruth: GateTruth = {
    startCrossed: gateStartCrossing?.crossed ?? false,
    finishCrossed: gateFinishCrossing?.crossed ?? false,
    startFallback: gateStartCrossing?.flags.includes('soft_crossing') ?? false,
    finishFallback: gateFinishCrossing?.flags.includes('fallback_proximity') ?? false,
  };

  // 2. Route verification — corridor, checkpoints, GPS quality
  logDebugEvent('run', 'verifying', 'start', {
    trailId,
    payload: { pointCount: trace.points.length, mode: trace.mode },
  });
  const verification = verifyRealRun(trace.mode, trace.points, geo, gateTruth);

  // 3. Quality assessment — gate crossing + route verification
  const qualityAssessment = assessQuality(
    trace.points,
    false,
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

  // 4. Final eligibility — combining route + gate layers
  const routeOk = verification.isLeaderboardEligible;
  const gateOk = qualityAssessment.leaderboardEligible;
  const finalEligible = routeOk || (gateOk && trace.mode === 'ranked'
    && verification.checkpointsPassed >= 2
    && verification.corridor.coveragePercent >= 60);

  // Apply gate upgrade to verification result if justified
  if (finalEligible && !routeOk) {
    verification.isLeaderboardEligible = true;
    verification.status = 'verified';
    verification.label = `Verified (${qualityAssessment.quality})`;
    verification.explanation = qualityAssessment.summary;
  }

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
      issues: verification.issues,
    },
  });

  return { verification, qualityAssessment, finalPhase, finalEligible };
}
