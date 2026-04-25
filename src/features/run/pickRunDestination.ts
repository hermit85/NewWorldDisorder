// ═══════════════════════════════════════════════════════════
// pickRunDestination — single source of truth for "tap JEDŹ
// on a trail card, where do I route?"
//
// Every non-tab screen that opens a run flow needs the same
// decision: draft trails (no Pioneer geometry yet) must go to
// /run/recording so useGPSRecorder can seed the geometry;
// calibrating / verified / locked trails go to /run/active
// which runs the approach navigator + gate engine over the
// existing Pioneer line.
//
// Chunk 10.2 added this helper after review flagged that
// /spot/[id].tsx and the old /trail/new.tsx both hard-coded
// '/run/active' for all trails, breaking the Pioneer loop for
// draft rows. Centralising the choice here prevents a third
// regression next time a new screen adds a "ride this trail"
// CTA.
// ═══════════════════════════════════════════════════════════

import type { Href } from 'expo-router';
import { logDebugEvent } from '@/systems/debugEvents';

/**
 * The fields we need from a Trail row to decide the route.
 * Kept structurally-typed so both the DB Trail shape and the
 * BikeParkTrailCardData shape satisfy it without a cast.
 */
export interface RunDestinationInput {
  trailId: string;
  spotId: string;
  trailName: string;
  /** 'draft' = no Pioneer geometry yet. Any other status implies
   *  geometry exists and the ranked/approach flow can run. */
  calibrationStatus: string;
  /** Optional belt-and-braces signal. When provided AND true we
   *  treat the trail as pre-calibration even if calibrationStatus
   *  somehow drifted. DB stamps both fields atomically but the
   *  trail card summary only carries calibrationStatus; the
   *  full Trail row carries geometryMissing too. */
  geometryMissing?: boolean;
  /**
   * B29: pre-declared run mode. Only applied when the destination
   * resolves to `/run/active` — the draft path (`/run/recording`)
   * has its own seed-run semantics and ignores intent. Callers
   * that can't infer a sensible choice should pass `'practice'`;
   * the rider can always escalate via trail detail's explicit
   * JEDŹ RANKINGOWO CTA.
   */
  intent?: 'ranked' | 'practice';
}

/**
 * Every calibration_status value the client currently understands.
 * Extend this list at the same time you extend the DB enum so the
 * guard below trips on an explicit code change, not a silent
 * production surprise.
 */
const KNOWN_CALIBRATION_STATUSES = [
  'draft',
  'fresh_pending_second_run',
  'live_fresh',
  'live_confirmed',
  'stable',
  'calibrating',
  'verified',
  'locked',
] as const;

function isKnownCalibrationStatus(value: string): boolean {
  return (KNOWN_CALIBRATION_STATUSES as readonly string[]).includes(value);
}

export function pickRunDestination(input: RunDestinationInput): Href {
  // Defense-in-depth: a future DB migration adding a new
  // calibration_status value must not silently fall through to
  // /run/active, because that screen builds a gate config from
  // Pioneer geometry and crashes on null. Route to /run/recording
  // instead (the safe seed path — worst case it re-seeds geometry
  // which the server can reject, versus a hard crash on active)
  // and tag the navigation payload with recovery='1' so a future
  // Sentry breadcrumb (S1.3) can tell this was a fallback, not a
  // normal Pioneer start.
  if (!isKnownCalibrationStatus(input.calibrationStatus)) {
    logDebugEvent('nav', 'pickRunDestination:unknown_status', 'warn', {
      trailId: input.trailId,
      payload: {
        received: input.calibrationStatus,
        known: KNOWN_CALIBRATION_STATUSES,
        spotId: input.spotId,
      },
    });
    console.warn(
      `[pickRunDestination] Unknown calibration_status: "${input.calibrationStatus}". ` +
        'Falling back to /run/recording (safe seed path).',
    );
    return {
      pathname: '/run/recording',
      params: {
        trailId: input.trailId,
        spotId: input.spotId,
        trailName: input.trailName,
        recovery: '1',
      },
    };
  }

  const isDraft =
    input.calibrationStatus === 'draft' || input.geometryMissing === true;

  if (isDraft) {
    return {
      pathname: '/run/recording',
      params: { trailId: input.trailId, spotId: input.spotId },
    };
  }

  // B29: default to practice when caller didn't pre-declare intent.
  // The /run/active guard alerts on missing intent and redirects to
  // trail detail, so a default keeps drive-by CTAs (spot card, map
  // pins) flowing while never silently upgrading a tap to ranked.
  // Ranked must be an explicit rider decision.
  const intent: 'ranked' | 'practice' = input.intent ?? 'practice';
  return {
    pathname: '/run/active',
    params: { trailId: input.trailId, trailName: input.trailName, intent },
  };
}
