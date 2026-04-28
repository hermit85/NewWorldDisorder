// ─────────────────────────────────────────────────────────────
// Tablica state machine — competitive status, not a list.
//
// Tablica must answer in one second: "Where am I, who is beating
// me, and how much do I need to gain?". Like the Home mission, the
// hero ALWAYS renders; the kind is derived purely from real data.
//
// Order of precedence (top wins):
//   NO_SPOT             → no primary bike park
//   NO_TRAILS           → spot exists, zero trails
//   NO_VERIFIED_TRAILS  → trails exist but none verified
//   TRAIL_LEAGUE_EMPTY  → trail exists, no rows in any scope (truly fresh)
//   SCOPE_EMPTY         → today/weekend/sezon empty, history exists
//   USER_NOT_RANKED     → rows exist but currentUser is missing
//   USER_LEADS          → currentUser is at #1 in current scope
//   USER_CHASING        → currentUser is in the rows but not #1
//
// SCOPE_EMPTY also produces a `proofCard` containing the all-time
// leader and the user's all-time rank (if any). This is the cure
// for "Tablica wygląda na martwą" — the league exists, just today
// (or this weekend) hasn't started yet.
// ─────────────────────────────────────────────────────────────
import type { CalibrationStatus, LeaderboardEntry, Trail } from '@/data/types';
import type { PrimarySpotSummary } from '@/lib/api';
import { formatTimeShort } from '@/content/copy';
import type { MissionTone } from '@/features/home/mission';

export type LeaderboardStateKind =
  | 'NO_SPOT'
  | 'NO_TRAILS'
  | 'NO_VERIFIED_TRAILS'
  | 'TRAIL_LEAGUE_EMPTY'
  | 'SCOPE_EMPTY'
  | 'USER_NOT_RANKED'
  | 'USER_LEADS'
  | 'USER_CHASING';

export type LeaderboardScope = 'today' | 'weekend' | 'season' | 'all_time';

export type LeaderboardCtaAction =
  | 'ADD_SPOT'
  | 'PIONEER_TRAIL'
  | 'CALIBRATION_RUN'
  | 'RANKED_RUN';

export interface LeaderboardHeroCopy {
  kicker: string;
  title: string;
  body: string;
  pressureLine?: string;
  tone: MissionTone;
  /** Big position badge ("#1", "#2") — only for USER_LEADS / USER_CHASING. */
  positionBadge?: string;
  /** Leader's time in the right slot ("1:19.4") — only when leaderboard exists. */
  leaderTime?: string;
  /** Gap to leader ("+1.6s") — only when user is chasing. */
  gapText?: string;
}

export interface LeaderboardCta {
  label: string;
  action: LeaderboardCtaAction;
  /** Trail id passed through to /run/active when the CTA navigates to a
   *  ranked or calibration run. Required for CALIBRATION_RUN because the
   *  Tablica state's `focusTrail` is null when no verified trail exists yet
   *  — the route resolver would otherwise short-circuit and the button
   *  becomes a no-op. RANKED_RUN states have focusTrail upstream so they
   *  can leave this off, but populating it everywhere keeps the route
   *  resolver branch single-source. */
  trailId?: string;
  /** Display name in original casing for /run/active params. */
  trailName?: string;
}

export interface LeagueProofCard {
  /** Section label; differs slightly when leader is current user. */
  label: string;
  leaderName: string;
  leaderTime: string;
  leaderIsUser: boolean;
  /** All-time rank for the current rider, when available. */
  userRank: number | null;
  /** All-time PB for the current rider, formatted. */
  userTime: string | null;
}

export interface PodiumRow {
  rank: number;
  /** Display name; fallback to username. */
  rider: string;
  time: string;
  /** Pre-formatted gap to #1: "+1.6s" or null for #1 itself. */
  gapText: string | null;
  isCurrentUser: boolean;
  userId: string;
}

export interface LeaderboardState {
  kind: LeaderboardStateKind;
  hero: LeaderboardHeroCopy;
  /** Up to 3 top rows. Empty array for empty-board states. */
  topRows: PodiumRow[];
  /** Sticky row for current user when their position is outside the top 3. */
  stickyUserRow: PodiumRow | null;
  /** Remaining rows after the top 3 (and excluding sticky if duplicated). */
  tailRows: PodiumRow[];
  cta: LeaderboardCta | null;
  /** Set in SCOPE_EMPTY — small "the league does exist" proof tile
      shown below the hero so a quiet day doesn't read as a dead app. */
  proofCard: LeagueProofCard | null;
}

const VERIFIED_CALIBRATIONS: ReadonlySet<CalibrationStatus> = new Set([
  'live_fresh',
  'live_confirmed',
  'stable',
  'verified',
  'locked',
]);

