// ═══════════════════════════════════════════════════════════
// Approach Navigator — 5-state machine driving pre-run guidance
//
// Walk-test v4 uncovered that the gate engine (Chunk 8) works but users
// had no navigation to the start point. This module produces a legible
// state the UI can render: "go that way (far) · close up (near) · you're
// ready · turn around (wrong side) · GPS is weak".
//
// Pure function, no side effects. The gate engine is still the source
// of truth for crossing detection; ApproachNavigator only ARMS the gate
// engine by reporting on_line_ready.
//
// Reference: docs/nwd-architecture-spec-v3-amendment.md section 2.
// ═══════════════════════════════════════════════════════════

import { distanceMeters } from '@/systems/gps';
import { computeHeading, headingDifference } from './geometry';
import {
  GATE_APPROACH_NEAR_M,
  GATE_APPROACH_READY_M,
  APPROACH_UNSURE_ACCURACY_M,
  GATE_HEADING_TOLERANCE_DEG,
} from './gates';
import type { TrailGateConfig } from './types';

// ── Types ──

export type LatLng = { latitude: number; longitude: number };

/**
 * 5 discrete states the user can be in relative to a trail start gate.
 * Every state carries exactly the data the UI needs to render — no
 * downstream computation required.
 */
export type ApproachState =
  | { kind: 'far'; distanceM: number; bearingToStart: number }
  | {
      kind: 'near';
      distanceM: number;
      bearingToStart: number;
      headingDeltaDeg: number;
    }
  | { kind: 'on_line_ready'; accuracyM: number }
  | {
      kind: 'wrong_side';
      bearingExpected: number;
      headingActual: number;
    }
  | { kind: 'gps_unsure'; accuracyM: number };

export interface ApproachNavigatorInput {
  userPosition: LatLng;
  /** Device heading in degrees [0, 360) or null when compass is unavailable */
  userHeading: number | null;
  /** Reported GPS horizontal accuracy in meters (lower = better) */
  userAccuracyM: number;
  /** Current speed over ground in m/s (used downstream by gate engine, not by this function) */
  userVelocityMps: number;
  trailGate: TrailGateConfig;
}

// ── Main function ──

/**
 * Resolve the rider's approach state relative to the start gate.
 *
 * Ordering of checks is intentional and matches spec v3 section 2.2:
 * 1. GPS-unsure overrides everything — honesty about uncertainty beats
 *    guessing at direction. Position data at >6m accuracy is unreliable
 *    for the 3m "on line" radius we use downstream.
 * 2. Distance buckets drive the next three kinds (far / near / ready).
 * 3. Within the ready radius, heading tolerance separates on_line_ready
 *    from wrong_side so users get "turn around" rather than a silent
 *    non-arm.
 */
export function computeApproachState(input: ApproachNavigatorInput): ApproachState {
  const { userPosition, userHeading, userAccuracyM, trailGate } = input;

  // 1. GPS quality gate — only block the approach UI at APPROACH_UNSURE_
  //    ACCURACY_M (20m). Tighter accuracy is still surfaced via the
  //    ±Nm readout on GOTOWY so the rider can judge signal quality,
  //    but the navigator doesn't refuse to guide them. Gate engine's
  //    crossing-quality assessment still uses GATE_ACCURACY_REQUIRED_M.
  if (userAccuracyM > APPROACH_UNSURE_ACCURACY_M) {
    return { kind: 'gps_unsure', accuracyM: userAccuracyM };
  }

  // 2. Distance + bearing to the start gate. Euclidean distance is the
  //    user-legible "how far do I walk" number; the gate engine handles
  //    the precise perpendicular check for line crossing.
  const gateCenter = trailGate.startGate.center;
  const distanceM = distanceMeters(userPosition, gateCenter);
  const bearingToStart = computeHeading(userPosition, gateCenter);

  // 3. FAR — user is outside the approach cone. Show compass + distance.
  if (distanceM > GATE_APPROACH_NEAR_M) {
    return { kind: 'far', distanceM, bearingToStart };
  }

  // 4. Heading delta against the trail entry bearing. When the compass
  //    is missing (e.g. pre-iOS heading permission, simulator) we treat
  //    heading as aligned — otherwise the user would be trapped in
  //    wrong_side with no recourse.
  const expectedBearing = trailGate.startGate.trailBearing;
  const headingDeltaDeg =
    userHeading != null ? headingDifference(userHeading, expectedBearing) : 0;

  // 5. NEAR — inside approach cone but not yet on the line. Mini-map +
  //    headingDelta lets the UI draw an arrow hint even before on_line_ready.
  if (distanceM > GATE_APPROACH_READY_M) {
    return {
      kind: 'near',
      distanceM,
      bearingToStart,
      headingDeltaDeg,
    };
  }

  // 6. WRONG_SIDE — on the line radius but facing the wrong way. Only
  //    trigger when we actually have a heading reading; unknown heading
  //    at <3m falls through to on_line_ready (optimistic).
  if (userHeading != null && headingDeltaDeg > GATE_HEADING_TOLERANCE_DEG) {
    return {
      kind: 'wrong_side',
      bearingExpected: expectedBearing,
      headingActual: userHeading,
    };
  }

  // 7. ON_LINE_READY — gate engine may arm. Accuracy passed through so
  //    the UI can keep showing the ±Nm indicator.
  return { kind: 'on_line_ready', accuracyM: userAccuracyM };
}
