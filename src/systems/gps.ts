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
let _backgroundTaskActive = false;

/**
 * Start GPS tracking for a ranked / practice run.
 *
 * Runs two parallel delivery paths so foreground latency stays tight
 * AND a backgrounded phone still collects samples:
 *   1. watchPositionAsync — foreground-only, fires the callback on
 *      every sample at near-zero latency. This is the hot path while
 *      the rider is holding the phone on the approach screen.
 *   2. startLocationUpdatesAsync — TaskManager-backed, keeps
 *      delivering after the app backgrounds (phone in pocket). Its
 *      handler pushes samples to realRunBackgroundBuffer; useRealRun's
 *      1 s tick drains that buffer and forwards new samples to the
 *      same processPoint pipeline. Task runs in both foreground and
 *      background — foreground duplicates are filtered by useRealRun
 *      via a monotonic-timestamp cursor so the gate engine sees each
 *      sample exactly once.
 */
export async function startTracking(
  callback: LocationCallback,
  intervalMs: number = 1000
): Promise<boolean> {
  if (_subscription) {
    console.warn('[NWD] startTracking called while already tracking — stopping previous');
    stopTracking();
  }

  try {
    const perm = await checkLocationPermission();
    if (!perm.foreground) return false;

    // Background permission is checked independently via the
    // LocationProvider api — `GpsPermissionState` only tracks the
    // foreground bit (Sprint 2 legacy). Read it live here so we
    // can decide whether to start the parallel TaskManager path.
    let hasBackground = false;
    try {
      const bg = await Location.getBackgroundPermissionsAsync();
      hasBackground = bg.status === 'granted';
    } catch {
      // Platform without background permissions (web fallback) or
      // an OS that revoked silently — treat as missing, foreground
      // tracking still runs.
      hasBackground = false;
    }

    _subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: intervalMs,
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

    // Start the parallel background task. Missing Always permission
    // is NOT a hard error here — foreground via watchPositionAsync
    // still works, we just lose the backgrounded-phone tracking. The
    // recording screen banner already warns the rider about the
    // tradeoff when Always is denied.
    if (hasBackground) {
      try {
        const { REAL_RUN_LOCATION_TASK_NAME } = await import('./realRunBackgroundTask');
        const running = await Location.hasStartedLocationUpdatesAsync(REAL_RUN_LOCATION_TASK_NAME);
        if (!running) {
          await Location.startLocationUpdatesAsync(REAL_RUN_LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.BestForNavigation,
            activityType: Location.LocationActivityType.Fitness,
            distanceInterval: 0,
            timeInterval: intervalMs,
            deferredUpdatesInterval: 0,
            pausesUpdatesAutomatically: false,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'NWD · zjazd aktywny',
              notificationBody: 'GPS śledzi twój zjazd',
            },
          });
        }
        _backgroundTaskActive = true;
      } catch (e) {
        // Background task failure is non-fatal — log and continue
        // with foreground-only tracking so the rider isn't blocked.
        if (__DEV__) console.warn('[NWD] startLocationUpdatesAsync failed:', e);
      }
    }

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
  if (_backgroundTaskActive) {
    _backgroundTaskActive = false;
    // Fire-and-forget — the task stop is asynchronous but the caller
    // already treats stopTracking as sync. A failure here leaves an
    // orphan task that the next startTracking will clean via the
    // hasStartedLocationUpdatesAsync check.
    void (async () => {
      try {
        const { REAL_RUN_LOCATION_TASK_NAME } = await import('./realRunBackgroundTask');
        const running = await Location.hasStartedLocationUpdatesAsync(REAL_RUN_LOCATION_TASK_NAME);
        if (running) {
          await Location.stopLocationUpdatesAsync(REAL_RUN_LOCATION_TASK_NAME);
        }
      } catch (e) {
        if (__DEV__) console.warn('[NWD] stopLocationUpdatesAsync failed:', e);
      }
    })();
  }
}

// ── Point-in-zone check ──

export function isInZone(
  point: { latitude: number; longitude: number },
  zone: { latitude: number; longitude: number; radiusM: number }
): boolean {
  return distanceMeters(point, zone) <= zone.radiusM;
}
