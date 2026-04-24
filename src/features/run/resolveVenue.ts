// ═══════════════════════════════════════════════════════════
// resolveVenue — single adapter over the two trail-context sources
//
// Historically the run layer had to look in two places for a trail's
// geometry / gate config / spot linkage:
//
//   1. A hardcoded static registry in src/data/venueConfig.ts
//      (Słotwiny legacy — seeded via registerVenue). Permanently
//      empty at runtime today, but the call sites still branch on
//      it as though it might not be.
//   2. The Supabase `trails` row + `trails.geometry` Pioneer payload,
//      fetched via useTrail + useTrailGeometry.
//
// Every consumer re-implemented the same "try static, fall back to
// DB, null otherwise" blob — ~40 lines per screen. If the precedence
// ever needs to change (e.g. DB-only after the static registry is
// deleted) we'd have to chase it through ~18 files.
//
// This module centralises that decision. Precedence is explicit and
// fixed here: static registry wins when populated (preserved for
// offline fixture / test / re-seed scenarios), DB fills the gap
// otherwise. The returned shape is source-agnostic so callers never
// have to re-check which path produced the data.
//
// Consumers still own their fetching (useTrail / useTrailGeometry)
// — this function takes the raw outputs and normalises them. It is
// deliberately a pure helper, not a hook, to avoid coupling the
// resolver to React's render cycle.
// ═══════════════════════════════════════════════════════════

import { getVenueForTrail, type TrailGeoSeed } from '@/data/venueConfig';
import {
  buildTrailGateConfigFromGeo,
  buildTrailGateConfigFromPioneer,
  buildTrailGeoFromPioneer,
} from './gates';
import type { TrailGateConfig } from './types';

export type VenueSource = 'static' | 'db' | 'none';

export interface ResolvedVenue {
  /** 'static' = venueConfig registry (Słotwiny legacy).
   *  'db' = Supabase trails + pioneer geometry.
   *  'none' = trail not found in either source. */
  source: VenueSource;
  /** Parent spot id. Empty string when unresolved — callers should
   *  treat this as "not ready" rather than a navigation target. */
  spotId: string;
  /** True when ranked runs are allowed on this venue. DB-sourced
   *  venues are ranked by default (no schema flag yet); static
   *  venues honour their `rankingEnabled` column. */
  rankingEnabled: boolean;
  /** Canonical polyline + start/finish zones for corridor scoring
   *  and gate engine seeding. Null when geometry isn't ready. */
  trailGeo: TrailGeoSeed | null;
  /** Derived line-crossing gate config. Null when geometry isn't
   *  ready, which the gate engine treats as unverified-only. */
  gateConfig: TrailGateConfig | null;
}

export interface ResolveVenueInput {
  trailId: string | null;
  trailName: string;
  /** From useTrail(trailId). Null while loading or for trails the
   *  current user can't see. */
  dbTrail: { spotId: string } | null;
  /** From useTrailGeometry(trailId). Raw JSON payload that
   *  buildTrailGeoFromPioneer knows how to parse. */
  pioneerGeometryRaw: unknown;
}

export function resolveVenue(input: ResolveVenueInput): ResolvedVenue {
  const { trailId, trailName, dbTrail, pioneerGeometryRaw } = input;
  if (!trailId) {
    return {
      source: 'none',
      spotId: '',
      rankingEnabled: false,
      trailGeo: null,
      gateConfig: null,
    };
  }

  // ── Static registry (legacy / offline fixture path) ──
  // Wins when present so a seeded venue can override DB geometry
  // during field testing. Permanently empty at production today.
  const staticMatch = getVenueForTrail(trailId);
  if (staticMatch) {
    const geo =
      staticMatch.venue.trailGeo.find((g) => g.trailId === trailId) ?? null;
    const gateConfig = geo
      ? buildTrailGateConfigFromGeo(trailId, trailName, geo)
      : null;
    return {
      source: 'static',
      spotId: staticMatch.venueId,
      rankingEnabled: staticMatch.venue.rankingEnabled,
      trailGeo: geo,
      gateConfig,
    };
  }

  // ── DB path (current production default) ──
  if (dbTrail) {
    return {
      source: 'db',
      spotId: dbTrail.spotId,
      rankingEnabled: true,
      trailGeo: buildTrailGeoFromPioneer(trailId, pioneerGeometryRaw),
      gateConfig: buildTrailGateConfigFromPioneer(
        trailId,
        trailName,
        pioneerGeometryRaw,
      ),
    };
  }

  return {
    source: 'none',
    spotId: '',
    rankingEnabled: false,
    trailGeo: null,
    gateConfig: null,
  };
}
