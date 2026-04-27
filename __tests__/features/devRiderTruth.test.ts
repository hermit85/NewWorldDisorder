// ═══════════════════════════════════════════════════════════
// Dev rider truth — pre-TestFlight cross-screen consistency.
//
// Builds a fixture matching the actual dev rider state on the
// device (WWA Bike Park, Prezydencka verified, PB 1:21.0, today
// scope empty) and runs it through every screen's derive helper.
// Asserts that all four screens land in the EXACT states a fresh
// 4-screen QA expects:
//
//   - Home   → USER_HAS_TIME · ATAK NA CZAS · PREZYDENCKA
//   - Spoty  → USER_HAS_PB · TWOJA ARENA · 1 active trail
//   - Tablica (today) → SCOPE_EMPTY + proof card with rider as #1
//   - JA     → pioneerCount/pbCount/bikeParksCount = 0/1/1
//
// Failure here means the cross-screen "single truth" invariant
// broke and SPOTY/Home/Tablica/JA would disagree on what the
// rider sees.
// ═══════════════════════════════════════════════════════════

import { deriveHomeMission } from '@/features/home/mission';
import { deriveSpotArenaState } from '@/features/spots/arenaState';
import { deriveLeaderboardState } from '@/features/leaderboard/state';
import { derivePassport } from '@/features/profile/passport';
import { resolveSpotArenaRoute } from '@/features/spots/route';
import { resolveHomeMissionRoute } from '@/features/home/route';
import type { CalibrationStatus, LeaderboardEntry, Spot, Trail } from '@/data/types';
import type { PrimarySpotSummary } from '@/lib/api';
import type { TablicaSection } from '@/hooks/useTablicaSections';

const USER_ID = 'hermit-nwd';
const USER_NAME = 'hermit_nwd';
const PB_MS = 81_000; // 1:21.0
const PB_FORMATTED = '1:21.0';

const DEV_SPOT: Spot = {
  id: 'spot-wwa',
  name: 'WWA Bike Park',
  slug: 'wwa-bike-park',
  description: '',
  region: 'mazowieckie', // DB stores lowercased — display layer capitalises
  isOfficial: true,
  coverImage: '',
  status: 'active',
  submissionStatus: 'active',
  activeRidersToday: 0,
  trailCount: 0, // intentional — proves no helper trusts this scalar
} as any as Spot;

const DEV_TRAIL: Trail = {
  id: 'trail-prezydencka',
  spotId: DEV_SPOT.id,
  name: 'Prezydencka',
  slug: 'prezydencka',
  description: '',
  difficulty: 'S2' as any,
  trailType: 'enduro' as any,
  distanceM: 800,
  elevationDropM: 120,
  isOfficial: true,
  isActive: true,
  sortOrder: 0,
  calibrationStatus: 'verified' as CalibrationStatus,
  geometryMissing: false,
  seedSource: null,
  pioneerUserId: USER_ID,
  geometryVersion: 1,
  trustTier: 'verified',
} as any as Trail;

const PRIMARY_SPOT_SUMMARY: PrimarySpotSummary = {
  spot: DEV_SPOT,
  trailCount: 1,
  bestDurationMs: PB_MS,
};

const HISTORY_ROW: LeaderboardEntry = {
  userId: USER_ID,
  username: USER_NAME,
  rankId: 'sender' as any,
  trailId: DEV_TRAIL.id,
  periodType: 'all_time',
  bestDurationMs: PB_MS,
  currentPosition: 1,
  previousPosition: 1,
  delta: 0,
  gapToNext: 0,
  gapToLeader: 0,
  isCurrentUser: true,
  avatarUrl: null,
};

const DEV_TABLICA_SECTIONS: TablicaSection[] = [
  {
    spot: DEV_SPOT,
    trails: [
      {
        trail: DEV_TRAIL,
        userPbMs: PB_MS,
        userPosition: 1,
        userRunCount: 10,
      },
    ],
    lastRunAt: new Date().toISOString(),
  },
];

