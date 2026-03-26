// ═══════════════════════════════════════════════════════════
// Gate Engine Debug — human-readable state for debug overlay
// ═══════════════════════════════════════════════════════════

import { GateEngineState, GateCrossingResult, RunQualityAssessment, CrossingFlag, DegradationReason } from './types';

export interface GateDebugInfo {
  phase: string;
  bufferSize: number;
  heading: string;
  speedKmh: string;
  totalDistanceM: string;
  runPoints: number;
  startCrossing: string;
  startFlags: string;
  finishCrossing: string;
  finishFlags: string;
  autoStartTs: string;
  autoFinishTs: string;
}

export function formatGateDebug(state: GateEngineState): GateDebugInfo {
  return {
    phase: state.phase,
    bufferSize: state.positionBuffer.length,
    heading: state.currentHeading !== null ? `${state.currentHeading.toFixed(0)}°` : 'n/a',
    speedKmh: state.currentSpeedKmh !== null ? `${state.currentSpeedKmh.toFixed(1)} km/h` : 'n/a',
    totalDistanceM: `${state.totalDistanceM.toFixed(0)}m`,
    runPoints: state.runPointCount,
    startCrossing: formatCrossing(state.startCrossing),
    startFlags: state.startCrossing?.flags.join(', ') ?? 'none',
    finishCrossing: formatCrossing(state.finishCrossing),
    finishFlags: state.finishCrossing?.flags.join(', ') ?? 'none',
    autoStartTs: state.autoStartTimestamp ? new Date(state.autoStartTimestamp).toISOString().slice(11, 23) : 'n/a',
    autoFinishTs: state.autoFinishTimestamp ? new Date(state.autoFinishTimestamp).toISOString().slice(11, 23) : 'n/a',
  };
}

function formatCrossing(c: GateCrossingResult | null): string {
  if (!c) return 'not checked';
  if (!c.crossed) return 'not crossed';
  return `✓ dist=${c.distanceFromCenterM?.toFixed(0)}m hdg=${c.riderHeadingDeg?.toFixed(0)}° spd=${c.speedAtCrossingKmh?.toFixed(0)}km/h`;
}

export function formatQualityDebug(q: RunQualityAssessment): string {
  return [
    `quality=${q.quality}`,
    `eligible=${q.leaderboardEligible}`,
    `reasons=[${q.degradationReasons.join(', ')}]`,
    q.summary,
  ].join(' | ');
}
