// ═══════════════════════════════════════════════════════════
// Venue Registry — registers all known venues at import time
// ═══════════════════════════════════════════════════════════

import { registerVenue, getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail } from '../venueConfig';
import { SLOTWINY_CONFIG } from './slotwiny';
import { KASINA_CONFIG } from './kasina';

// ── Register all venues ──
registerVenue(SLOTWINY_CONFIG);
registerVenue(KASINA_CONFIG);

// ── Re-export for convenience ──
export { getVenue, getAllVenues, getVenueTrailGeo, getVenueForTrail, SLOTWINY_CONFIG, KASINA_CONFIG };
export type { VenueConfig, TrailGeo, VenueTrail, TerrainZone, LiftLine, GeoBounds } from '../venueConfig';