describe('dev rider truth (pre-TestFlight)', () => {
  test('Home → USER_HAS_TIME · ATAK NA CZAS · PREZYDENCKA', () => {
    const m = deriveHomeMission({
      primarySpotSummary: PRIMARY_SPOT_SUMMARY,
      trails: [DEV_TRAIL],
      heroBeat: null,
    });
    expect(m.kind).toBe('USER_HAS_TIME');
    expect(m.kicker).toBe('ATAK NA CZAS');
    expect(m.title).toBe('PREZYDENCKA');
    expect(m.body).toContain(PB_FORMATTED);
    expect(m.action).toBe('RANKED_RUN');

    const route = resolveHomeMissionRoute(m, { primarySpotId: DEV_SPOT.id });
    expect(route?.pathname).toBe('/run/active');
    expect(route?.params?.intent).toBe('ranked');
  });

  test('Spoty → USER_HAS_PB · TWOJA ARENA · 1 active trail · region capitalised', () => {
    const a = deriveSpotArenaState({
      spot: DEV_SPOT,
      trails: [DEV_TRAIL],
      userPbsByTrailId: new Map([[DEV_TRAIL.id, PB_MS]]),
    });
    expect(a.kind).toBe('USER_HAS_PB');
    expect(a.label).toBe('TWOJA ARENA');
    expect(a.cta).toBe('ATAK NA CZAS');
    expect(a.activeTrailCount).toBe(1);
    expect(a.totalTrailCount).toBe(1);
    expect(a.userPbMs).toBe(PB_MS);
    // The display-layer fix for "mazowieckie" → "Mazowieckie".
    expect(a.meta).toContain('Mazowieckie');
    expect(a.meta).not.toContain('mazowieckie');
    expect(a.meta).toContain('Prezydencka');
    expect(a.meta).toContain(PB_FORMATTED);

    const route = resolveSpotArenaRoute(a, DEV_SPOT.id);
    expect(route.pathname).toBe('/trail/[id]');
    expect(route.pathname).not.toBe('/trail/new');
  });

  test('Tablica (today) → SCOPE_EMPTY + proof card with rider as #1', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: PRIMARY_SPOT_SUMMARY,
      trails: [DEV_TRAIL],
      focusTrail: DEV_TRAIL,
      leaderboardRows: [], // today is empty for this rider's dev data
      historyRows: [HISTORY_ROW],
      currentUserId: USER_ID,
      scope: 'today',
    });
    expect(s.kind).toBe('SCOPE_EMPTY');
    expect(s.kind).not.toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.proofCard).not.toBeNull();
    expect(s.proofCard?.leaderIsUser).toBe(true);
    expect(s.proofCard?.leaderName).toBe(USER_NAME);
    expect(s.proofCard?.leaderTime).toContain('1:21');
  });

  test('Tablica (rekordy) → USER_LEADS · BRONISZ #1 · title is trail (not "#1")', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: PRIMARY_SPOT_SUMMARY,
      trails: [DEV_TRAIL],
      focusTrail: DEV_TRAIL,
      leaderboardRows: [HISTORY_ROW],
      historyRows: [HISTORY_ROW],
      currentUserId: USER_ID,
      scope: 'all_time',
    });
    expect(s.kind).toBe('USER_LEADS');
    expect(s.hero.kicker).toBe('BRONISZ #1');
    expect(s.hero.title).toBe('PREZYDENCKA');
    expect(s.hero.title).not.toBe('#1'); // pin the LEADS-redundancy fix
  });

  test('JA → pioneerCount=0, pbCount=1, bikeParksCount=1, records[0] = Prezydencka #1', () => {
    const p = derivePassport({
      sections: DEV_TABLICA_SECTIONS,
      pioneerCount: 0,
      passaDays: 0,
    });
    expect(p.bikeParksCount).toBe(1);
    expect(p.pbCount).toBe(1);
    expect(p.pioneerCount).toBe(0);
    expect(p.records).toHaveLength(1);
    expect(p.records[0].trailName).toBe('Prezydencka');
    expect(p.records[0].spotName).toBe('WWA Bike Park');
    expect(p.records[0].position).toBe(1);
    expect(p.records[0].pbMs).toBe(PB_MS);
  });

  test('cross-screen invariant: every screen agrees on the trail name', () => {
    const home = deriveHomeMission({
      primarySpotSummary: PRIMARY_SPOT_SUMMARY,
      trails: [DEV_TRAIL],
      heroBeat: null,
    });
    const spoty = deriveSpotArenaState({
      spot: DEV_SPOT,
      trails: [DEV_TRAIL],
      userPbsByTrailId: new Map([[DEV_TRAIL.id, PB_MS]]),
    });
    const passport = derivePassport({
      sections: DEV_TABLICA_SECTIONS,
      pioneerCount: 0,
      passaDays: 0,
    });

    // Home title is uppercased trail; Spoty meta + Passport record
    // both reference the same trail in their natural casing.
    expect(home.title).toBe('PREZYDENCKA');
    expect(spoty.meta).toContain('Prezydencka');
    expect(passport.records[0].trailName).toBe('Prezydencka');
  });

  test('cross-screen invariant: every screen agrees on the PB time', () => {
    const home = deriveHomeMission({
      primarySpotSummary: PRIMARY_SPOT_SUMMARY,
      trails: [DEV_TRAIL],
      heroBeat: null,
    });
    const spoty = deriveSpotArenaState({
      spot: DEV_SPOT,
      trails: [DEV_TRAIL],
      userPbsByTrailId: new Map([[DEV_TRAIL.id, PB_MS]]),
    });
    expect(home.body).toContain(PB_FORMATTED);
    expect(spoty.meta).toContain(PB_FORMATTED);
  });
});
