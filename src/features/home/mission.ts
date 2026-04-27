// ─────────────────────────────────────────────────────────────
// Home mission state machine.
//
// The Home screen must always render exactly one primary mission
// card. This module derives that mission purely from data the
// existing hooks already expose. Each branch returns truthful copy
// — no invented rivals, no invented timestamps. When a field is
// missing, the variant falls back to a generic but honest line.
//
// Order of precedence (top wins):
//   NO_SPOT              → user has no primary bike park
//   NO_TRAILS            → spot exists, zero trails
//   TRAIL_CALIBRATING    → trails exist, none verified yet
//   VERIFIED_NO_USER_TIME→ verified trail exists, user has no PB
//   USER_LEADS           → heroBeat says user is currently #1
//   USER_BEATEN          → heroBeat says user fell to #N (N>1)
//   USER_HAS_TIME        → user has a PB but no recent position drama
// ─────────────────────────────────────────────────────────────
import type { CalibrationStatus, Trail } from '@/data/types';
import type { HeroBeat, PrimarySpotSummary } from '@/lib/api';
import { formatTimeShort } from '@/content/copy';

export type MissionKind =
  | 'NO_SPOT'
  | 'NO_TRAILS'
  | 'TRAIL_CALIBRATING'
  | 'VERIFIED_NO_USER_TIME'
  | 'USER_LEADS'
  | 'USER_BEATEN'
  | 'USER_HAS_TIME';

export type MissionTone = 'green' | 'amber' | 'blue';

export type MissionAction =
  | 'ADD_SPOT'
  | 'PIONEER_TRAIL'
  | 'CALIBRATION_RUN'
  | 'RANKED_RUN';

export interface HomeMission {
  kind: MissionKind;
  kicker: string;
  title: string;
  body: string;
  pressureLine?: string;
  cta: string;
  tone: MissionTone;
  action: MissionAction;
  /** Optional position badge ("#1", "#2"). Renders top-right of hero. */
  positionBadge?: string;
  /** Optional KOM time ("1:28.4") for trail-with-leaderboard states. */
  komTime?: string;
  /** Optional rider delta to KOM ("+1.6s"). */
  yourDeltaText?: string;
  /** Optional venue subtitle (bike park name) under the title. */
  venueName?: string;
  /** Optional trail id passed through to the run intent. */
  trailId?: string;
  /** Optional trail name in original casing (for params). */
  trailName?: string;
}

const VERIFIED_CALIBRATIONS: ReadonlySet<CalibrationStatus> = new Set([
  'live_fresh',
  'live_confirmed',
  'stable',
  'verified',
  'locked',
]);

export interface DeriveMissionInput {
  primarySpotSummary: PrimarySpotSummary | null;
  trails: Trail[];
  heroBeat: HeroBeat | null;
  /** Pre-formatted relative time ("14 min temu"). Caller owns clock. */
  beaterRelativeTime?: string | null;
}

