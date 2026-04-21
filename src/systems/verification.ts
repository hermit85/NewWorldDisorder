// ═══════════════════════════════════════════════════════════
// Pre-Run Readiness — GPS + gate proximity check
//
// RESPONSIBILITY: Determines if rider is ready to start a run.
// Used by useRealRun to gate the "UZBRÓJ RANKING" button.
//
// Post-run verification is handled by realVerification.ts.
// ═══════════════════════════════════════════════════════════

import {
  PreRunReadiness,
  GpsState,
} from '@/data/verificationTypes';
import { type GateDefinition, lateralDistanceFromGateLine, signedDistanceFromGateLine } from '@/features/run';
import type { GpsPoint } from './gps';

// ── Distance thresholds ──
const MAX_REASONABLE_DISTANCE_M = 5000;
const WALKING_DISTANCE_M = 500;
const START_LINE_DISTANCE_SLACK_M = 8;
const START_LINE_LATERAL_SLACK_M = 4;

export interface StartGateReadinessInput {
  distanceToLineM: number | null;
  lateralOffsetM: number | null;
  inStartGate: boolean;
  onApproachSide: boolean;
}

export function getStartGateReadinessInput(
  point: GpsPoint | null,
  gate: GateDefinition | null,
): StartGateReadinessInput | null {
  if (!point || !gate) return null;

  const signedDistanceM = signedDistanceFromGateLine(point, gate);
  const lateralOffsetM = lateralDistanceFromGateLine(point, gate);
  const inStartGate = (
    signedDistanceM >= 0 &&
    signedDistanceM <= gate.zoneDepthM + START_LINE_DISTANCE_SLACK_M &&
    lateralOffsetM <= (gate.lineWidthM / 2) + START_LINE_LATERAL_SLACK_M
  );

  return {
    distanceToLineM: Math.abs(signedDistanceM),
    lateralOffsetM,
    inStartGate,
    onApproachSide: signedDistanceM >= 0,
  };
}

// ── Pre-run readiness check ──

export function computeReadiness(
  gps: GpsState,
  gateInput: StartGateReadinessInput | null,
): PreRunReadiness {
  const distanceToStartM = gateInput?.distanceToLineM ?? null;
  const inStartGate = gateInput?.inStartGate ?? false;
  const gpsGood = gps.readiness === 'good' || gps.readiness === 'excellent';
  const gpsWeak = gps.readiness === 'weak';
  const gpsLocking = gps.readiness === 'locking' || gps.readiness === 'unavailable';

  // ── GPS still acquiring ──
  if (gpsLocking) {
    return {
      status: 'gps_locking',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Szukam satelitów…',
      ctaLabel: 'ŁĄCZĘ GPS',
      ctaEnabled: false,
    };
  }

  if (!gateInput) {
    return {
      status: 'practice_only',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM: null,
      message: 'Brak linii startu. Ranking jest niedostępny dla tej trasy.',
      ctaLabel: 'JEDŹ TRENING',
      ctaEnabled: true,
    };
  }

  // ── Absurd distance = location mismatch ──
  if (distanceToStartM !== null && distanceToStartM > MAX_REASONABLE_DISTANCE_M) {
    return {
      status: 'move_to_start',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Jesteś daleko od areny',
      ctaLabel: 'JEDŹ TRENING',
      ctaEnabled: true,
    };
  }

  // ── Weak GPS + not in gate ──
  if (gpsWeak && !inStartGate) {
    return {
      status: 'weak_signal',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Słaby sygnał. Ranking wymaga lepszego GPS.',
      ctaLabel: 'JEDŹ TRENING',
      ctaEnabled: true,
    };
  }

  if (!gateInput.onApproachSide && distanceToStartM !== null && distanceToStartM <= WALKING_DISTANCE_M) {
    return {
      status: 'move_to_start',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Jesteś za linią startu. Cofnij się przed bramkę.',
      ctaLabel: 'WRÓĆ PRZED START',
      ctaEnabled: false,
    };
  }

  if (
    gateInput.lateralOffsetM !== null &&
    gateInput.lateralOffsetM > START_LINE_LATERAL_SLACK_M + 8
  ) {
    return {
      status: 'move_to_start',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: 'Ustaw się na osi linii startu.',
      ctaLabel: 'PODEJDŹ DO LINII',
      ctaEnabled: false,
    };
  }

  // ── Not in gate, reasonable distance ──
  if (!inStartGate && distanceToStartM !== null) {
    const distLabel = distanceToStartM > WALKING_DISTANCE_M
      ? `${(distanceToStartM / 1000).toFixed(1)} km do linii startu`
      : `${Math.round(distanceToStartM)}m do linii startu`;

    return {
      status: 'move_to_start',
      gps,
      inStartGate: false,
      rankedEligible: false,
      distanceToStartM,
      message: distLabel,
      ctaLabel: distanceToStartM > WALKING_DISTANCE_M ? 'JEDŹ TRENING' : 'PODEJDŹ DO BRAMKI',
      ctaEnabled: distanceToStartM > WALKING_DISTANCE_M,
    };
  }

  // ── In gate + good GPS = ranked ready ──
  if (inStartGate && gpsGood) {
    return {
      status: 'ranked_ready',
      gps,
      inStartGate: true,
      rankedEligible: true,
      distanceToStartM,
      message: 'Na linii startu. Uzbrój ranking i przetnij linię.',
      ctaLabel: 'UZBRÓJ RANKING',
      ctaEnabled: true,
    };
  }

  // ── In gate + weak GPS = practice only ──
  if (inStartGate && gpsWeak) {
    return {
      status: 'practice_only',
      gps,
      inStartGate: true,
      rankedEligible: false,
      distanceToStartM,
      message: 'Na linii startu, ale GPS za słaby na ranking.',
      ctaLabel: 'JEDŹ TRENING',
      ctaEnabled: true,
    };
  }

  // ── Start gate reached, fallback ──
  return {
    status: 'start_gate_reached',
    gps,
    inStartGate: true,
    rankedEligible: gpsGood,
    distanceToStartM,
    message: 'Na linii startu.',
    ctaLabel: gpsGood ? 'UZBRÓJ RANKING' : 'JEDŹ TRENING',
    ctaEnabled: true,
  };
}