export interface DeriveLeaderboardStateInput {
  primarySpotSummary: PrimarySpotSummary | null;
  trails: Trail[];
  /** The trail whose leaderboard is currently being viewed. May be null
      if no verified trail is selectable yet. */
  focusTrail: Trail | null;
  /** Rows for the currently-selected scope (today / weekend / sezon / all-time). */
  leaderboardRows: LeaderboardEntry[];
  /** All-time rows used to detect "scope is empty but the league exists"
      and to power the proof card. When `scope === 'all_time'` callers
      may pass the same array as `leaderboardRows`; the deriver tolerates
      that and never emits SCOPE_EMPTY for the all-time scope itself. */
  historyRows: LeaderboardEntry[];
  currentUserId: string | null;
  scope: LeaderboardScope;
}

function formatGapMs(ms: number): string {
  const s = (ms / 1000).toFixed(1);
  return `+${s}s`;
}

function makePodiumRow(
  entry: LeaderboardEntry,
  leaderTimeMs: number,
): PodiumRow {
  return {
    rank: entry.currentPosition,
    rider: entry.username,
    time: formatTimeShort(entry.bestDurationMs),
    gapText:
      entry.currentPosition === 1
        ? null
        : formatGapMs(entry.bestDurationMs - leaderTimeMs),
    isCurrentUser: entry.isCurrentUser,
    userId: entry.userId,
  };
}

// Scope-specific copy for SCOPE_EMPTY. "Lider hides what he doesn't
// know" — every line stays truthful under any scope.
const SCOPE_EMPTY_COPY: Record<
  Exclude<LeaderboardScope, 'all_time'>,
  { kicker: string; title: string }
> = {
  today: { kicker: 'DZIŚ JESZCZE PUSTO', title: 'USTAW CZAS DNIA' },
  weekend: { kicker: 'WEEKEND JESZCZE PUSTY', title: 'USTAW CZAS WEEKENDU' },
  season: { kicker: 'SEZON JESZCZE PUSTY', title: 'USTAW CZAS SEZONU' },
};

function buildProofCard(
  historyRows: LeaderboardEntry[],
  currentUserId: string | null,
): LeagueProofCard | null {
  if (historyRows.length === 0) return null;
  const leader = historyRows[0];
  const leaderIsUser = !!currentUserId && leader.userId === currentUserId;
  const userEntry = currentUserId
    ? historyRows.find((r) => r.userId === currentUserId) ?? null
    : null;
  return {
    label: 'REKORD TRASY',
    leaderName: leader.username || 'Lider',
    leaderTime: formatTimeShort(leader.bestDurationMs),
    leaderIsUser,
    userRank: userEntry ? userEntry.currentPosition : null,
    userTime: userEntry ? formatTimeShort(userEntry.bestDurationMs) : null,
  };
}

