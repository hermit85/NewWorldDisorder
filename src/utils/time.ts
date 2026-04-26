// ═══════════════════════════════════════════════════════════
// time.ts — race-time formatting helpers (Tablica Phase 1).
//
// formatTimeMs("M:SS.s") and formatDelta with U+2212 minus sign
// (NOT hyphen "-") so the typographic register stays consistent
// with race telemetry tradition.
// ═══════════════════════════════════════════════════════════

/** U+2212 MINUS SIGN — typographic minus for deltas, NOT hyphen "-". */
const MINUS = '−';

/** Format milliseconds as "M:SS.s" (one decimal). 1 minute 21.4s → "1:21.4". */
export function formatTimeMs(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const sec = totalSec - m * 60;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
}

/** Format a positive ms delta as "−2.4" (short) or "−2.4 do lidera" (full).
 *  Always uses U+2212 minus regardless of sign — deltas in this app are
 *  always "behind leader" (positive ms, rendered with leading minus to
 *  read as "you're 2.4s behind"). */
export function formatDelta(ms: number, full: boolean = false): string {
  const seconds = (ms / 1000).toFixed(1);
  return full ? `${MINUS}${seconds} do lidera` : `${MINUS}${seconds}`;
}
