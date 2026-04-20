// ═══════════════════════════════════════════════════════════
// Venue Registry — permanently empty at import time
//
// The registerVenue API is retained on venueConfig.ts so Sprint 3
// can hydrate it from the DB (spots.center_lat/lng + trails.geometry).
// Until then: getAllVenues() returns [], getVenue()/getVenueForTrail()
// return undefined. Consumers already handle the empty case
// (useVenueContext short-circuits, home reads DB-sourced spot list).
//
// TODO Sprint 3: register venues dynamically from DB instead of
// hardcoding static configs.
// ═══════════════════════════════════════════════════════════

import { getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail } from '../venueConfig';

export { getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail };
export type { VenueConfig, TrailGeo, VenueTrail, TerrainZone, LiftLine, GeoBounds } from '../venueConfig';
