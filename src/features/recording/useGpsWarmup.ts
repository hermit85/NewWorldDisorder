// ═══════════════════════════════════════════════════════════
// useGpsWarmup — pre-flight GPS readiness hook.
//
// Runs a parallel watchPositionAsync subscription while the
// Pioneer recording screen is in its pre-start state (idle,
// before the user taps START). Tracks latest accuracy + sample
// age + consecutive fresh-fix count so the UI can block the
// START CTA until signal quality clears the READINESS_GATE.
//
// Tears down cleanly the moment the caller flips `enabled`
// back to false — that transition happens the instant the user
// taps START and hands control off to useGPSRecorder. Brief
// ~100 ms overlap between the warmup's own subscription and
// useGPSRecorder's subscription is acceptable (expo-location
// supports parallel subscriptions; both callbacks just fire).
//
// Precedent note: this pattern (dedicated warm-up hook, not a
// mutation of useGPSRecorder) is the template for Sprint 8's
// proximity-gate hook.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { READINESS_GATE } from './validators';
import type { PermissionStatus } from '../permissions/useLocationPermission';

// ── Public types ────────────────────────────────────────────

export type ReadinessPhase = 'searching' | 'warm' | 'armed';

export interface GpsWarmupState {
  readinessPhase: ReadinessPhase;
  /** Horizontal accuracy (m) of the last fix, null before first fix. */
  latestAccuracy: number | null;
  /** ms since the last fix's platform timestamp; null before first fix. */
  sampleAgeMs: number | null;
  /** Count of consecutive samples meeting `maxAccuracyM`. Resets on
   *  any fix above the ceiling or on a stale (>MAX_SAMPLE_AGE_MS) tick. */
  consecutiveFreshCount: number;
  /** True once `requestForegroundPermissionsAsync` returned non-granted.
   *  UI renders the same "open settings" fallback the recorder uses. */
  permissionDenied: boolean;
}

export interface UseGpsWarmupParams {
  /** Set to false to tear down the subscription (user tapped START
   *  or screen is unmounting). The hook's cleanup fires synchronously
   *  on the next render. */
  enabled: boolean;
  /** Accuracy ceiling for 'armed' state. Pass
   *  `READINESS_GATE.PIONEER_MAX_ACCURACY_M` (15) for Pioneer flow
   *  or `READINESS_GATE.RIDER_MAX_ACCURACY_M` (20) for rider flow. */
  maxAccuracyM: number;
  /** Foreground (When-In-Use) permission status from
   *  `useLocationPermission`. Chunk 7 made that hook the single
   *  source of truth for permission state — warmup no longer
   *  requests permissions itself. Pass the live status; warmup
   *  waits when undetermined, subscribes when granted, surfaces
   *  `permissionDenied: true` when denied. */
  foregroundStatus: PermissionStatus;
}

// ── Hook ────────────────────────────────────────────────────

const INITIAL_STATE: GpsWarmupState = {
  readinessPhase: 'searching',
  latestAccuracy: null,
  sampleAgeMs: null,
  consecutiveFreshCount: 0,
  permissionDenied: false,
};

/** How often to re-evaluate state between GPS fixes. Drives the
 *  UI "sampleAge" display and regresses 'armed' → 'warm' when a
 *  fix goes stale (>MAX_SAMPLE_AGE_MS). */
const TICK_INTERVAL_MS = 500;

