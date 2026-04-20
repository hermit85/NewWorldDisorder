// ═══════════════════════════════════════════════════════════
// Venue Registry — registerVenue calls removed (Checkpoint B)
//
// Until Sprint 3 wires a DB-backed registry, no venues are
// registered at import time. getAllVenues() returns [] and
// getVenue()/getVenueForTrail() return undefined. Consumers
// already handle the empty case (useVenueContext short-circuits,
// home falls back to DB-sourced spot list).
//
// The SLOTWINY_CONFIG / KASINA_CONFIG re-exports remain as
// tombstones — dead dependents in mock/ still reference them
// until Checkpoint C wipes mock/ in one sweep.
//
// TODO Sprint 3: replace static configs with a DB-backed dynamic
// registry sourced from spots.center_lat/lng + trails.geometry.
// ═══════════════════════════════════════════════════════════

import { getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail } from '../venueConfig';
import { SLOTWINY_CONFIG } from './slotwiny';
import { KASINA_CONFIG } from './kasina';

// Registry deliberately left empty — no registerVenue calls.

export { getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail, SLOTWINY_CONFIG, KASINA_CONFIG };
export type { VenueConfig, TrailGeo, VenueTrail, TerrainZone, LiftLine, GeoBounds } from '../venueConfig';