export function deriveLeaderboardState(
  input: DeriveLeaderboardStateInput,
): LeaderboardState {
  const { primarySpotSummary, trails, focusTrail, leaderboardRows, historyRows, currentUserId, scope } = input;

  // 1. NO_SPOT
  if (!primarySpotSummary) {
    return {
      kind: 'NO_SPOT',
      hero: {
        kicker: 'DODAJ ARENĘ',
        title: 'BRAK BIKE PARKU',
        body: 'Dodaj swój bike park, żeby otworzyć tablicę.',
        tone: 'green',
      },
      topRows: [],
      stickyUserRow: null,
      tailRows: [],
      cta: { label: 'DODAJ BIKE PARK', action: 'ADD_SPOT' },
      proofCard: null,
    };
  }

  // 2. NO_TRAILS
  if (primarySpotSummary.trailCount === 0 || trails.length === 0) {
    return {
      kind: 'NO_TRAILS',
      hero: {
        kicker: 'BRAK TRASY',
        title: 'OTWÓRZ ARENĘ',
        body: 'Dodaj lub zweryfikuj trasę, żeby uruchomić tablicę.',
        tone: 'amber',
      },
      topRows: [],
      stickyUserRow: null,
      tailRows: [],
      cta: { label: 'NAGRAJ TRASĘ PIONIERA', action: 'PIONEER_TRAIL' },
      proofCard: null,
    };
  }

  // 3. NO_VERIFIED_TRAILS
  const verified = trails.filter((t) => VERIFIED_CALIBRATIONS.has(t.calibrationStatus));
  if (verified.length === 0 || !focusTrail) {
    // Pick the first calibrating trail as the surfaced target so the
    // CTA has somewhere to route. Pre-fix, focusTrail was null here
    // (filtered to verified only) and resolveLeaderboardCtaRoute
    // short-circuited on missing trailId — the JEDŹ KALIBRACYJNIE
    // button was visually present but did nothing.
    const calibrationTarget = trails[0];
    return {
      kind: 'NO_VERIFIED_TRAILS',
      hero: {
        kicker: 'BRAK TRASY',
        title: 'TRASA W KALIBRACJI',
        body: 'Dodaj lub zweryfikuj trasę, żeby uruchomić tablicę.',
        tone: 'amber',
      },
      topRows: [],
      stickyUserRow: null,
      tailRows: [],
      cta: {
        label: 'JEDŹ KALIBRACYJNIE',
        action: 'CALIBRATION_RUN',
        trailId: calibrationTarget?.id,
        trailName: calibrationTarget?.name,
      },
      proofCard: null,
    };
  }

  // From here: focusTrail is verified.

  // 4 / 5. Empty-board branches.
  // We split the old NO_LEADERBOARD into two emotionally-different
  // states: TRAIL_LEAGUE_EMPTY (the trail has never seen a result —
  // history is empty too) versus SCOPE_EMPTY (today/weekend/sezon
  // hasn't started yet, but the league exists in history). The
  // second case shows a proof card so the screen reads "świeży
  // dzień", not "martwy produkt".
  if (leaderboardRows.length === 0) {
    const historyEmpty = historyRows.length === 0;
    if (historyEmpty || scope === 'all_time') {
      return {
        kind: 'TRAIL_LEAGUE_EMPTY',
        hero: {
          kicker: 'TABLICA PUSTA',
          title: 'USTAW PIERWSZY WYNIK',
          body: 'Pierwszy czysty zjazd otworzy ligę na tej trasie.',
          tone: 'amber',
        },
        topRows: [],
        stickyUserRow: null,
        tailRows: [],
        cta: { label: 'START Z BRAMKI', action: 'RANKED_RUN' },
        proofCard: null,
      };
    }
    const copy = SCOPE_EMPTY_COPY[scope];
    return {
      kind: 'SCOPE_EMPTY',
      hero: {
        kicker: copy.kicker,
        title: copy.title,
        body: 'Pierwszy czysty zjazd ustawi tę tablicę.',
        tone: 'green',
      },
      topRows: [],
      stickyUserRow: null,
      tailRows: [],
      cta: { label: 'START Z BRAMKI', action: 'RANKED_RUN' },
      proofCard: buildProofCard(historyRows, currentUserId),
    };
  }

  const leaderTimeMs = leaderboardRows[0].bestDurationMs;
  const allRows = leaderboardRows.map((e) => makePodiumRow(e, leaderTimeMs));
  const topRows = allRows.slice(0, 3);
  const userEntry = currentUserId
    ? leaderboardRows.find((e) => e.userId === currentUserId) ?? null
    : null;

  // 5. USER_NOT_RANKED — rows exist but no entry for this user
  if (!userEntry) {
    return {
      kind: 'USER_NOT_RANKED',
      hero: {
        kicker: 'WEJDŹ NA TABLICĘ',
        title: 'PIERWSZY CZAS',
        body: 'Zjedź czysto z bramki i ustaw swój ranking.',
        pressureLine: 'Tablica już żyje.',
        tone: 'green',
        leaderTime: formatTimeShort(leaderTimeMs),
      },
      topRows,
      stickyUserRow: null,
      tailRows: allRows.slice(3),
      cta: { label: 'START Z BRAMKI', action: 'RANKED_RUN' },
      proofCard: null,
    };
  }

  const userTime = formatTimeShort(userEntry.bestDurationMs);
  const userPosition = userEntry.currentPosition;
  const userPodiumRow = makePodiumRow(userEntry, leaderTimeMs);

  // 6. USER_LEADS — title is the trail name (not "#1"), so the badge
  // and the kicker carry the position info without doubling it up.
  if (userPosition === 1) {
    return {
      kind: 'USER_LEADS',
      hero: {
        kicker: 'BRONISZ #1',
        title: focusTrail.name.toUpperCase(),
        body: `Twój rekord: ${userTime}`,
        pressureLine: 'Nikt dziś nie jest szybszy.',
        tone: 'green',
        positionBadge: '#1',
        leaderTime: userTime,
      },
      topRows,
      stickyUserRow: null,
      tailRows: allRows.slice(3),
      cta: { label: 'OBROŃ #1', action: 'RANKED_RUN' },
      proofCard: null,
    };
  }

  // 7. USER_CHASING
  const leaderEntry = leaderboardRows[0];
  const leaderName = leaderEntry.username;
  const gapMs = userEntry.bestDurationMs - leaderTimeMs;
  const gapText = formatGapMs(gapMs);
  // Body prefers naming the rival; falls back honestly when name missing.
  const chasingBody = leaderName
    ? `Do ${leaderName} brakuje ${gapText}`
    : gapMs > 0
      ? `Do lidera brakuje ${gapText}`
      : 'Lider jest przed Tobą';

  // Sticky row only if user is outside the top 3 (otherwise user is
  // already visible in topRows and we don't duplicate them).
  const stickyUserRow = userPosition > 3 ? userPodiumRow : null;
  // Tail excludes both the top 3 and (if separated) the user row itself,
  // so the list reads cleanly: top 3 → ··· → TY → rest.
  const tailRows = allRows
    .slice(3)
    .filter((r) => !stickyUserRow || r.userId !== stickyUserRow.userId);

  return {
    kind: 'USER_CHASING',
    hero: {
      kicker: 'POLUJESZ NA LIDERA',
      title: `JESTEŚ #${userPosition}`,
      body: chasingBody,
      pressureLine: `Twój PB: ${userTime}`,
      tone: 'amber',
      positionBadge: `#${userPosition}`,
      leaderTime: formatTimeShort(leaderTimeMs),
      gapText,
    },
    topRows,
    stickyUserRow,
    tailRows,
    cta: { label: 'ODBIJ POZYCJĘ', action: 'RANKED_RUN' },
    proofCard: null,
  };
}
