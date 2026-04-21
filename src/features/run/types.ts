// ═══════════════════════════════════════════════════════════
// Run Gate Engine — Type definitions
// Official start/finish gate system for gravity MTB
// ═══════════════════════════════════════════════════════════

import { GpsPoint } from '@/systems/gps';

// ── Gate Definition ──

export interface GateDefinition {
  /** Center of the gate line */
  center: { latitude: number; longitude: number };
  /** Bearing of the trail at gate in degrees (0-360, true north) */
  trailBearing: number;
  /** Width of the gate line perpendicular to trail bearing, meters */
  lineWidthM: number;
  /** Depth of the activation zone along trail direction, meters */
  zoneDepthM: number;
  /** Radius for initial proximity detection before precise crossing check */
  entryRadiusM: number;
  /** Heading tolerance for crossing validation, degrees */
  headingToleranceDeg: number;
  /** Minimum speed to trigger gate, km/h */
  minTriggerSpeedKmh: number;
}

// ── Gate Crossing Result ──

export interface GateCrossingResult {
  crossed: boolean;
  /** Point index where crossing was detected */
  crossingIndex: number | null;
  /** Timestamp of crossing */
  crossingTimestamp: number | null;
  /** Distance from gate center at crossing */
  distanceFromCenterM: number | null;
  /** Rider heading at crossing, degrees */
  riderHeadingDeg: number | null;
  /** Speed at crossing, km/h */
  speedAtCrossingKmh: number | null;
  /** Whether crossing came from the correct side */
  correctSide: boolean;
  /** Quality flags */
  flags: CrossingFlag[];
}

export type CrossingFlag =
  | 'perfect_crossing'
  | 'soft_crossing'       // within zone but not precise line cross
  | 'weak_accuracy'
  | 'wrong_side'
  | 'low_speed'
  | 'poor_heading'
  | 'fallback_proximity'  // finish only: close enough to count
  | 'suspicious_jump';

// ── Run Quality ──

export type RunQuality = 'perfect' | 'valid' | 'rough';

export interface RunQualityAssessment {
  quality: RunQuality;
  /** Internal reasons for quality degradation (not shown to user) */
  degradationReasons: DegradationReason[];
  /** Whether this run is eligible for leaderboard */
  leaderboardEligible: boolean;
  /** Human-readable summary */
  summary: string;
}

export type DegradationReason =
  | 'weak_gps_accuracy'
  | 'wrong_start_side'
  | 'low_start_speed'
  | 'poor_start_heading'
  | 'finish_fallback_used'
  | 'finish_wrong_side'
  | 'suspicious_position_jump'
  | 'backgrounded_during_run'
  | 'low_checkpoint_coverage'
  | 'corridor_deviation_minor';

// ── GPS Smoothing ──

export interface SmoothedPosition {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
  /** Number of samples used for smoothing */
  sampleCount: number;
}

// ── Anti-cheat ──

export interface AntiCheatResult {
  passed: boolean;
  flags: AntiCheatFlag[];
}

export type AntiCheatFlag =
  | 'heading_mismatch'      // riding wrong direction
  | 'impossible_speed'      // >100 km/h or similar
  | 'teleport_detected'     // >200m jump in 1 second
  | 'too_fast_finish'       // finished in impossibly short time
  | 'too_short_distance'    // didn't cover enough trail
  | 'stationary_run'        // barely moved
  | 'time_travel'           // timestamps going backwards
  | 'too_few_points';       // <10 GPS points — unreliable data

// ── Gate Engine State ──

export type GateEnginePhase =
  | 'idle'
  | 'armed'
  | 'approaching_start'
  | 'running'
  | 'approaching_finish'
  | 'finished'
  | 'cancelled'
  | 'expired';

export interface GateEngineState {
  phase: GateEnginePhase;
  /** Smoothed position buffer */
  positionBuffer: GpsPoint[];
  /** Current smoothed position */
  smoothedPosition: SmoothedPosition | null;
  /** Computed heading from last 2+ points */
  currentHeading: number | null;
  /** Computed speed km/h from last 2+ points */
  currentSpeedKmh: number | null;
  /** Start gate crossing result */
  startCrossing: GateCrossingResult | null;
  /** Finish gate crossing result */
  finishCrossing: GateCrossingResult | null;
  /** Accumulated distance in meters */
  totalDistanceM: number;
  /** Points collected during run */
  runPointCount: number;
  /** Auto-start timestamp (when start gate was crossed) */
  autoStartTimestamp: number | null;
  /** Auto-finish timestamp */
  autoFinishTimestamp: number | null;
}

// ── Trail Gate Config ──

export interface TrailGateConfig {
  trailId: string;
  trailName: string;
  /** Expected trail length in meters */
  expectedLengthM: number;
  /** Hard lockout before finish can even arm. */
  finishUnlockMinTimeSec: number;
  /** Minimum ridden distance before finish can arm. */
  finishUnlockMinDistanceM: number;
  /** Minimum run duration before finish allowed, seconds */
  minDurationSec: number;
  /** Minimum distance before finish allowed, as fraction of expected length */
  minDistanceFraction: number;
  startGate: GateDefinition;
  finishGate: GateDefinition;
}
