// ═══════════════════════════════════════════════════════════
// Verification Engine v1
// MVP route-trust system — Polish-first field-test ready
// ═══════════════════════════════════════════════════════════

import {
  VerificationResult,
  VerificationStatus,
  RunMode,
  GateState,
  Checkpoint,
  RouteCorridor,
  GpsReadiness,
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

// ── Post-run verification ──

export function verifyRun(
  mode: RunMode,
  startGate: GateState,
  finishGate: GateState,
  checkpoints: Checkpoint[],
  corridor: RouteCorridor,
  gpsQuality: GpsReadiness,
  avgAccuracyM: number
): VerificationResult {
  const issues: string[] = [];
  let status: VerificationStatus = 'verified';

  if (mode === 'practice') {
    return buildResult({
      status: 'practice_only',
      mode,
      startGate,
      finishGate,
      checkpoints,
      corridor,
      gpsQuality,
      avgAccuracyM,
      issues: [],
      label: 'Trening',
      explanation: 'Zjazd treningowy. Nie zapisany na tablicę.',
      isLeaderboardEligible: false,
    });
  }

  if (!startGate.entered) {
    issues.push('Brak startu z bramki');
    status = 'outside_start_gate';
  }

  if (!finishGate.entered) {
    issues.push('Nie dotarłeś do mety');
    status = status === 'verified' ? 'outside_finish_gate' : status;
  }

  const passed = checkpoints.filter((c) => c.passed).length;
  const total = checkpoints.length;
  if (passed < total) {
    issues.push(`Pominięto ${total - passed} ${total - passed === 1 ? 'checkpoint' : 'checkpointy'}`);
    if (status === 'verified') status = 'missing_checkpoint';
  }

  const hasShortcut = corridor.deviations.some((d) => d.type === 'shortcut');
  const hasMajorDeviation = corridor.deviations.some((d) => d.type === 'major');
  if (hasShortcut) {
    issues.push('Wykryto skrót');
    if (status === 'verified') status = 'shortcut_detected';
  } else if (hasMajorDeviation) {
    issues.push('Zjechanie z trasy');
    if (status === 'verified') status = 'invalid_route';
  }

  if (corridor.coveragePercent < 80) {
    issues.push(`Tylko ${Math.round(corridor.coveragePercent)}% pokrycia trasy`);
    if (status === 'verified') status = 'invalid_route';
  }

  if (gpsQuality === 'weak' || avgAccuracyM > 15) {
    issues.push('Słaby sygnał GPS podczas zjazdu');
    if (status === 'verified') status = 'weak_signal';
  }

  const isVerified = status === 'verified';
  const label = isVerified ? 'Zweryfikowano' : statusToLabel(status);
  const explanation = isVerified
    ? `Czysta linia. ${passed}/${total} checkpointów.`
    : issues.join('. ') + '.';

  return buildResult({
    status,
    mode,
    startGate,
    finishGate,
    checkpoints,
    corridor,
    gpsQuality,
    avgAccuracyM,
    issues,
    label,
    explanation,
    isLeaderboardEligible: isVerified,
  });
}

function statusToLabel(status: VerificationStatus): string {
  switch (status) {
    case 'verified': return 'Zweryfikowano';
    case 'practice_only': return 'Trening';
    case 'invalid_route': return 'Błędna trasa';
    case 'weak_signal': return 'Słaby sygnał';
    case 'missing_checkpoint': return 'Pominięty checkpoint';
    case 'outside_start_gate': return 'Brak bramki startu';
    case 'outside_finish_gate': return 'Brak bramki mety';
    case 'shortcut_detected': return 'Wykryto skrót';
    case 'pending': return 'Weryfikacja...';
    default: return 'Nieznany';
  }
}

interface BuildParams {
  status: VerificationStatus;
  mode: RunMode;
  startGate: GateState;
  finishGate: GateState;
  checkpoints: Checkpoint[];
  corridor: RouteCorridor;
  gpsQuality: GpsReadiness;
  avgAccuracyM: number;
  issues: string[];
  label: string;
  explanation: string;
  isLeaderboardEligible: boolean;
}

function buildResult(p: BuildParams): VerificationResult {
  return {
    status: p.status,
    runMode: p.mode,
    isLeaderboardEligible: p.isLeaderboardEligible,
    startGate: p.startGate,
    finishGate: p.finishGate,
    checkpoints: p.checkpoints,
    checkpointsPassed: p.checkpoints.filter((c) => c.passed).length,
    checkpointsTotal: p.checkpoints.length,
    corridor: p.corridor,
    routeClean: p.corridor.deviations.length === 0,
    gpsQuality: p.gpsQuality,
    avgAccuracyM: p.avgAccuracyM,
    label: p.label,
    explanation: p.explanation,
    issues: p.issues,
  };
}
