// ═══════════════════════════════════════════════════════════
// useLocationPermission — 2-stage iOS location permission flow.
//
// Single source of truth for GPS permissions. Stage 1 fires on
// mount (foreground When-In-Use — cheap, lets warm-up display
// GPS). Stage 2 fires on-demand when the recorder needs Always
// permission to run under TaskManager after the screen locks
// or the app backgrounds.
//
// iOS best practice: never request Always on first launch — the
// user hasn't seen enough of the app to consent meaningfully.
// Contextual ask at the moment of START (first ride) matches
// what Strava / Garmin / Trailforks do.
//
// Android parity: Android treats both levels as a single grant
// since API 29; the hook's 2-stage API still works (stage 2 is
// a no-op when stage 1 already granted Always-equivalent).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

export type PermissionStatus = Location.PermissionStatus;

export interface LocationPermissionState {
  /** When-In-Use grant result. 'granted' is the minimum needed
   *  to start the warm-up GPS subscription. */
  foregroundStatus: PermissionStatus;
  /** Always grant result. 'granted' unlocks TaskManager-backed
   *  background recording. `undetermined` before stage 2 runs. */
  backgroundStatus: PermissionStatus;
  /** True iff `backgroundStatus === 'granted'`. Recorder uses
   *  this to decide between background task mode and foreground-
   *  only graceful-degradation mode. */
  canRecordInBackground: boolean;
  /** True while either stage's request is in flight. */
  requesting: boolean;
}

export interface UseLocationPermissionResult extends LocationPermissionState {
  /** Stage 2 promotion. Safe to call multiple times — a no-op
   *  when already granted. Returns the resolved background status
   *  so callers can branch without reading state (avoids stale
   *  closure reads during the same render). */
  requestBackground: () => Promise<PermissionStatus>;
  /** Manual re-read of both statuses. Call after returning from
   *  Settings so the UI reflects a flip from 'denied' → 'granted'. */
  refresh: () => Promise<void>;
}

const INITIAL_STATE: LocationPermissionState = {
  foregroundStatus: 'undetermined' as PermissionStatus,
  backgroundStatus: 'undetermined' as PermissionStatus,
  canRecordInBackground: false,
  requesting: false,
};

export function useLocationPermission(): UseLocationPermissionResult {
  const [state, setState] = useState<LocationPermissionState>(INITIAL_STATE);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Stage 1 — fires on mount. Low-cost: if the user previously
  // granted WIU, this resolves silently. If they denied, the
  // system does not re-prompt (iOS policy) and we surface 'denied'
  // so the UI can deep-link to Settings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState((s) => ({ ...s, requesting: true }));
      let fg: PermissionStatus;
      let bg: PermissionStatus;
      try {
        const fgRes = await Location.requestForegroundPermissionsAsync();
        fg = fgRes.status;
      } catch {
        fg = 'denied' as PermissionStatus;
      }
      // Read (don't request) the current background status so we
      // know whether stage 2 still needs to run. Requesting Always
      // here would violate the "contextual ask" principle.
      try {
        const bgRes = await Location.getBackgroundPermissionsAsync();
        bg = bgRes.status;
      } catch {
        bg = 'undetermined' as PermissionStatus;
      }
      if (cancelled || !mountedRef.current) return;
      setState({
        foregroundStatus: fg,
        backgroundStatus: bg,
        canRecordInBackground: bg === 'granted',
        requesting: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestBackground = useCallback(async (): Promise<PermissionStatus> => {
    setState((s) => ({ ...s, requesting: true }));
    let bg: PermissionStatus;
    try {
      const res = await Location.requestBackgroundPermissionsAsync();
      bg = res.status;
    } catch {
      bg = 'denied' as PermissionStatus;
    }
    if (mountedRef.current) {
      setState((s) => ({
        ...s,
        backgroundStatus: bg,
        canRecordInBackground: bg === 'granted',
        requesting: false,
      }));
    }
    return bg;
  }, []);

  const refresh = useCallback(async (): Promise<void> => {
    let fg: PermissionStatus;
    let bg: PermissionStatus;
    try {
      const fgRes = await Location.getForegroundPermissionsAsync();
      fg = fgRes.status;
    } catch {
      fg = 'denied' as PermissionStatus;
    }
    try {
      const bgRes = await Location.getBackgroundPermissionsAsync();
      bg = bgRes.status;
    } catch {
      bg = 'undetermined' as PermissionStatus;
    }
    if (mountedRef.current) {
      setState({
        foregroundStatus: fg,
        backgroundStatus: bg,
        canRecordInBackground: bg === 'granted',
        requesting: false,
      });
    }
  }, []);

  return { ...state, requestBackground, refresh };
}
