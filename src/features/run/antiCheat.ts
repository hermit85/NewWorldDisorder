// ═══════════════════════════════════════════════════════════
// Anti-Cheat MVP — lightweight sanity checks
// PHILOSOPHY: catch obvious fraud, never penalize real rides.
// Better to let a slightly suspicious run through than to
// block a legitimate rider.
// ═══════════════════════════════════════════════════════════

import { GpsPoint, distanceMeters } from '@/systems/gps';
import { AntiCheatResult, AntiCheatFlag, TrailGateConfig } from './types';
import { computeSpeedKmh } from './geometry';

// ── Thresholds (intentionally generous) ──

const MAX_SPEED_KMH = 100;           // No MTB goes 100 km/h sustained
const MAX_POINT_JUMP_M = 300;        // >300m in one GPS interval = teleport
const MIN_POINT_JUMP_TIME_S = 0.5;   // ignore near-instant duplicates
const MIN_TOTAL_MOVEMENT_M = 100;    // must move at least 100m total
const MAX_SPEED_BETWEEN_POINTS = 120; // km/h between any two consecutive points

export function runAntiCheat(
  points: GpsPoint[],
  config: TrailGateConfig,
  durationSec: number,
  totalDistanceM: number,
): AntiCheatResult {
  const flags: AntiCheatFlag[] = [];

  if (points.length < 5) {
    // Not enough data to evaluate — pass by default
    return { passed: true, flags: [] };
  }

  // ── Check 1: Minimum duration ──
  if (durationSec < config.minDurationSec * 0.5) {
    // Even 50% of min duration is suspicious
    flags.push('too_fast_finish');
  }

  // ── Check 2: Minimum distance ──
  if (totalDistanceM < MIN_TOTAL_MOVEMENT_M) {
    flags.push('stationary_run');
  }

  if (totalDistanceM < config.expectedLengthM * 0.3) {
    flags.push('too_short_distance');
  }

  // ── Check 3: Teleportation / impossible jumps ──
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const timeDiff = Math.abs(curr.timestamp - prev.timestamp) / 1000;

    if (timeDiff < MIN_POINT_JUMP_TIME_S) continue;

    const jumpDist = distanceMeters(prev, curr);
    if (jumpDist > MAX_POINT_JUMP_M) {
      flags.push('teleport_detected');
      break; // one teleport is enough
    }

    const speed = computeSpeedKmh(prev, curr);
    if (speed > MAX_SPEED_BETWEEN_POINTS) {
      flags.push('impossible_speed');
      break;
    }
  }

  // ── Check 4: Time travel (timestamps going backward) ──
  for (let i = 1; i < points.length; i++) {
    if (points[i].timestamp < points[i - 1].timestamp - 1000) {
      // More than 1s backward = suspicious
      flags.push('time_travel');
      break;
    }
  }

  // ── Decision: only fail on really clear fraud ──
  // Single flags are warnings; multiple serious flags = fail
  const seriousFlags: AntiCheatFlag[] = ['teleport_detected', 'impossible_speed', 'time_travel'];
  const seriousCount = flags.filter((f) => seriousFlags.includes(f)).length;

  // Fail only if 2+ serious flags or combination of serious + other
  const passed = seriousCount < 2 && !(seriousCount >= 1 && flags.length >= 3);

  return { passed, flags };
}
