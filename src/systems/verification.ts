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

// ── Distance thresholds ──
const MAX_REASONABLE_DISTANCE_M = 5000;
const WALKING_DISTANCE_M = 500;

// ── Pre-run readiness check ──

export function computeReadiness(
  gps: GpsState,
  distanceToStartM: number | null,
  startGateRadiusM: number = 30
): PreRunReadiness {
  const inStartGate = distanceToStartM !== null && distanceToStartM <= startGateRadiusM;
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

  // ── Not in gate, reasonable distance ──
  if (!inStartGate && distanceToStartM !== null) {
    const distLabel = distanceToStartM > WALKING_DISTANCE_M
      ? `${(distanceToStartM / 1000).toFixed(1)} km do bramki`
      : `${Math.round(distanceToStartM)}m do startu`;

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
      message: 'W bramce. Gotowy do zjazdu.',
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
      message: 'W bramce, ale sygnał za słaby na ranking.',
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
    message: 'W bramce startowej.',
    ctaLabel: gpsGood ? 'UZBRÓJ RANKING' : 'JEDŹ TRENING',
    ctaEnabled: true,
  };
}
