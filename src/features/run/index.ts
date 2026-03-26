// ═══════════════════════════════════════════════════════════
// Run Gate Engine — public API
// Official start/finish gate system for NWD gravity MTB
// ═══════════════════════════════════════════════════════════

export { useRunGateEngine } from './useRunGateEngine';
export type { GateEngine, GateEngineCallbacks } from './useRunGateEngine';

export { getTrailGateConfig, getAllTrailGateConfigs } from './gates';
export { detectGateCrossing, smoothPosition, computeHeading, computeSpeedKmh } from './geometry';
export { runAntiCheat } from './antiCheat';
export { assessRunQuality } from './quality';
export { formatGateDebug, formatQualityDebug } from './debug';

export type {
  GateDefinition,
  GateCrossingResult,
  CrossingFlag,
  RunQuality,
  RunQualityAssessment,
  DegradationReason,
  SmoothedPosition,
  AntiCheatResult,
  AntiCheatFlag,
  GateEnginePhase,
  GateEngineState,
  TrailGateConfig,
} from './types';
