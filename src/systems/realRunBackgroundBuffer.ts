// ═══════════════════════════════════════════════════════════
// realRunBackgroundBuffer — in-memory ring buffer for samples
// delivered by the real-run background TaskManager task while the
// app is foreground / background.
//
// Why separate from src/features/recording/recordingStore:
//   - recordingStore is pioneer-specific, keyed to a single buffered
//     recording, and writes to AsyncStorage for 1h resumability.
//     A ranked real run does not need that persistence window — the
//     run either completes in minutes or gets abandoned.
//   - Sharing the same store would make a pioneer + ranked run on
//     the same device step on each other's session keys.
//
// Lifecycle:
//   reset()      — called when useRealRun begins readiness_check.
//                  Drops any samples leftover from a cancelled
//                  previous attempt so the next drain starts clean.
//   push(sample) — called from the task handler (detached JS
//                  context, no React). Appends the sample and
//                  trims to MAX_BUFFER_SIZE newest entries.
//   drainAfter(ts) — called from useRealRun's 1 s tick. Returns
//                  every buffered sample whose timestamp is strictly
//                  greater than `ts`. No side effects — the caller
//                  tracks their own "last processed" timestamp.
//
// In-memory is sufficient because ranked runs are short (<10 min)
// and iOS keeps backgrounded apps alive comfortably within that
// window. Hard termination would lose the ring but also end the
// run; the rider is stuck at home screen anyway at that point.
// ═══════════════════════════════════════════════════════════

import type { GpsPoint } from './gps';

const MAX_BUFFER_SIZE = 600; // 10 min at 1 Hz

let buffer: GpsPoint[] = [];
/** Samples whose timestamp is < `timestampFloor` are dropped at
 *  push time. Needed because `Location.stopLocationUpdatesAsync`
 *  is asynchronous: the background task can still fire one or two
 *  more times after `stopTracking()` returns. Without a floor those
 *  late samples would be picked up by the next run's drain tick
 *  (Codex round 2 P1 cancel→restart race). */
let timestampFloor = 0;

/** Clear every buffered sample. Call at the start of a new run
 *  (readiness_check) so samples from a cancelled prior attempt
 *  don't get replayed into the fresh gate engine. */
export function reset(): void {
  buffer = [];
  timestampFloor = 0;
}

/** Same as reset() but also plants a timestamp floor — any sample
 *  older than `floorTs` will be rejected on push. Use this when
 *  winding down a run (cancel / finalize) so late task deliveries
 *  from the still-running background subscription don't leak into
 *  the next readiness_check. Pass `Date.now()` for "drop everything
 *  from before now". */
export function resetWithFloor(floorTs: number): void {
  buffer = [];
  timestampFloor = floorTs;
}

/** Append a sample from the task handler. Trims the ring to the
 *  newest MAX_BUFFER_SIZE entries so a backgrounded run that outlives
 *  expectations doesn't balloon memory. Samples older than the
 *  current `timestampFloor` are dropped — they belong to a prior,
 *  wound-down session. */
export function push(sample: GpsPoint): void {
  if (sample.timestamp < timestampFloor) return;
  buffer.push(sample);
  if (buffer.length > MAX_BUFFER_SIZE) {
    buffer = buffer.slice(-MAX_BUFFER_SIZE);
  }
}

/** Return every buffered sample whose timestamp is strictly greater
 *  than `afterTimestamp`. Sort ascending — the handler's delivery
 *  order is whatever iOS decides, and the gate engine expects
 *  monotonic time. Does not mutate the buffer; callers track their
 *  own cursor via `lastProcessedTs`. */
export function drainAfter(afterTimestamp: number): GpsPoint[] {
  if (buffer.length === 0) return [];
  const out = buffer.filter((p) => p.timestamp > afterTimestamp);
  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

/** Snapshot size for debug overlay / logging. Not used by hot path. */
export function size(): number {
  return buffer.length;
}