export function useGpsWarmup({
  enabled,
  maxAccuracyM,
  foregroundStatus,
}: UseGpsWarmupParams): GpsWarmupState {
  const [state, setState] = useState<GpsWarmupState>(INITIAL_STATE);

  // Hot data kept out of React state so the subscription callback
  // (fires every ~1 s) doesn't thrash re-renders. State is synced
  // from refs via `reevaluate()` at most once per tick / fix.
  const latestSampleAtRef = useRef<number | null>(null);
  const latestAccuracyRef = useRef<number | null>(null);
  const consecutiveRef = useRef<number>(0);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const permissionDeniedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      // Disabled: tear down synchronously. State snapshot is left as-is
      // so the caller sees the last measured readiness until unmount.
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.remove();
        } catch {
          // Intentionally swallowed — expo-location sometimes throws on
          // double-remove during rapid enable/disable toggling.
        }
        subscriptionRef.current = null;
      }
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    let cancelled = false;

    // Shared evaluator: reads refs, computes readinessPhase, commits
    // to React state. Invoked both by the GPS callback (new fix) and
    // by the tick (stale detection, UI age refresh).
    const reevaluate = () => {
      const now = Date.now();
      const latestSampleAt = latestSampleAtRef.current;
      const latestAccuracy = latestAccuracyRef.current;
      const sampleAgeMs = latestSampleAt !== null ? now - latestSampleAt : null;

      // Stale-fix check drops the consecutive counter. Keeps 'armed'
      // from sticking when the device stops emitting fixes (canopy,
      // tunnel, GPS chip reset).
      if (
        sampleAgeMs !== null &&
        sampleAgeMs > READINESS_GATE.MAX_SAMPLE_AGE_MS
      ) {
        consecutiveRef.current = 0;
      }

      let readinessPhase: ReadinessPhase;
      if (latestAccuracy === null || sampleAgeMs === null) {
        readinessPhase = 'searching';
      } else if (
        latestAccuracy <= maxAccuracyM &&
        consecutiveRef.current >= READINESS_GATE.MIN_CONSECUTIVE_FRESH_FIXES &&
        sampleAgeMs <= READINESS_GATE.MAX_SAMPLE_AGE_MS
      ) {
        readinessPhase = 'armed';
      } else {
        readinessPhase = 'warm';
      }

      setState({
        readinessPhase,
        latestAccuracy,
        sampleAgeMs,
        consecutiveFreshCount: consecutiveRef.current,
        permissionDenied: permissionDeniedRef.current,
      });
    };

    // Chunk 7: permission is owned by useLocationPermission and
    // passed in via `foregroundStatus`. Wait when undetermined,
    // surface denial, proceed only on grant — no inline request.
    if (foregroundStatus === 'denied') {
      permissionDeniedRef.current = true;
      setState((s) => ({ ...s, permissionDenied: true }));
      return;
    }
    if (foregroundStatus !== 'granted') {
      // Undetermined — permission hook hasn't resolved stage 1 yet.
      // Do nothing; this effect re-runs when foregroundStatus flips.
      return;
    }
    // Reset denial flag if we recover (user flips grant in Settings).
    permissionDeniedRef.current = false;

    (async () => {
      // Open the warm-up subscription. BestForNavigation to match
      // useGPSRecorder so the two can hand off without a quality
      // regression at the moment of START.
      try {
        subscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 0,
          },
          (loc) => {
            const accuracy = loc.coords.accuracy ?? null;
            latestSampleAtRef.current = loc.timestamp;
            latestAccuracyRef.current = accuracy;

            // Fresh-fix streak logic: any fix at or below the ceiling
            // extends the streak; anything worse resets it. Stale
            // regression is handled inside reevaluate() via the age
            // check so a frozen GPS chip can't hold the count high.
            if (accuracy !== null && accuracy <= maxAccuracyM) {
              consecutiveRef.current += 1;
            } else {
              consecutiveRef.current = 0;
            }
            reevaluate();
          },
        );
      } catch {
        // Subscription failed to open — treat like permission denial
        // so the UI can still present an actionable fallback.
        if (cancelled) return;
        permissionDeniedRef.current = true;
        setState((s) => ({ ...s, permissionDenied: true }));
        return;
      }

      if (cancelled) return;

      // Periodic re-eval: surfaces sample age between fixes, regresses
      // 'armed' → 'warm' once a stale fix crosses MAX_SAMPLE_AGE_MS.
      tickRef.current = setInterval(reevaluate, TICK_INTERVAL_MS);
    })();

    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        try {
          subscriptionRef.current.remove();
        } catch {
          // Swallow double-remove race on rapid re-enable.
        }
        subscriptionRef.current = null;
      }
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [enabled, maxAccuracyM, foregroundStatus]);

  return state;
}
