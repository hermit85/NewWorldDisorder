// ═══════════════════════════════════════════════════════════
// Mock verification scenarios for testing trust UI
// Each scenario simulates a different run outcome
// ═══════════════════════════════════════════════════════════

import {
  VerificationResult,
  TruthMapData,
  Checkpoint,
  GateState,
  RouteCorridor,
} from '../verificationTypes';
import { trailGeoSeeds } from '../seed/slotwinyMap';

const dzidaGeo = trailGeoSeeds.find((t) => t.trailId === 'dzida-czerwona')!;

// Helper: make checkpoints from a trail's polyline
function makeCheckpoints(trailId: string, passed: boolean[]): Checkpoint[] {
  const geo = trailGeoSeeds.find((t) => t.trailId === trailId) ?? dzidaGeo;
  const poly = geo.polyline;
  const count = passed.length;
  return passed.map((p, i) => {
    const idx = Math.floor(((i + 1) / (count + 1)) * poly.length);
    return {
      id: `cp-${i + 1}`,
      label: `CP ${i + 1}`,
      coordinate: poly[Math.min(idx, poly.length - 1)],
      radiusM: 20,
      passed: p,
      passedAt: p ? Date.now() - (count - i) * 15000 : null,
    };
  });
}

function gate(entered: boolean, coord: { latitude: number; longitude: number }): GateState {
  return {
    entered,
    enteredAt: entered ? Date.now() - 120000 : null,
    coordinate: coord,
    radiusM: 30,
  };
}

function cleanCorridor(): RouteCorridor {
  return { maxDeviationM: 8, coveragePercent: 97, deviations: [] };
}

// ── Scenario 1: Verified — clean ranked run ──

export const verifiedClean: VerificationResult = {
  status: 'verified',
  runMode: 'ranked',
  isLeaderboardEligible: true,
  startGate: gate(true, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [true, true, true]),
  checkpointsPassed: 3,
  checkpointsTotal: 3,
  corridor: cleanCorridor(),
  routeClean: true,
  gpsQuality: 'good',
  avgAccuracyM: 4.2,
  label: 'Verified',
  explanation: 'Clean line. 3/3 checkpoints.',
  issues: [],
};

// ── Scenario 2: Practice only ──

export const practiceRun: VerificationResult = {
  status: 'practice_only',
  runMode: 'practice',
  isLeaderboardEligible: false,
  startGate: gate(true, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [true, true, true]),
  checkpointsPassed: 3,
  checkpointsTotal: 3,
  corridor: cleanCorridor(),
  routeClean: true,
  gpsQuality: 'good',
  avgAccuracyM: 5.1,
  label: 'Practice Only',
  explanation: 'Practice run. Not submitted to leaderboard.',
  issues: [],
};

// ── Scenario 3: Weak GPS signal ──

export const weakSignal: VerificationResult = {
  status: 'weak_signal',
  runMode: 'ranked',
  isLeaderboardEligible: false,
  startGate: gate(true, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [true, true, false]),
  checkpointsPassed: 2,
  checkpointsTotal: 3,
  corridor: { maxDeviationM: 25, coveragePercent: 72, deviations: [] },
  routeClean: false,
  gpsQuality: 'weak',
  avgAccuracyM: 18.5,
  label: 'Weak Signal',
  explanation: 'Weak GPS signal during run. 1 checkpoint missed.',
  issues: ['Weak GPS signal during run', '1 checkpoint missed'],
};

// ── Scenario 4: Missing checkpoint ──

export const missingCheckpoint: VerificationResult = {
  status: 'missing_checkpoint',
  runMode: 'ranked',
  isLeaderboardEligible: false,
  startGate: gate(true, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [true, false, true]),
  checkpointsPassed: 2,
  checkpointsTotal: 3,
  corridor: {
    maxDeviationM: 35,
    coveragePercent: 85,
    deviations: [{ startIndex: 4, endIndex: 6, maxDeviationM: 35, type: 'minor' }],
  },
  routeClean: false,
  gpsQuality: 'good',
  avgAccuracyM: 5.8,
  label: 'Checkpoint Missed',
  explanation: '1 checkpoint missed. Minor off-route section.',
  issues: ['1 checkpoint missed', 'Off-route at checkpoint 2 area'],
};

// ── Scenario 5: Shortcut detected ──

export const shortcutDetected: VerificationResult = {
  status: 'shortcut_detected',
  runMode: 'ranked',
  isLeaderboardEligible: false,
  startGate: gate(true, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [true, false, true]),
  checkpointsPassed: 2,
  checkpointsTotal: 3,
  corridor: {
    maxDeviationM: 80,
    coveragePercent: 65,
    deviations: [{ startIndex: 3, endIndex: 7, maxDeviationM: 80, type: 'shortcut' }],
  },
  routeClean: false,
  gpsQuality: 'good',
  avgAccuracyM: 4.5,
  label: 'Shortcut Detected',
  explanation: 'Shortcut detected. Route cut between CP1 and CP3.',
  issues: ['Shortcut detected', '1 checkpoint missed', 'Only 65% route coverage'],
};

// ── Scenario 6: Outside start gate ──

export const outsideStartGate: VerificationResult = {
  status: 'outside_start_gate',
  runMode: 'ranked',
  isLeaderboardEligible: false,
  startGate: gate(false, dzidaGeo.startZone),
  finishGate: gate(true, dzidaGeo.finishZone),
  checkpoints: makeCheckpoints('dzida-czerwona', [false, true, true]),
  checkpointsPassed: 2,
  checkpointsTotal: 3,
  corridor: { maxDeviationM: 12, coveragePercent: 88, deviations: [] },
  routeClean: true,
  gpsQuality: 'good',
  avgAccuracyM: 5.0,
  label: 'No Start Gate',
  explanation: 'Did not enter start gate. Run not counted.',
  issues: ['Did not enter start gate', '1 checkpoint missed'],
};

// ── All scenarios ──

export const verificationScenarios = {
  verifiedClean,
  practiceRun,
  weakSignal,
  missingCheckpoint,
  shortcutDetected,
  outsideStartGate,
};

export type VerificationScenarioId = keyof typeof verificationScenarios;

export const getVerificationScenario = (id: VerificationScenarioId) =>
  verificationScenarios[id];

// ── Mock truth map data ──

function offsetLine(
  line: { latitude: number; longitude: number }[],
  maxOffset: number,
  deviationIndices?: number[]
): { latitude: number; longitude: number }[] {
  return line.map((p, i) => {
    const isDeviation = deviationIndices?.includes(i);
    const offset = isDeviation
      ? maxOffset * (Math.random() * 0.5 + 0.5)
      : maxOffset * 0.15 * (Math.random() - 0.5);
    return {
      latitude: p.latitude + offset * 0.00001,
      longitude: p.longitude + offset * 0.00001,
    };
  });
}

export function buildTruthMapData(
  trailId: string,
  scenario: VerificationResult
): TruthMapData {
  const geo = trailGeoSeeds.find((t) => t.trailId === trailId) ?? dzidaGeo;
  const deviationIndices = scenario.corridor.deviations.flatMap((d) => {
    const indices: number[] = [];
    for (let i = d.startIndex; i <= d.endIndex && i < geo.polyline.length; i++) {
      indices.push(i);
    }
    return indices;
  });

  return {
    officialLine: geo.polyline,
    riderLine: offsetLine(geo.polyline, scenario.routeClean ? 2 : 8, deviationIndices),
    startGate: scenario.startGate,
    finishGate: scenario.finishGate,
    checkpoints: scenario.checkpoints,
    deviations: scenario.corridor.deviations,
    verification: scenario,
  };
}
