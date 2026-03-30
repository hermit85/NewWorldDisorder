// ═══════════════════════════════════════════════════════════
// Slotwiny Arena — VenueConfig
//
// Adapts existing seed data to the VenueConfig interface.
// All geometry and metadata originates from slotwinyMap.ts
// and slotwinyOfficial.ts — this file is the bridge.
// ═══════════════════════════════════════════════════════════

import { VenueConfig } from '../venueConfig';
import { slotwinySpot, slotwinyTrails } from '../seed/slotwinyOfficial';
import {
  SLOTWINY_CENTER,
  SLOTWINY_REGION,
  LIFT_LINE,
  trailGeoSeeds,
  terrainZones as rawTerrainZones,
} from '../seed/slotwinyMap';

export const SLOTWINY_CONFIG: VenueConfig = {
  // Identity
  id: slotwinySpot.id,
  name: slotwinySpot.name,
  region: slotwinySpot.region,
  operator: slotwinySpot.operator,
  season: slotwinySpot.season,

  // Readiness
  rankingEnabled: true,

  // Geo
  center: SLOTWINY_CENTER,
  bounds: {
    latMin: 49.4100,
    latMax: 49.4275,
    lngMin: 20.9460,
    lngMax: 20.9630,
  },
  geofenceRadiusM: 1500,
  elevationM: 1114,

  // Map region
  mapRegion: SLOTWINY_REGION,

  // Trails — map OfficialTrail to VenueTrail
  trails: slotwinyTrails
    .filter((t) => t.isRaceTrail && t.isActive)
    .map((t) => ({
      id: t.id,
      name: t.officialName,
      difficulty: t.gameDifficulty,
      trailType: t.trailType,
      distanceM: t.distanceM,
      elevationDropM: t.elevationDropM,
      colorClass: t.colorClass,
      description: t.gameFlavor,
    })),

  // Trail geometry — pass through from seed
  trailGeo: trailGeoSeeds,

  // Terrain zones — pass through
  terrainZones: rawTerrainZones,

  // Lift lines
  liftLines: [
    {
      bottom: LIFT_LINE.bottom,
      top: LIFT_LINE.top,
      label: 'LIFT',
    },
  ],
};
