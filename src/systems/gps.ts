// ═══════════════════════════════════════════════════════════
// GPS Tracking Service
// Real location capture using expo-location
// Foreground tracking for MVP — background later
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
  } catch {
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
  } catch {
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
  } catch {
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
      label: 'No GPS',
    };
  }
  const readiness = assessGpsReadiness(point.accuracy);
  return {
    readiness,
    accuracy: point.accuracy,
    satellites: 0, // not exposed by expo-location
    label: readiness === 'excellent' ? 'Strong signal' :
           readiness === 'good' ? 'Good signal' :
           readiness === 'weak' ? 'Weak signal' : 'No GPS',
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
  try {
    const perm = await checkLocationPermission();
    if (!perm.foreground) return false;

    _subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: intervalMs,
        distanceInterval: 2, // min 2m between points
      },
      (loc) => {
        callback({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          altitude: loc.coords.altitude,
          accuracy: loc.coords.accuracy,
          speed: loc.coords.speed,
          timestamp: loc.timestamp,
        });
      }
    );
    return true;
  } catch {
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
