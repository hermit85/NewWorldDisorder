// ═══════════════════════════════════════════════════════════
// VenueConfig — multi-arena configuration system
//
// Each arena defines its geometry, trails, and presentation
// data in a single config object. This is the source of truth
// for all venue-specific rendering and logic.
// ═══════════════════════════════════════════════════════════

import { Difficulty, TrailType } from './types';

// ── Geo primitives ──

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeoBounds {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
}

export interface GeoZone extends GeoPoint {
  radiusM: number;
}

// ── Trail geometry ──

export interface TrailGeo {
  trailId: string;
  startZone: GeoZone;
  finishZone: GeoZone;
  polyline: GeoPoint[];
  labelAnchor?: GeoPoint;
}

/** Alias kept for run-layer modules that predate the venue registry.
 *  Structurally identical to TrailGeo. */
export type TrailGeoSeed = TrailGeo;

// ── Trail metadata ──

export interface VenueTrail {
  id: string;
  name: string;
  difficulty: Difficulty;
  trailType: TrailType;
  distanceM: number;
  elevationDropM: number;
  colorClass?: string;
  description?: string;
}

// ── Terrain zones (presentation only) ──

export interface TerrainZone {
  id: string;
  type: 'forest' | 'openSlope' | 'summit' | 'base';
  polygon: GeoPoint[];
}

// ── Lift line ──

export interface LiftLine {
  bottom: GeoPoint;
  top: GeoPoint;
  label?: string;
}

// ── The main config ──

export interface VenueConfig {
  // Identity
  id: string;
  name: string;
  region: string;
  operator?: string;
  season: { id: string; name: string; label: string };

  // Readiness
  /** Whether ranked/verified runs count toward leaderboard at this venue */
  rankingEnabled: boolean;
  /** Short user-facing note when ranking is disabled (e.g. "Walidacja treningowa") */
  rankingDisabledReason?: string;

  // Geo
  center: GeoPoint;
  bounds: GeoBounds;
  geofenceRadiusM: number;
  elevationM?: number;

  // Trails
  trails: VenueTrail[];
  trailGeo: TrailGeo[];

  // Presentation
  terrainZones: TerrainZone[];
  liftLines: LiftLine[];

  // Map region for native MapView (optional fallback)
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

// ═══════════════════════════════════════════════════════════
// VENUE REGISTRY
// ═══════════════════════════════════════════════════════════

const _venues = new Map<string, VenueConfig>();

export function registerVenue(config: VenueConfig): void {
  _venues.set(config.id, config);
}

export function getVenue(id: string): VenueConfig | undefined {
  return _venues.get(id);
}

export function getAllVenues(): VenueConfig[] {
  return Array.from(_venues.values());
}

export function getVenueTrailGeo(venueId: string, trailId: string): TrailGeo | undefined {
  const venue = _venues.get(venueId);
  return venue?.trailGeo.find((t) => t.trailId === trailId);
}

/** Resolve trailId → venueId + venue config. Returns undefined if trail not found in any venue. */
export function getVenueForTrail(trailId: string): { venueId: string; venue: VenueConfig } | undefined {
  for (const venue of _venues.values()) {
    if (venue.trails.some((t) => t.id === trailId) || venue.trailGeo.some((g) => g.trailId === trailId)) {
      return { venueId: venue.id, venue };
    }
  }
  return undefined;
}
