// ═══════════════════════════════════════════════════════════
// gpsHealthTracker — per-run observability for GPS signal quality
//
// Chunk 10 §3.3. We already verify runs for correctness; this layer
// records how HEALTHY the underlying GPS stream was. Thresholds are
// soft — a run that otherwise verifies stays verified, but a summary
// row flags gps_degraded so we can iterate on thresholds from real
// field data (run_kpi_daily / verified_pass_rate_weekly views).
//
// The tracker is stateful but self-contained: no React, no side
// effects, no external deps. useRealRun instantiates one per run,
// feeds it samples / AppState changes / phase transitions, then
// collects the summary at finalization time.
// ═══════════════════════════════════════════════════════════

import { GATE_ACCURACY_REQUIRED_M } from './gates';
import type { GpsPoint } from '@/systems/gps';

// ── Output shape ──

export interface GpsHealthSummary {
  /** Samples observed between start() and summary(). */
  totalSamples: number;
  /** Sample rate over the observed window, Hz. */
  samplesPerSec: number;
  /** Mean of reported accuracy values, meters. Null accuracies skipped. */
  avgAccuracyM: number;
  /** Seconds elapsed with AppState !== 'active'. */
  backgroundDurationSec: number;
  /** Samples received while in background / total samples. 1.0 = none lost. */
  backgroundSampleRatio: number;
  /** Seconds the run spent waiting for accuracy ≤ GATE_ACCURACY_REQUIRED_M
   *  between start() and markArmed(). */
  waitedForAccuracySec: number;
  /** Seconds from start() to markArmed(). Null if the run never armed. */
  timeToArmedSec: number | null;
}

// ── Tracker ──

type AppState = 'active' | 'background';

export class GpsHealthTracker {
  private startedAt: number | null = null;
  private armedAt: number | null = null;

  private totalSamples = 0;
  private accuracySum = 0;
  private accuracyCount = 0;

  // Foreground/background timing
  private currentAppState: AppState = 'active';
  private lastAppStateChangeAt: number | null = null;
  private backgroundMs = 0;
  private backgroundSampleCount = 0;

  // Accuracy waiting timer — active whenever the latest sample is weak
  // and we are in the pre-armed window.
  private waitingStartedAt: number | null = null;
  private waitingMs = 0;

  /** Mark the beginning of the observation window — usually the moment
   *  the rider taps "JEDŹ RANKINGOWO" (our readiness_check phase entry). */
  start(now: number = Date.now()): void {
    this.startedAt = now;
    this.lastAppStateChangeAt = now;
  }

  /** Mark the moment the gate engine armed (entering armed_ranked /
   *  armed_practice). Drives timeToArmedSec + freezes waitingForAccuracy. */
  markArmed(now: number = Date.now()): void {
    if (this.armedAt == null) this.armedAt = now;
    this.stopWaiting(now);
  }

  /** Notify the tracker of an AppState transition. Pass the new state
   *  and the timestamp at which it took effect. */
  setAppState(next: AppState, now: number = Date.now()): void {
    if (next === this.currentAppState) return;
    if (this.currentAppState === 'background' && this.lastAppStateChangeAt != null) {
      this.backgroundMs += now - this.lastAppStateChangeAt;
    }
    this.currentAppState = next;
    this.lastAppStateChangeAt = now;
  }

  /** Feed a raw GPS sample. We track the sample count, accuracy, and —
   *  during the pre-armed window — whether the sample is accurate enough
   *  to arm. "now" defaults to the sample's own timestamp. */
  onSample(point: GpsPoint, now: number = point.timestamp): void {
    this.totalSamples += 1;
    if (point.accuracy != null) {
      this.accuracySum += point.accuracy;
      this.accuracyCount += 1;
    }
    if (this.currentAppState === 'background') {
      this.backgroundSampleCount += 1;
    }

    // Pre-armed: track whether we are currently waiting on accuracy.
    // Once armed, we no longer care (gpsHealth stops accruing waiting).
    if (this.armedAt == null) {
      const weak = point.accuracy == null || point.accuracy > GATE_ACCURACY_REQUIRED_M;
      if (weak && this.waitingStartedAt == null) {
        this.waitingStartedAt = now;
      } else if (!weak && this.waitingStartedAt != null) {
        this.stopWaiting(now);
      }
    }
  }

  private stopWaiting(now: number): void {
    if (this.waitingStartedAt != null) {
      this.waitingMs += now - this.waitingStartedAt;
      this.waitingStartedAt = null;
    }
  }

  /** Snapshot the current state as a GpsHealthSummary. Safe to call
   *  multiple times; does not mutate internal state. */
  summary(now: number = Date.now()): GpsHealthSummary {
    const started = this.startedAt ?? now;
    const elapsedSec = Math.max(1, (now - started) / 1000);

    // Roll forward a still-ticking background window without mutating.
    let bgMs = this.backgroundMs;
    if (this.currentAppState === 'background' && this.lastAppStateChangeAt != null) {
      bgMs += now - this.lastAppStateChangeAt;
    }

    // Roll forward a still-ticking accuracy-waiting window if we never armed.
    let waitMs = this.waitingMs;
    if (this.waitingStartedAt != null && this.armedAt == null) {
      waitMs += now - this.waitingStartedAt;
    }

    return {
      totalSamples: this.totalSamples,
      samplesPerSec: this.totalSamples / elapsedSec,
      avgAccuracyM: this.accuracyCount > 0 ? this.accuracySum / this.accuracyCount : 0,
      backgroundDurationSec: bgMs / 1000,
      backgroundSampleRatio: this.totalSamples > 0
        ? this.backgroundSampleCount / this.totalSamples
        : 0,
      waitedForAccuracySec: waitMs / 1000,
      timeToArmedSec:
        this.armedAt != null && this.startedAt != null
          ? (this.armedAt - this.startedAt) / 1000
          : null,
    };
  }

  /** Reset everything so a single instance can be reused across runs.
   *  (useRealRun currently prefers a fresh ref per run, so this is
   *  defensive.) */
  reset(): void {
    this.startedAt = null;
    this.armedAt = null;
    this.totalSamples = 0;
    this.accuracySum = 0;
    this.accuracyCount = 0;
    this.currentAppState = 'active';
    this.lastAppStateChangeAt = null;
    this.backgroundMs = 0;
    this.backgroundSampleCount = 0;
    this.waitingStartedAt = null;
    this.waitingMs = 0;
  }
}
