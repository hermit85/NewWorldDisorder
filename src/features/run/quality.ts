// ═══════════════════════════════════════════════════════════
// Run Quality Assessment — PERFECT / VALID / ROUGH
// Maps crossing results + anti-cheat + GPS quality to tiers.
//
// PHILOSOPHY: Every real ride should be at least VALID.
// PERFECT is the ideal. ROUGH is "we saved it, but it wasn't clean."
// ═══════════════════════════════════════════════════════════

import {
  RunQuality,
  RunQualityAssessment,
  DegradationReason,
  GateCrossingResult,
  AntiCheatResult,
  CrossingFlag,
} from './types';
import { GpsReadiness } from '@/data/verificationTypes';

export function assessRunQuality(params: {
  startCrossing: GateCrossingResult;
  finishCrossing: GateCrossingResult;
  antiCheat: AntiCheatResult;
  gpsQuality: GpsReadiness;
  avgAccuracyM: number;
  checkpointsPassed: number;
  checkpointsTotal: number;
  corridorCoveragePercent: number;
  wasBackgrounded: boolean;
}): RunQualityAssessment {
  const {
    startCrossing,
    finishCrossing,
    antiCheat,
    gpsQuality,
    avgAccuracyM,
    checkpointsPassed,
    checkpointsTotal,
    corridorCoveragePercent,
    wasBackgrounded,
  } = params;

  const reasons: DegradationReason[] = [];

  // ── Anti-cheat ──
  if (!antiCheat.passed) {
    // Hard fail — not eligible
    return {
      quality: 'rough',
      degradationReasons: ['suspicious_position_jump'],
      leaderboardEligible: false,
      summary: 'Wykryto nieprawidłowości w danych GPS.',
    };
  }

  // Too few GPS points — anti-cheat passed but data is unreliable
  const tooFewPoints = antiCheat.flags.includes('too_few_points' as any);
  if (tooFewPoints) {
    reasons.push('weak_gps_accuracy');
  }

  // ── Start crossing quality ──
  // Soft-crossing start = max VALID, never PERFECT
  if (startCrossing.flags.includes('soft_crossing')) {
    reasons.push('low_start_speed');
  }
  const startWasSoftCrossing = startCrossing.flags.includes('soft_crossing');
  if (startCrossing.flags.includes('wrong_side')) {
    reasons.push('wrong_start_side');
  }
  if (startCrossing.flags.includes('poor_heading')) {
    reasons.push('poor_start_heading');
  }
  if (startCrossing.flags.includes('weak_accuracy')) {
    reasons.push('weak_gps_accuracy');
  }

  // ── Finish crossing quality ──
  if (finishCrossing.flags.includes('fallback_proximity')) {
    reasons.push('finish_fallback_used');
  }
  if (finishCrossing.flags.includes('wrong_side')) {
    reasons.push('finish_wrong_side');
  }

  // ── GPS quality ──
  if (gpsQuality === 'weak' || avgAccuracyM > 20) {
    reasons.push('weak_gps_accuracy');
  }

  // ── Checkpoints ──
  if (checkpointsTotal > 0 && checkpointsPassed < checkpointsTotal) {
    reasons.push('low_checkpoint_coverage');
  }

  // ── Corridor ──
  if (corridorCoveragePercent < 80) {
    reasons.push('corridor_deviation_minor');
  }

  // ── Background ──
  if (wasBackgrounded) {
    reasons.push('backgrounded_during_run');
  }

  // ── Deduplicate reasons ──
  const uniqueReasons = [...new Set(reasons)];

  // ── Determine quality tier ──
  let quality: RunQuality;

  if (uniqueReasons.length === 0 && !startWasSoftCrossing) {
    quality = 'perfect';
  } else if (
    uniqueReasons.includes('wrong_start_side') ||
    uniqueReasons.includes('suspicious_position_jump') ||
    (uniqueReasons.includes('weak_gps_accuracy') && uniqueReasons.includes('corridor_deviation_minor')) ||
    (uniqueReasons.includes('finish_fallback_used') && uniqueReasons.includes('low_checkpoint_coverage'))
  ) {
    quality = 'rough';
  } else {
    quality = 'valid';
  }

  // Soft-crossing start caps quality at VALID (never PERFECT)
  if (startWasSoftCrossing && quality === 'perfect') {
    quality = 'valid';
  }

  // ── Leaderboard eligibility ──
  // Base requirement: anti-cheat passed + both gates crossed
  const baseCrossed = antiCheat.passed && startCrossing.crossed && finishCrossing.crossed;

  // PERFECT and VALID: eligible if base requirements met
  // ROUGH: eligible ONLY with additional conditions
  let leaderboardEligible: boolean;
  if (!baseCrossed) {
    leaderboardEligible = false;
  } else if (quality === 'rough') {
    // ROUGH runs must additionally prove trail completion:
    // - at least 2/3 checkpoints passed
    // - at least 60% corridor coverage
    // - finish was NOT a fallback
    const minCheckpoints = checkpointsTotal > 0
      ? checkpointsPassed >= Math.ceil(checkpointsTotal * 2 / 3)
      : true;
    const minCorridor = corridorCoveragePercent >= 60;
    const noFinishFallback = !finishCrossing.flags.includes('fallback_proximity');
    leaderboardEligible = minCheckpoints && minCorridor && noFinishFallback;
  } else {
    // PERFECT or VALID
    leaderboardEligible = true;
  }

  // ── Summary ──
  const summary = quality === 'perfect'
    ? 'Idealny przejazd. Start i meta czyste.'
    : quality === 'valid'
      ? 'Przejazd zaliczony. ' + (uniqueReasons.length === 1 ? summarizeReason(uniqueReasons[0]) : `${uniqueReasons.length} drobne uwagi.`)
      : leaderboardEligible
        ? 'Przejazd zapisany z uwagami. ' + summarizeReason(uniqueReasons[0])
        : 'Przejazd zapisany, ale nie kwalifikuje się do rankingu. ' + summarizeReason(uniqueReasons[0]);

  return {
    quality,
    degradationReasons: uniqueReasons,
    leaderboardEligible,
    summary,
  };
}

function summarizeReason(reason: DegradationReason): string {
  const labels: Record<DegradationReason, string> = {
    weak_gps_accuracy: 'Słaba dokładność GPS.',
    wrong_start_side: 'Start z nietypowej strony.',
    low_start_speed: 'Niska prędkość na starcie.',
    poor_start_heading: 'Nietypowy kierunek na starcie.',
    finish_fallback_used: 'Meta zaliczona z tolerancją.',
    finish_wrong_side: 'Meta z nietypowej strony.',
    suspicious_position_jump: 'Skok pozycji GPS.',
    backgrounded_during_run: 'Aplikacja była w tle.',
    low_checkpoint_coverage: 'Nie wszystkie punkty kontrolne.',
    corridor_deviation_minor: 'Drobne odchylenie od trasy.',
  };
  return labels[reason] ?? '';
}
