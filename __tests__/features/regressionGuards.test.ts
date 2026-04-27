// ═══════════════════════════════════════════════════════════
// Regression guards — every test pins ONE specific lie that
// the redesign fixed. Adding a passing assertion here means
// "this exact bug cannot silently come back".
//
// 1. Home always returns one mission (deriveHomeMission is total).
// 2. Spoty NO_TRAILS / PIONIER does NOT fire when a verified
//    active trail exists.
// 3. Spoty does NOT report 0 active trails when one exists.
// 4. Tablica today-empty-with-history → SCOPE_EMPTY, never
//    TRAIL_LEAGUE_EMPTY.
// 5. Tablica proof card exists when history exists.
// 6. JA locked achievement never displays 100% progress.
//
// The "Beta must not appear in production copy" + "PIONEER SLOT
// WOLNY / JEDŹ JAKO PIONIER must not appear in active render
// path" guards live in productionCopyGuard.test.ts.
// ═══════════════════════════════════════════════════════════

import { deriveHomeMission } from '@/features/home/mission';
import { deriveSpotArenaState } from '@/features/spots/arenaState';
import { deriveLeaderboardState } from '@/features/leaderboard/state';
import { deriveAchievementStatus } from '@/features/profile/achievement';
import type { CalibrationStatus, LeaderboardEntry, Trail } from '@/data/types';
import type { HeroBeat, PrimarySpotSummary } from '@/lib/api';

function spot(): PrimarySpotSummary {
  return {
    spot: {
      id: 'spot-1',
      name: 'WWA Bike Park',
      slug: 'wwa',
      description: '',
      region: 'Mazowieckie',
      isOfficial: false,
      coverImage: '',
      status: 'active',
      submissionStatus: 'active',
      activeRidersToday: 0,
      trailCount: 0, // intentionally lying — proves no helper trusts it
    } as any,
    trailCount: 1,
    bestDurationMs: null,
  };
}

function trail(overrides: Partial<Trail> & { id?: string } = {}): Trail {
  return {
    id: 'trail-1',
    spotId: 'spot-1',
    name: 'Prezydencka',
    slug: 'prezydencka',
    description: '',
    difficulty: 'S2',
    trailType: 'enduro',
    distanceM: 0,
    elevationDropM: 0,
    isOfficial: false,
    isActive: true,
    sortOrder: 0,
    calibrationStatus: 'verified' as CalibrationStatus,
    geometryMissing: false,
    seedSource: null,
    pioneerUserId: null,
    geometryVersion: 0,
    trustTier: 'verified',
    ...overrides,
  } as any as Trail;
}

function entry(overrides: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    userId: 'a',
    username: 'rider',
    rankId: 'sender' as any,
    trailId: 'trail-1',
    periodType: 'all_time',
    bestDurationMs: 80_000,
    currentPosition: 1,
    previousPosition: 1,
    delta: 0,
    gapToNext: 0,
    gapToLeader: 0,
    isCurrentUser: false,
    avatarUrl: null,
    ...overrides,
  };
}

describe('regression: Home always returns exactly one mission', () => {
  // deriveHomeMission is a total function. We sample five very
  // different inputs and assert each returns a defined kind that
  // belongs to the union — i.e. no input returns undefined / null.
  const SAMPLES: Array<{ name: string; build: () => Parameters<typeof deriveHomeMission>[0] }> = [
    { name: 'no spot', build: () => ({ primarySpotSummary: null, trails: [], heroBeat: null }) },
    {
      name: 'spot + no trails',
      build: () => ({
        primarySpotSummary: { ...spot(), trailCount: 0 },
        trails: [],
        heroBeat: null,
      }),
    },
    {
      name: 'spot + calibrating trail',
      build: () => ({
        primarySpotSummary: spot(),
        trails: [trail({ calibrationStatus: 'fresh_pending_second_run' })],
        heroBeat: null,
      }),
    },
    {
      name: 'spot + verified trail, no PB',
      build: () => ({
        primarySpotSummary: spot(),
        trails: [trail()],
        heroBeat: null,
      }),
    },
    {
      name: 'spot + verified trail + heroBeat (chasing)',
      build: () => ({
        primarySpotSummary: { ...spot(), bestDurationMs: 90_000 },
        trails: [trail()],
        heroBeat: {
          trailId: 'trail-1',
          trailName: 'Prezydencka',
          beaterName: 'Kacper',
          happenedAt: new Date().toISOString(),
          beaterTimeMs: 88_400,
          userTimeMs: 90_000,
          deltaMs: 1_600,
          previousPosition: 1,
          currentPosition: 2,
        } as HeroBeat,
      }),
    },
  ];

  test.each(SAMPLES)('returns a defined mission for: $name', ({ build }) => {
    const m = deriveHomeMission(build());
    expect(m).toBeDefined();
    expect(m.kind).toBeTruthy();
    expect(m.cta).toBeTruthy();
    expect(m.action).toBeTruthy();
  });
});

