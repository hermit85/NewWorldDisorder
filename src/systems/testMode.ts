// ═══════════════════════════════════════════════════════════
// Test Mode — simulation overrides for pre-field-test scenarios
// Gated behind __DEV__. Never contaminates production.
// Controls are set via debug drawer or programmatic API.
// ═══════════════════════════════════════════════════════════

import { logDebugEvent } from './debugEvents';

// ── Simulation state shape ──

export interface SimulationOverrides {
  // GPS / Location
  locationState: 'real' | 'no_location' | 'denied' | 'weak_gps';

  // Venue
  venueState: 'real' | 'at_venue' | 'at_start_clear' | 'at_start_ambiguous' | 'near_start' | 'outside_venue';

  // Run / GPS tracking
  trackingBehavior: 'real' | 'fail_start' | 'delayed_points';

  // Save
  saveBehavior: 'real' | 'delay_3s' | 'fail' | 'timeout';

  // Fetch overrides (force individual fetch failures)
  fetchOverrides: {
    leaderboard: 'real' | 'fail' | 'empty';
    venueActivity: 'real' | 'fail' | 'empty';
    resultImpact: 'real' | 'fail' | 'empty';
    profile: 'real' | 'fail';
    challenges: 'real' | 'fail' | 'empty';
  };
}

const DEFAULT_OVERRIDES: SimulationOverrides = {
  locationState: 'real',
  venueState: 'real',
  trackingBehavior: 'real',
  saveBehavior: 'real',
  fetchOverrides: {
    leaderboard: 'real',
    venueActivity: 'real',
    resultImpact: 'real',
    profile: 'real',
    challenges: 'real',
  },
};

// ── Module state ──

let _testModeActive = false;
let _overrides: SimulationOverrides = { ...DEFAULT_OVERRIDES };
const _listeners = new Set<() => void>();

// ── Public API ──

export function isTestMode(): boolean {
  return __DEV__ && _testModeActive;
}

export function setTestMode(active: boolean): void {
  if (!__DEV__) return;
  _testModeActive = active;
  logDebugEvent('sim', active ? 'test_mode_on' : 'test_mode_off', 'info');
  _notify();
}

export function getSimOverrides(): SimulationOverrides {
  return _overrides;
}

export function setSimOverrides(patch: Partial<SimulationOverrides>): void {
  if (!__DEV__) return;
  _overrides = { ..._overrides, ...patch };
  logDebugEvent('sim', 'overrides_changed', 'info', {
    payload: patch as Record<string, any>,
  });
  _notify();
}

export function setFetchOverride(
  key: keyof SimulationOverrides['fetchOverrides'],
  value: 'real' | 'fail' | 'empty',
): void {
  if (!__DEV__) return;
  _overrides = {
    ..._overrides,
    fetchOverrides: { ..._overrides.fetchOverrides, [key]: value },
  };
  logDebugEvent('sim', `fetch_override:${key}`, 'info', { payload: { value } });
  _notify();
}

export function resetSimOverrides(): void {
  _overrides = { ...DEFAULT_OVERRIDES };
  logDebugEvent('sim', 'overrides_reset', 'info');
  _notify();
}

export function subscribeTestMode(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

function _notify() {
  _listeners.forEach((fn) => fn());
}

// ── Simulation helpers for specific scenarios ──

/** Simulated GPS coordinates for known locations */
export const SIM_LOCATIONS = {
  // At venue, near Dzida Czerwona start
  atDzidaStart: { latitude: 49.4250, longitude: 20.9575 },
  // At venue, between Gałgan and Dookoła starts (ambiguous)
  atAmbiguousStart: { latitude: 49.4247, longitude: 20.9553 },
  // At venue, near the lift bottom (not near any start)
  atVenueNoStart: { latitude: 49.4140, longitude: 20.9570 },
  // Near venue but outside
  nearVenue: { latitude: 49.4050, longitude: 20.9575 },
  // Far from venue
  outsideVenue: { latitude: 50.0, longitude: 20.0 },
} as const;

/** Get simulated position for current venue state override */
export function getSimulatedPosition(): { latitude: number; longitude: number; accuracy: number } | null {
  if (!isTestMode()) return null;

  switch (_overrides.venueState) {
    case 'at_start_clear':
      return { ...SIM_LOCATIONS.atDzidaStart, accuracy: 5 };
    case 'at_start_ambiguous':
      return { ...SIM_LOCATIONS.atAmbiguousStart, accuracy: 5 };
    case 'at_venue':
      return { ...SIM_LOCATIONS.atVenueNoStart, accuracy: 8 };
    case 'near_start':
      return { ...SIM_LOCATIONS.nearVenue, accuracy: 10 };
    case 'outside_venue':
      return { ...SIM_LOCATIONS.outsideVenue, accuracy: 12 };
    default:
      return null;
  }
}

/** Check if a specific fetch should be overridden */
export function shouldSimFetchFail(key: keyof SimulationOverrides['fetchOverrides']): boolean {
  return isTestMode() && _overrides.fetchOverrides[key] === 'fail';
}

export function shouldSimFetchEmpty(key: keyof SimulationOverrides['fetchOverrides']): boolean {
  return isTestMode() && _overrides.fetchOverrides[key] === 'empty';
}

/** Check if location should be overridden */
export function shouldSimNoLocation(): boolean {
  return isTestMode() && (_overrides.locationState === 'no_location' || _overrides.locationState === 'denied');
}

export function shouldSimWeakGps(): boolean {
  return isTestMode() && _overrides.locationState === 'weak_gps';
}

/** Check if tracking should fail */
export function shouldSimTrackingFail(): boolean {
  return isTestMode() && _overrides.trackingBehavior === 'fail_start';
}

/** Check if save should fail/delay */
export function shouldSimSaveFail(): boolean {
  return isTestMode() && _overrides.saveBehavior === 'fail';
}

export function getSimSaveDelay(): number {
  if (!isTestMode()) return 0;
  if (_overrides.saveBehavior === 'delay_3s') return 3000;
  if (_overrides.saveBehavior === 'timeout') return 15000;
  return 0;
}
