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
}

export function pickRunDestination(input: RunDestinationInput): Href {
  const isDraft =
    input.calibrationStatus === 'draft' || input.geometryMissing === true;

  if (isDraft) {
    return {
      pathname: '/run/recording',
      params: { trailId: input.trailId, spotId: input.spotId },
    };
  }

  return {
    pathname: '/run/active',
    params: { trailId: input.trailId, trailName: input.trailName },
  };
}