describe('regression: Spoty must not lie about pioneer / 0 trails', () => {
  test('verified trail + user PB → never NO_TRAILS, never CALIBRATING', () => {
    const s = deriveSpotArenaState({
      spot: spot().spot,
      trails: [trail()],
      userPbsByTrailId: new Map([['trail-1', 81_000]]),
    });
    expect(s.kind).not.toBe('NO_TRAILS');
    expect(s.kind).not.toBe('CALIBRATING');
    expect(s.label).not.toContain('PIONIER');
    expect(s.cta).not.toContain('PIONIER');
  });

  test('verified trail → activeTrailCount > 0 (no "0 active" lie)', () => {
    const s = deriveSpotArenaState({
      spot: spot().spot,
      trails: [trail()],
      userPbsByTrailId: new Map(),
    });
    expect(s.activeTrailCount).toBeGreaterThan(0);
    expect(s.totalTrailCount).toBeGreaterThan(0);
    expect(s.meta).not.toContain('0 trasy');
    expect(s.meta).not.toContain('0 aktywne');
  });

  test('helper ignores spot.trailCount (the denormalised lie)', () => {
    // The DB column was zeroed by mapSpot; trusting it produced the
    // "PIONEER SLOT WOLNY" regression. The helper recomputes from
    // the trails array — so even when spot.trailCount lies, output
    // is truthful.
    const lyingSpot = { ...spot().spot, trailCount: 0 };
    const s = deriveSpotArenaState({
      spot: lyingSpot,
      trails: [trail(), trail({ id: 'trail-2', name: 'Czarna' })],
      userPbsByTrailId: new Map(),
    });
    expect(s.activeTrailCount).toBe(2);
    expect(s.totalTrailCount).toBe(2);
  });
});

describe('regression: Tablica scope-empty must not collapse to truly-empty', () => {
  test('today empty + history non-empty → SCOPE_EMPTY with proof card', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: spot(),
      trails: [trail()],
      focusTrail: trail(),
      leaderboardRows: [],
      historyRows: [entry({ userId: 'me', username: 'me', isCurrentUser: true })],
      currentUserId: 'me',
      scope: 'today',
    });
    expect(s.kind).toBe('SCOPE_EMPTY');
    expect(s.kind).not.toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.proofCard).not.toBeNull();
  });

  test('weekend empty + history non-empty → SCOPE_EMPTY (weekend copy)', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: spot(),
      trails: [trail()],
      focusTrail: trail(),
      leaderboardRows: [],
      historyRows: [entry({ username: 'kacper' })],
      currentUserId: 'me',
      scope: 'weekend',
    });
    expect(s.kind).toBe('SCOPE_EMPTY');
    expect(s.hero.kicker).toContain('WEEKEND');
  });

  test('history empty AND scoped empty → TRAIL_LEAGUE_EMPTY (the only "Tablica pusta" path)', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: spot(),
      trails: [trail()],
      focusTrail: trail(),
      leaderboardRows: [],
      historyRows: [],
      currentUserId: 'me',
      scope: 'today',
    });
    expect(s.kind).toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.proofCard).toBeNull();
  });
});

describe('regression: JA achievement chip never lies "100% locked"', () => {
  // Repro of the original bug: scalar reaches target but server
  // hasn't synced the unlock yet. The pre-fix UI rendered "2/2
  // LOCKED". The helper now flips to unlocked locally.
  test('progress equals target → unlocked, no "X/X locked" chip', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 20 },
      [],
      { totalRuns: 20 },
    );
    expect(s.isUnlocked).toBe(true);
    expect(s.displayProgress).toBeNull();
  });

  test('locked chip clamps to target - 1 (never %target)', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 20 },
      [],
      { totalRuns: 19 },
    );
    expect(s.isUnlocked).toBe(false);
    expect(s.displayProgress).toBeLessThan(s.displayTarget!);
  });
});
