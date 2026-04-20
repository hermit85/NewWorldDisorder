// ═══════════════════════════════════════════════════════════
// useVenueContext — reactive venue + start-zone detection
// Polls GPS every 5s when active, debounces state changes
// Field-test hardened: null safety, cleanup, error logging
// Instrumented: debug events + simulation override support
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { getCurrentPosition, checkLocationPermission } from '@/systems/gps';
import { getVenueContext, VenueContext } from '@/systems/venueDetection';
import { logDebugEvent } from '@/systems/debugEvents';
import { getAllVenues } from '@/data/venues';
import {
  isTestMode,
  getSimulatedPosition,
  shouldSimNoLocation,
} from '@/systems/testMode';

export type VenueContextStatus = 'loading' | 'active' | 'no_location' | 'denied';

export interface RiderPosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface VenueContextState {
  status: VenueContextStatus;
  context: VenueContext | null;
  riderPosition: RiderPosition | null;
  lastUpdate: number;
}

const POLL_INTERVAL = 5000;
const DEBOUNCE_MS = 2000;

export function useVenueContext(enabled: boolean = true): VenueContextState {
  const [state, setState] = useState<VenueContextState>({
    status: 'loading',
    context: null,
    riderPosition: null,
    lastUpdate: 0,
  });

  const lastContextRef = useRef<VenueContext | null>(null);
  const lastChangeRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      setState({ status: 'no_location', context: null, riderPosition: null, lastUpdate: 0 });
      return;
    }

    // Checkpoint B interim: the venue registry is empty after the
    // seed removal. Without venues there is nothing to geofence against
    // and nothing to detect start zones on, so we short-circuit the
    // polling loop — saves GPS wake-ups and battery.
    // TODO Sprint 3: restore venue/start-zone detection from DB geometry
    // (spots.center_lat/lng + trails.geometry once calibration populates it).
    if (getAllVenues().length === 0) {
      setState({ status: 'no_location', context: null, riderPosition: null, lastUpdate: 0 });
      return;
    }

    let mounted = true;

    const poll = async () => {
      if (!enabledRef.current || !mounted) return;

      try {
        // ── Simulation: force no-location ──
        if (shouldSimNoLocation()) {
          logDebugEvent('gps', 'sim_no_location', 'info');
          if (mounted) {
            lastContextRef.current = null;
            setState({ status: 'no_location', context: null, riderPosition: null, lastUpdate: Date.now() });
          }
          return;
        }

        const perm = await checkLocationPermission();
        if (!perm.foreground) {
          logDebugEvent('gps', 'permission_denied', 'warn');
          if (mounted) setState({ status: 'denied', context: null, riderPosition: null, lastUpdate: Date.now() });
          return;
        }

        // ── Simulation: use simulated position ──
        let pos: { latitude: number; longitude: number } | null = null;
        const simPos = getSimulatedPosition();
        if (simPos) {
          pos = simPos;
          logDebugEvent('gps', 'sim_position', 'info', {
            payload: { lat: simPos.latitude, lng: simPos.longitude, accuracy: simPos.accuracy },
          });
        } else {
          pos = await getCurrentPosition();
        }

        if (!pos) {
          // GPS returned null — degrade state explicitly, don't keep stale context
          logDebugEvent('gps', 'position_null', 'warn');
          if (mounted) {
            lastContextRef.current = null;
            setState({ status: 'no_location', context: null, riderPosition: null, lastUpdate: Date.now() });
          }
          return;
        }
        if (!mounted) return;

        const ctx = getVenueContext(pos.latitude, pos.longitude);
        const now = Date.now();

        // Debounce: don't flip states too fast
        const prev = lastContextRef.current;
        const changed = !prev
          || prev.venue.venueId !== ctx.venue.venueId
          || prev.startZone.nearestStart?.trailId !== ctx.startZone.nearestStart?.trailId
          || prev.startZone.isAtStart !== ctx.startZone.isAtStart;

        if (changed && now - lastChangeRef.current < DEBOUNCE_MS) {
          return;
        }

        if (changed) {
          lastChangeRef.current = now;
          logDebugEvent('venue', 'state_changed', 'info', {
            venueId: ctx.venue.venueId ?? undefined,
            trailId: ctx.startZone.nearestStart?.trailId,
            payload: {
              insideVenue: ctx.venue.isInsideVenue,
              isAtStart: ctx.startZone.isAtStart,
              ambiguous: ctx.startZone.ambiguous,
            },
          });
        }

        lastContextRef.current = ctx;
        if (mounted) {
          setState({
            status: 'active',
            context: ctx,
            riderPosition: {
              latitude: pos.latitude,
              longitude: pos.longitude,
              accuracy: (pos as any).accuracy,
            },
            lastUpdate: now,
          });
        }
      } catch (e) {
        logDebugEvent('gps', 'poll_error', 'fail', { payload: { error: String(e) } });
        if (mounted) setState(s => ({ ...s, status: 'no_location' }));
      }
    };

    // Initial poll
    poll();

    // Regular polling
    intervalRef.current = setInterval(poll, POLL_INTERVAL);

    // Pause/resume on app state — check enabled flag
    const subscription = AppState.addEventListener('change', (appState) => {
      if (!enabledRef.current) return;
      logDebugEvent('venue', appState === 'active' ? 'app_resumed' : 'app_backgrounded', 'info');
      if (appState === 'active') {
        poll();
        if (!intervalRef.current) {
          intervalRef.current = setInterval(poll, POLL_INTERVAL);
        }
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = undefined;
        }
      }
    });

    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      subscription.remove();
    };
  }, [enabled]);

  return state;
}
