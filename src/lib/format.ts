// ═══════════════════════════════════════════════════════════
// Format helpers — presentation-layer utilities.
// ═══════════════════════════════════════════════════════════

/** Signed seconds delta with ± / + / - prefix.
 *    formatDelta(-1240) → "-1.24s"   (ahead)
 *    formatDelta(760)   → "+0.76s"   (behind)
 *    formatDelta(0)     → "±0.00"
 */
export function formatDelta(ms: number): string {
  if (ms === 0) return '±0.00';
  const sign = ms < 0 ? '-' : '+';
  const abs = Math.abs(ms) / 1000;
  return `${sign}${abs.toFixed(2)}s`;
}
