// ═══════════════════════════════════════════════════════════
// Verification & Trust Types
// MVP trust layer for ranked competition
// ═══════════════════════════════════════════════════════════

// ── Run modes ──

export type RunMode = 'ranked' | 'practice';

// ── GPS readiness ──

export type GpsReadiness =
  | 'unavailable'
  | 'locking'
  | 'weak'
  | 'good'
  | 'excellent';

export interface GpsState {
  readiness: GpsReadiness;
  accuracy: number | null; // meters, null if unavailable
  satellites: number;
  label: string;
}

// ── Pre-run readiness ──

export type ReadinessStatus =
  | 'gps_locking'
  | 'weak_signal'
  | 'move_to_start'
  | 'ranked_ready'
  | 'practice_only'
  | 'start_gate_reached';

export interface PreRunReadiness {
  status: ReadinessStatus;
  gps: GpsState;
  inStartGate: boolean;
  rankedEligible: boolean;
  distanceToStartM: number | null;
  message: string;
  ctaLabel: string;
  ctaEnabled: boolean;
}

// ── Checkpoints ──

export interface Checkpoint {
  id: string;
  label: string;
  coordinate: { latitude: number; longitude: number };
  radiusM: number;
  passed: boolean;
  passedAt: number | null; // timestamp
}

// ── Route corridor ──

export interface RouteCorridor {
  maxDeviationM: number; // max allowed deviation from official line
  coveragePercent: number; // % of route corridor covered
  deviations: RouteDeviation[];
}

export interface RouteDeviation {
  startIndex: number;
  endIndex: number;
  maxDeviationM: number;
  type: 'minor' | 'major' | 'shortcut';
}

// ── Gate state ──

export interface GateState {
  entered: boolean;
  enteredAt: number | null;
  coordinate: { latitude: number; longitude: number };
  radiusM: number;
}

export type AcceptedVia =
  | 'gate_cross'
  | 'corridor_rescue'
  | 'manual'
  | null;

// ── Verification result ──

export type VerificationStatus =
  | 'verified'
  | 'practice_only'
  | 'invalid_route'
  | 'weak_signal'
  | 'missing_checkpoint'
  | 'outside_start_gate'
  | 'outside_finish_gate'
  | 'shortcut_detected'
  | 'pending';

export interface VerificationResult {
  status: VerificationStatus;
  runMode: RunMode;
  isLeaderboardEligible: boolean;
  acceptedVia?: AcceptedVia;

  // Gate checks
  startGate: GateState;
  finishGate: GateState;

  // Checkpoint checks
  checkpoints: Checkpoint[];
  checkpointsPassed: number;
  checkpointsTotal: number;

  // Route integrity
  corridor: RouteCorridor;
  routeClean: boolean;

  // GPS quality
  gpsQuality: GpsReadiness;
  avgAccuracyM: number;

  // Summary
  label: string; // "Verified", "Practice Only", etc.
  explanation: string; // "Clean line. 3/3 checkpoints."
  issues: string[]; // ["Off-route at km 0.8", "Checkpoint 2 missed"]

  // Chunk 10 §3.3: GPS signal observability. Populated by
  // gpsHealthTracker at run finalization; spread through into
  // runs.verification_summary so the run_kpi_daily and
  // verified_pass_rate_weekly views can surface KPI trends.
  gpsHealth?: import('@/features/run/gpsHealthTracker').GpsHealthSummary;

  // B23 telemetry: per-run gate crossing diagnostics. Populated by
  // useRealRun at finalization from `gateEngine.getDiagnostics()`. Lets
  // us answer "why did auto-start fail?" from `runs.verification_summary`
  // alone, without needing the debug overlay live. Fields are a
  // snapshot of the *last* attempt plus a cumulative attempt count,
  // since keeping every attempt would balloon the trace — the last one
  // is the most informative for a failed run and the counter tells us
  // whether the engine was even active. Sampling rate lives on the
  // existing `gpsHealth.samplesPerSec` — deliberately not duplicated here.
  gateDiagnostics?: import('@/features/run/useRunGateEngine').GateDiagnostics;
}

// ── Truth map payload ──

export interface TruthMapData {
  officialLine: { latitude: number; longitude: number }[];
  riderLine: { latitude: number; longitude: number }[];
  startGate: GateState;
  finishGate: GateState;
  checkpoints: Checkpoint[];
  deviations: RouteDeviation[];
  verification: VerificationResult;
}

// ── Extended run state phases ──

export type RunPhaseV2 =
  | 'idle'
  | 'readiness_check'
  | 'armed_ranked'
  | 'armed_practice'
  | 'countdown'
  | 'running_ranked'
  | 'running_practice'
  | 'finishing'
  | 'verifying'
  | 'completed_verified'
  | 'completed_unverified'
  | 'invalidated'
  | 'error';
