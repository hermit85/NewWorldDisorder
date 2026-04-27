// ─────────────────────────────────────────────────────────────
// Spot arena state — per-spot card derivation for SPOTY.
//
// Same discipline as Home/Tablica/JA helpers: pure function, real
// data, no invented pioneer ownership. Crucially, SPOTY used to
// trust `spot.trailCount` which `mapSpot` zeros out — so every
// card lied "0 trasy / PIONEER SLOT WOLNY" even when a verified
// trail (with the rider's PB) existed. This module computes its
// own counters from the trails array, never from the denormalised
// scalar.
//
// Order of precedence (top wins):
//   NO_TRAILS      → no trails on the spot at all
//   CALIBRATING    → trails exist, none verified
//   USER_HAS_PB    → ≥1 verified trail and rider holds a PB
//   MULTI_TRAIL    → ≥2 verified trails and rider has no PB yet
//   ACTIVE         → exactly 1 verified trail and rider has no PB
// ─────────────────────────────────────────────────────────────

import type { CalibrationStatus, Spot, Trail } from '@/data/types';
import { formatTimeShort } from '@/content/copy';
import type { MissionTone } from '@/features/home/mission';

export type SpotArenaKind =
  | 'NO_TRAILS'
  | 'CALIBRATING'
  | 'ACTIVE'
  | 'USER_HAS_PB'
  | 'MULTI_TRAIL';

export type SpotArenaCtaAction =
  | 'PIONEER_TRAIL'
  | 'CALIBRATION_RUN'
  | 'OPEN_SPOT'
  | 'OPEN_TRAIL';

export interface SpotArenaState {
  kind: SpotArenaKind;
  /** Small mono kicker — "TWOJA ARENA", "ARENA AKTYWNA", etc. */
  label: string;
  /** Card H1 — always the spot name. */
  title: string;
  /** Single-line meta: region · trail context · PB if known. */
  meta: string;
  cta: string;
  ctaAction: SpotArenaCtaAction;
  tone: MissionTone;
  promotedTrailId?: string;
  promotedTrailName?: string;
  userPbMs?: number;
  activeTrailCount: number;
  totalTrailCount: number;
}

const VERIFIED_CALIBRATIONS: ReadonlySet<CalibrationStatus> = new Set([
  'live_fresh',
  'live_confirmed',
  'stable',
  'verified',
  'locked',
]);

export interface DeriveSpotArenaInput {
  spot: Spot;
  trails: Trail[];
  /** Optional rider PB lookup keyed by trailId. Pass an empty map
   *  when the rider isn't authenticated or hasn't ridden the spot. */
  userPbsByTrailId: Map<string, number>;
}

/** Polish plural for "trasa aktywna" / "trasy aktywne" / "tras aktywnych". */
function activeTrailsLabel(n: number): string {
  if (n === 1) return '1 trasa aktywna';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return `${n} tras aktywnych`;
  if (lastOne >= 2 && lastOne <= 4) return `${n} trasy aktywne`;
  return `${n} tras aktywnych`;
}

/** "1 trasa w kalibracji" / "2 trasy w kalibracji" / "5 tras w kalibracji". */
function calibratingTrailsLabel(n: number): string {
  if (n === 1) return '1 trasa w kalibracji';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return `${n} tras w kalibracji`;
  if (lastOne >= 2 && lastOne <= 4) return `${n} trasy w kalibracji`;
  return `${n} tras w kalibracji`;
}

/** Capitalize first letter only — display-layer fix for region values
 *  the DB sometimes stores lowercased ("mazowieckie" → "Mazowieckie").
 *  Empty / nullish strings pass through untouched. */
function capitalizeRegion(region: string): string {
  if (!region) return region;
  return region.charAt(0).toUpperCase() + region.slice(1);
}

export function deriveSpotArenaState(
  input: DeriveSpotArenaInput,
): SpotArenaState {
  const { spot, trails, userPbsByTrailId } = input;
  const verified = trails.filter((t) => VERIFIED_CALIBRATIONS.has(t.calibrationStatus));
  const activeTrailCount = verified.length;
  const totalTrailCount = trails.length;
  const region = capitalizeRegion(spot.region);

  // 1. NO_TRAILS
  if (totalTrailCount === 0) {
    return {
      kind: 'NO_TRAILS',
      label: 'PIONIER POTRZEBNY',
      title: spot.name,
      meta: region ? `${region} · 0 aktywnych tras` : '0 aktywnych tras',
      cta: 'UTWÓRZ PIERWSZĄ TRASĘ',
      ctaAction: 'PIONEER_TRAIL',
      tone: 'amber',
      activeTrailCount: 0,
      totalTrailCount: 0,
    };
  }

  // 2. CALIBRATING
  if (verified.length === 0) {
    return {
      kind: 'CALIBRATING',
      label: 'TRASA W KALIBRACJI',
      title: spot.name,
      meta: region
        ? `${region} · ${calibratingTrailsLabel(totalTrailCount)}`
        : calibratingTrailsLabel(totalTrailCount),
      cta: 'DOKOŃCZ WERYFIKACJĘ',
      ctaAction: 'CALIBRATION_RUN',
      tone: 'amber',
      activeTrailCount: 0,
      totalTrailCount,
    };
  }

  // From here ≥1 verified trail. Pick the trail to "promote" on the
  // card: prefer one where the rider holds a PB (so the meta line
  // can name it + their time); otherwise just take the first verified.
  const trailWithPb = verified.find((t) => userPbsByTrailId.has(t.id));
  const promoted = trailWithPb ?? verified[0];
  const userPbMs = userPbsByTrailId.get(promoted.id);

  // 3. USER_HAS_PB
  if (userPbMs != null) {
    const metaParts = [region, promoted.name, `Twój PB ${formatTimeShort(userPbMs)}`].filter(Boolean);
    return {
      kind: 'USER_HAS_PB',
      label: 'TWOJA ARENA',
      title: spot.name,
      meta: metaParts.join(' · '),
      cta: 'ATAK NA CZAS',
      ctaAction: 'OPEN_TRAIL',
      tone: 'green',
      promotedTrailId: promoted.id,
      promotedTrailName: promoted.name,
      userPbMs,
      activeTrailCount,
      totalTrailCount,
    };
  }

  // 4. MULTI_TRAIL — multiple verified, no PB yet
  if (verified.length > 1) {
    return {
      kind: 'MULTI_TRAIL',
      label: activeTrailsLabel(activeTrailCount).toUpperCase(),
      title: spot.name,
      meta: region
        ? `${region} · Wybierz trasę do zjazdu`
        : 'Wybierz trasę do zjazdu',
      cta: 'WYBIERZ TRASĘ',
      ctaAction: 'OPEN_SPOT',
      tone: 'green',
      activeTrailCount,
      totalTrailCount,
    };
  }

  // 5. ACTIVE — single verified trail, no PB yet
  const metaParts = [region, promoted.name, 'pierwszy czas czeka'].filter(Boolean);
  return {
    kind: 'ACTIVE',
    label: 'ARENA AKTYWNA',
    title: spot.name,
    meta: metaParts.join(' · '),
    cta: 'WEJDŹ DO ARENY',
    ctaAction: 'OPEN_TRAIL',
    tone: 'green',
    promotedTrailId: promoted.id,
    promotedTrailName: promoted.name,
    activeTrailCount,
    totalTrailCount,
  };
}
