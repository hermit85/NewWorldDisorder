// ═══════════════════════════════════════════════════════════
// Venue Detection — venue-aware and start-zone-aware state
// Uses seed data for geofences and start gates
// Lightweight spatial logic, not heavy GIS
// ═══════════════════════════════════════════════════════════

import { distanceMeters } from './gps';
import { getAllVenues } from '@/data/venues';
import { logDebugEvent } from './debugEvents';

// ── Venue geofence definitions ──
// Built dynamically from venue registry

export interface VenueGeofence {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusM: number;
}

// Build geofences from all registered venues
export function getVenueGeofences(): VenueGeofence[] {
  return getAllVenues().map((v) => ({
    id: v.id,
    name: v.name,
    center: v.center,
    radiusM: v.geofenceRadiusM,
  }));
}

// Legacy export for compatibility
export const VENUE_GEOFENCES: VenueGeofence[] = getVenueGeofences();

// ── Start zone definitions (derived from venue registry) ──

export interface StartZone {
  trailId: string;
  trailName: string;
  center: { latitude: number; longitude: number };
  radiusM: number;
  venueId: string;
}

// Build start zones from ALL registered venues
export function getStartZones(): StartZone[] {
  const zones: StartZone[] = [];
  for (const venue of getAllVenues()) {
    for (const trail of venue.trails) {
      const geo = venue.trailGeo.find((g) => g.trailId === trail.id);
      if (geo) {
        zones.push({
          trailId: trail.id,
          trailName: trail.name,
          center: { latitude: geo.startZone.latitude, longitude: geo.startZone.longitude },
          radiusM: geo.startZone.radiusM,
          venueId: venue.id,
        });
      }
    }
  }
  return zones;
}

// ── Detection results ──

export interface VenueDetectionResult {
  venueId: string | null;
  venueName: string | null;
  distanceToVenueM: number | null;
  isInsideVenue: boolean;
}

export interface StartZoneResult {
  trailId: string;
  trailName: string;
  distanceM: number;
}

export interface StartZoneDetectionResult {
  nearestStart: StartZoneResult | null;
  isAtStart: boolean;      // within gate radius
  isNearStart: boolean;    // within 200m — close enough for contextual prompt
  ambiguous: boolean;      // multiple trails within 60m — can't tell which one
  alternatives: StartZoneResult[];
}

// ── Detection functions ──

export function detectVenue(
  lat: number,
  lng: number,
): VenueDetectionResult {
  for (const venue of getVenueGeofences()) {
    const dist = distanceMeters(
      { latitude: lat, longitude: lng },
      venue.center,
    );
    if (dist <= venue.radiusM) {
      return {
        venueId: venue.id,
        venueName: venue.name,
        distanceToVenueM: Math.round(dist),
        isInsideVenue: true,
      };
    }
  }
  return { venueId: null, venueName: null, distanceToVenueM: null, isInsideVenue: false };
}

export function detectStartZone(
  lat: number,
  lng: number,
): StartZoneDetectionResult {
  const zones = getStartZones();
  const results: StartZoneResult[] = [];

  for (const zone of zones) {
    const dist = distanceMeters(
      { latitude: lat, longitude: lng },
      zone.center,
    );
    results.push({
      trailId: zone.trailId,
      trailName: zone.trailName,
      distanceM: Math.round(dist),
    });
  }

  // Sort by distance
  results.sort((a, b) => a.distanceM - b.distanceM);

  const nearest = results[0] ?? null;
  if (!nearest) {
    return { nearestStart: null, isAtStart: false, isNearStart: false, ambiguous: false, alternatives: [] };
  }

  const isAtStart = nearest.distanceM <= 35; // slightly larger than gate radius for comfort
  const isNearStart = nearest.distanceM <= 200;

  // Check ambiguity: if 2+ trails within 60m, can't confidently pick one
  const closeTrails = results.filter(r => r.distanceM <= 60);
  const ambiguous = closeTrails.length > 1;

  return {
    nearestStart: nearest,
    isAtStart,
    isNearStart,
    ambiguous,
    alternatives: ambiguous ? closeTrails : [],
  };
}

// ── Combined context ──

export interface VenueContext {
  venue: VenueDetectionResult;
  startZone: StartZoneDetectionResult;
}

export function getVenueContext(lat: number, lng: number): VenueContext {
  const venue = detectVenue(lat, lng);
  const startZone = detectStartZone(lat, lng);

  logDebugEvent('venue', 'context_computed', 'info', {
    payload: {
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
      insideVenue: venue.isInsideVenue,
      venueId: venue.venueId,
      distToVenue: venue.distanceToVenueM,
      nearestTrail: startZone.nearestStart?.trailId ?? null,
      nearestDist: startZone.nearestStart?.distanceM ?? null,
      isAtStart: startZone.isAtStart,
      isNearStart: startZone.isNearStart,
      ambiguous: startZone.ambiguous,
    },
  });

  return { venue, startZone };
}
