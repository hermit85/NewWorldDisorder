// ═══════════════════════════════════════════════════════════
// Venue Detection — venue-aware and start-zone-aware state
// Uses seed data for geofences and start gates
// Lightweight spatial logic, not heavy GIS
// ═══════════════════════════════════════════════════════════

import { distanceMeters } from './gps';
import { getTrailGeo } from '@/data/seed/slotwinyMap';
import { logDebugEvent } from './debugEvents';

// ── Venue geofence definitions ──
// Radius-based for MVP. Center + radius derived from seed data.

export interface VenueGeofence {
  id: string;
  name: string;
  center: { latitude: number; longitude: number };
  radiusM: number;
}

export const VENUE_GEOFENCES: VenueGeofence[] = [
  {
    id: 'slotwiny-arena',
    name: 'Słotwiny Arena',
    center: { latitude: 49.4185, longitude: 20.9575 },
    radiusM: 1500, // covers the full venue area (top station to parking)
  },
];

// ── Start zone definitions (derived from trail seed data) ──

export interface StartZone {
  trailId: string;
  trailName: string;
  center: { latitude: number; longitude: number };
  radiusM: number;
  venueId: string;
}

// Build start zones from seed data
export function getStartZones(): StartZone[] {
  const trailNames: Record<string, string> = {
    'galgan-niebieska': 'Gałgan Niebieska',
    'dookola-swiata-zielona': 'Dookoła Świata Zielona',
    'kometa-niebieska': 'Kometa Niebieska',
    'dzida-czerwona': 'Dzida Czerwona',
  };

  const zones: StartZone[] = [];
  for (const [trailId, name] of Object.entries(trailNames)) {
    const geo = getTrailGeo(trailId);
    if (geo) {
      zones.push({
        trailId,
        trailName: name,
        center: { latitude: geo.startZone.latitude, longitude: geo.startZone.longitude },
        radiusM: geo.startZone.radiusM,
        venueId: 'slotwiny-arena',
      });
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
  for (const venue of VENUE_GEOFENCES) {
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