export function deriveHomeMission(input: DeriveMissionInput): HomeMission {
  const { primarySpotSummary, trails, heroBeat, beaterRelativeTime } = input;

  // 1. NO_SPOT
  if (!primarySpotSummary) {
    return {
      kind: 'NO_SPOT',
      kicker: 'DODAJ ARENĘ',
      title: 'GDZIE DZIŚ JEŹDZISZ?',
      body: 'Dodaj swój bike park i otwórz pierwszą arenę NWD.',
      cta: 'DODAJ BIKE PARK',
      tone: 'green',
      action: 'ADD_SPOT',
    };
  }

  const venueName = primarySpotSummary.spot.name;

  // 2. NO_TRAILS
  if (primarySpotSummary.trailCount === 0 || trails.length === 0) {
    return {
      kind: 'NO_TRAILS',
      kicker: 'PIONIER POTRZEBNY',
      title: 'OTWÓRZ ARENĘ',
      body: 'Zjedź pierwszy oficjalny przejazd. Twoja linia może zostać trasą tego bike parku.',
      cta: 'NAGRAJ TRASĘ PIONIERA',
      tone: 'amber',
      action: 'PIONEER_TRAIL',
      venueName,
    };
  }

  // 3. TRAIL_CALIBRATING — trails exist but none have crossed the verified line
  const verifiedTrails = trails.filter((t) => VERIFIED_CALIBRATIONS.has(t.calibrationStatus));
  if (verifiedTrails.length === 0) {
    return {
      kind: 'TRAIL_CALIBRATING',
      kicker: 'TRASA W KALIBRACJI',
      title: 'DOKOŃCZ WERYFIKACJĘ',
      body: 'Potrzeba spójnych zjazdów, żeby trasa weszła do ligi.',
      cta: 'JEDŹ KALIBRACYJNIE',
      tone: 'amber',
      action: 'CALIBRATION_RUN',
      venueName,
    };
  }

  // From here: at least one verified trail exists.
  // Prefer the heroBeat trail (it's the trail with current position drama),
  // else pick the first verified trail as the surfaced target.
  const focusTrail =
    (heroBeat ? trails.find((t) => t.id === heroBeat.trailId) : null)
    ?? verifiedTrails[0];
  const trailNameDisplay = (heroBeat?.trailName ?? focusTrail?.name ?? '').toUpperCase();
  const trailNameRaw = heroBeat?.trailName ?? focusTrail?.name;

  // 5. USER_LEADS
  if (heroBeat && heroBeat.currentPosition === 1) {
    return {
      kind: 'USER_LEADS',
      kicker: 'OBROŃ #1',
      title: trailNameDisplay,
      body: heroBeat.userTimeMs
        ? `Twój rekord: ${formatTimeShort(heroBeat.userTimeMs)} · jesteś #1`
        : 'Jesteś #1 na tej trasie',
      pressureLine: 'Dziś bronisz korony.',
      cta: 'START Z BRAMKI',
      tone: 'green',
      action: 'RANKED_RUN',
      positionBadge: '#1',
      komTime: formatTimeShort(heroBeat.beaterTimeMs),
      venueName,
      trailId: heroBeat.trailId,
      trailName: trailNameRaw,
    };
  }

  // 6. USER_BEATEN
  if (heroBeat && heroBeat.currentPosition > 1) {
    const deltaSec = heroBeat.deltaMs ? (heroBeat.deltaMs / 1000).toFixed(1) : null;
    const body = deltaSec
      ? `Spadłeś na #${heroBeat.currentPosition} · do lidera brakuje ${deltaSec}s`
      : `Spadłeś na #${heroBeat.currentPosition} · lider czeka na kontrę`;
    const pressure = (() => {
      if (heroBeat.beaterName && beaterRelativeTime) {
        return `${heroBeat.beaterName} przejął #${heroBeat.previousPosition} ${beaterRelativeTime}.`;
      }
      if (heroBeat.beaterName) {
        return `${heroBeat.beaterName} przejął #${heroBeat.previousPosition}.`;
      }
      return `Ktoś przejął #${heroBeat.previousPosition}.`;
    })();
    return {
      kind: 'USER_BEATEN',
      kicker: 'ODBIJ POZYCJĘ',
      title: trailNameDisplay,
      body,
      pressureLine: pressure,
      cta: 'START Z BRAMKI',
      tone: 'amber',
      action: 'RANKED_RUN',
      positionBadge: `#${heroBeat.currentPosition}`,
      komTime: formatTimeShort(heroBeat.beaterTimeMs),
      yourDeltaText: deltaSec ? `+${deltaSec}s` : undefined,
      venueName,
      trailId: heroBeat.trailId,
      trailName: trailNameRaw,
    };
  }

  // 4. VERIFIED_NO_USER_TIME — verified trail, user has no PB anywhere in spot
  if (!primarySpotSummary.bestDurationMs) {
    return {
      kind: 'VERIFIED_NO_USER_TIME',
      kicker: 'PIERWSZY CZAS',
      title: trailNameDisplay || 'WEJDŹ NA TABLICĘ',
      body: 'Ustaw swój pierwszy wynik na tej trasie.',
      cta: 'START Z BRAMKI',
      tone: 'green',
      action: 'RANKED_RUN',
      venueName,
      trailId: focusTrail?.id,
      trailName: trailNameRaw,
    };
  }

  // 7. USER_HAS_TIME — has PB but no current-position signal
  return {
    kind: 'USER_HAS_TIME',
    kicker: 'ATAK NA CZAS',
    title: trailNameDisplay || 'TWÓJ REKORD',
    body: `Twój rekord: ${formatTimeShort(primarySpotSummary.bestDurationMs)}`,
    pressureLine: 'Jedź czysto. Urwij sekundę. Wejdź wyżej.',
    cta: 'START Z BRAMKI',
    tone: 'green',
    action: 'RANKED_RUN',
    venueName,
    trailId: focusTrail?.id,
    trailName: trailNameRaw,
  };
}
