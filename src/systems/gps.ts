// ═══════════════════════════════════════════════════════════
// GPS Tracking Service
// Real location capture using expo-location
// Foreground tracking for MVP — background later
// Field-test hardened: guards, cleanup, error logging
// ═══════════════════════════════════════════════════════════

import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { GpsState, GpsReadiness } from '@/data/verificationTypes';

export interface GpsPoint {
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  timestamp: number;
}

export interface GpsPermissionState {
  foreground: boolean;
  denied: boolean;
  restricted: boolean;
}

// ── Permission handling ──

export async function requestLocationPermission(): Promise<GpsPermissionState> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return {
      foreground: status === 'granted',
      denied: status === 'denied',
      restricted: status !== 'granted' && status !== 'denied',
    };
  } catch (e) {
    console.warn('[NWD] Location permission request failed:', e);
    return { foreground: false, denied: false, restricted: true };
  }
}

export async function checkLocationPermission(): Promise<GpsPermissionState> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return {
      foreground: status === 'granted',
      denied: status === 'denied',
      restricted: status !== 'granted' && status !== 'denied',
    };
  } catch (e) {
    console.warn('[NWD] Location permission check failed:', e);
    return { foreground: false, denied: false, restricted: true };
  }
}

// ── Current position ──

export async function getCurrentPosition(): Promise<GpsPoint | null> {
  try {
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.BestForNavigation,
    });
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      altitude: loc.coords.altitude,
      accuracy: loc.coords.accuracy,
      speed: loc.coords.speed,
      timestamp: loc.timestamp,
    };
  } catch (e) {
    console.warn('[NWD] getCurrentPosition failed:', e);
    return null;
  }
}

// ── GPS readiness from real data ──

export function assessGpsReadiness(accuracy: number | null): GpsReadiness {
  if (accuracy === null) return 'unavailable';
  if (accuracy > 30) return 'weak';
  if (accuracy > 15) return 'good';
  return 'excellent';
}

export function buildGpsState(point: GpsPoint | null): GpsState {
  if (!point) {
    return {
      readiness: 'unavailable',
      accuracy: null,
      satellites: 0,
      label: 'Brak GPS',
    };
  }
  const readiness = assessGpsReadiness(point.accuracy);
  return {
    readiness,
    accuracy: point.accuracy,
    satellites: 0, // not exposed by expo-location
    label: readiness === 'excellent' ? 'Silny sygnał' :
           readiness === 'good' ? 'Dobry sygnał' :
           readiness === 'weak' ? 'Słaby sygnał' : 'Brak GPS',
  };
}

// ── Distance calculation ──

export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371000;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

// ── Foreground location subscription ──

export type LocationCallback = (point: GpsPoint) => void;

let _subscription: Location.LocationSubscription | null = null;

export async function startTracking(
  callback: LocationCallback,
  intervalMs: number = 1000
): Promise<boolean> {
  // Guard: stop existing tracking if already active (prevent orphaned subscription)
  if (_subscription) {
    console.warn('[NWD] startTracking called while already tracking — stopping previous');
    stopTracking();
  }

  try {
    const perm = await checkLocationPermission();
    if (!perm.foreground) return false;

    // Chunk 10 §3.2: align foreground subscription with the background
    // recorder task. watchPositionAsync is foreground-only, so we can
    // only set the shared subset of options here; full background
    // hardening (activityType, foregroundService, deferredUpdatesInterval)
    // requires migrating useRealRun onto startLocationUpdatesAsync. That
    // migration is a Chunk 10.1 scope — we keep backward compat here to
    // avoid breaking the ranked-run flow that walk-test v4 just verified.
    _subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: intervalMs,
        // Chunk 10: deliver every sample so gpsHealthTracker can see the
        // real native cadence. The prior 5m dedup masked background
        // throttling gaps.
        distanceInterval: 0,
      },
      (loc) => {
        try {
          callback({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            altitude: loc.coords.altitude,
            accuracy: loc.coords.accuracy,
            speed: loc.coords.speed,
            timestamp: loc.timestamp,
          });
        } catch (e) {
          console.error('[NWD] GPS tracking callback error:', e);
        }
      }
    );
    return true;
  } catch (e) {
    console.error('[NWD] startTracking failed:', e);
    return false;
  }
}

export function stopTracking(): void {
  if (_subscription) {
    _subscription.remove();
    _subscription = null;
  }
}

// ── Point-in-zone check ──

export function isInZone(
  point: { latitude: number; longitude: number },
  zone: { latitude: number; longitude: number; radiusM: number }
): boolean {
  return distanceMeters(point, zone) <= zone.radiusM;
}
