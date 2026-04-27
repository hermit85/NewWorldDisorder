// ═══════════════════════════════════════════════════════════
// deriveLeaderboardState — pins Tablica's seven competitive
// states. Sister to homeMission.test.ts; same discipline:
// truthful copy, no invented riders, no invented gaps.
// ═══════════════════════════════════════════════════════════

import { deriveLeaderboardState } from '@/features/leaderboard/state';
import type { LeaderboardEntry, Trail } from '@/data/types';
import type { PrimarySpotSummary } from '@/lib/api';

function makeSpot(overrides: Partial<PrimarySpotSummary> = {}): PrimarySpotSummary {
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
      trailCount: 1,
    } as any,
    trailCount: 1,
    bestDurationMs: null,
    ...overrides,
  };
}

function makeTrail(overrides: Partial<Trail> = {}): Trail {
  return {
    id: 'trail-1',
    spotId: 'spot-1',
    name: 'Prezydencka',
    slug: 'prezydencka',
    description: '',
    difficulty: 'S2' as any,
    trailType: 'enduro' as any,
    distanceM: 800,
    elevationDropM: 120,
    isOfficial: false,
    isActive: true,
    sortOrder: 0,
    calibrationStatus: 'verified',
    geometryMissing: false,
    seedSource: null,
    pioneerUserId: null,
    geometryVersion: 0,
    trustTier: 'verified',
    ...overrides,
  } as any as Trail;
}

function makeEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    userId: 'user-other',
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

// Convenience — every test wants the same scope+history defaults
// unless it's specifically pinning the scope-aware branches.
const DEFAULTS = {
  scope: 'today' as const,
  historyRows: [] as LeaderboardEntry[],
};

describe('deriveLeaderboardState', () => {
  test('NO_SPOT — no primary spot', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: null,
      trails: [],
      focusTrail: null,
      leaderboardRows: [],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('NO_SPOT');
    expect(s.cta?.action).toBe('ADD_SPOT');
    expect(s.hero.tone).toBe('green');
    expect(s.topRows).toEqual([]);
    expect(s.proofCard).toBeNull();
  });

  test('NO_TRAILS — spot exists, no trails', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot({ trailCount: 0 }),
      trails: [],
      focusTrail: null,
      leaderboardRows: [],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('NO_TRAILS');
    expect(s.cta?.action).toBe('PIONEER_TRAIL');
    expect(s.hero.tone).toBe('amber');
  });

  test('NO_VERIFIED_TRAILS — trails exist but none verified', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail({ calibrationStatus: 'fresh_pending_second_run' })],
      focusTrail: null,
      leaderboardRows: [],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('NO_VERIFIED_TRAILS');
    expect(s.cta?.action).toBe('CALIBRATION_RUN');
  });

  test('TRAIL_LEAGUE_EMPTY — trail has no scoped rows AND no history', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
    historyRows: [],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.hero.title).toBe('USTAW PIERWSZY WYNIK');
    expect(s.cta?.action).toBe('RANKED_RUN');
    expect(s.cta?.label).toBe('START Z BRAMKI');
    expect(s.proofCard).toBeNull();
  });

  test('TRAIL_LEAGUE_EMPTY — even on all-time scope when truly empty', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'all_time',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('TRAIL_LEAGUE_EMPTY');
  });

  test('SCOPE_EMPTY (today) — today is empty but history exists', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'today',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('SCOPE_EMPTY');
    expect(s.hero.kicker).toBe('DZIŚ JESZCZE PUSTO');
    expect(s.hero.title).toBe('USTAW CZAS DNIA');
    expect(s.hero.body).toBe('Pierwszy czysty zjazd ustawi tę tablicę.');
    expect(s.hero.tone).toBe('green');
    expect(s.cta?.label).toBe('START Z BRAMKI');
    expect(s.proofCard?.leaderName).toBe('kacper');
    expect(s.proofCard?.leaderTime).toContain('1:19');
  });

  test('SCOPE_EMPTY (weekend) — weekend-flavoured copy', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'weekend',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.hero.kicker).toBe('WEEKEND JESZCZE PUSTY');
    expect(s.hero.title).toBe('USTAW CZAS WEEKENDU');
  });

  test('proofCard — leader is current user', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'today',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 1, bestDurationMs: 81_000, isCurrentUser: true }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.proofCard?.leaderIsUser).toBe(true);
    expect(s.proofCard?.leaderName).toBe('me');
    // No separate user row — leader IS the user.
    expect(s.proofCard?.userRank).toBe(1);
  });

  test('proofCard — leader is someone else, user has all-time rank', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'today',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
        makeEntry({ userId: 'b', username: 'mateusz', currentPosition: 2, bestDurationMs: 80_500 }),
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 4, bestDurationMs: 83_100, isCurrentUser: true }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.proofCard?.leaderIsUser).toBe(false);
    expect(s.proofCard?.leaderName).toBe('kacper');
    expect(s.proofCard?.userRank).toBe(4);
    expect(s.proofCard?.userTime).toContain('1:23');
  });

  test('proofCard — leader is someone else, user has no rank', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'today',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.proofCard?.leaderIsUser).toBe(false);
    expect(s.proofCard?.userRank).toBeNull();
    expect(s.proofCard?.userTime).toBeNull();
  });

  test('USER_NOT_RANKED — rows exist, user missing', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
        makeEntry({ userId: 'b', username: 'mateusz', currentPosition: 2, bestDurationMs: 81_000 }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('USER_NOT_RANKED');
    expect(s.topRows).toHaveLength(2);
    expect(s.hero.leaderTime).toBeDefined();
  });

  test('USER_LEADS — user is #1; title is trail name (no "#1" duplication)', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 1, bestDurationMs: 79_400, isCurrentUser: true }),
        makeEntry({ userId: 'b', username: 'kacper', currentPosition: 2, bestDurationMs: 81_000 }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('USER_LEADS');
    expect(s.hero.kicker).toBe('BRONISZ #1');
    expect(s.hero.positionBadge).toBe('#1');
    // Title carries the trail; the position lives in kicker + badge only.
    expect(s.hero.title).toBe('PREZYDENCKA');
    expect(s.hero.title).not.toBe('#1');
    expect(s.hero.body).toContain('Twój rekord');
    expect(s.hero.body).not.toContain('PREZYDENCKA');
    expect(s.hero.tone).toBe('green');
    expect(s.topRows[0].isCurrentUser).toBe(true);
    expect(s.cta?.label).toBe('OBROŃ #1');
  });

  test('SCOPE_EMPTY does not regress to TRAIL_LEAGUE_EMPTY when history exists', () => {
    // Repro of the regression risk we want to pin: scoped rows are
    // empty (today is fresh) but historyRows is non-empty. The state
    // MUST resolve to SCOPE_EMPTY with a proof card, never to the
    // "TABLICA PUSTA" branch which would read as a dead product.
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      scope: 'today',
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [],
      historyRows: [
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 1, bestDurationMs: 81_000, isCurrentUser: true }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('SCOPE_EMPTY');
    expect(s.kind).not.toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.proofCard).not.toBeNull();
  });

  test('USER_CHASING — user is #2, names rival, computes gap', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [
        makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 2, bestDurationMs: 81_000, isCurrentUser: true }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('USER_CHASING');
    expect(s.hero.positionBadge).toBe('#2');
    expect(s.hero.body).toContain('kacper');
    expect(s.hero.body).toContain('+1.6s');
    expect(s.hero.tone).toBe('amber');
    expect(s.cta?.label).toBe('ODBIJ POZYCJĘ');
    // Top 3 already contains user (rank 2) — no sticky duplication.
    expect(s.stickyUserRow).toBeNull();
  });

  test('USER_CHASING outside top 3 — sticky user row present, deduped from tail', () => {
    const rows: LeaderboardEntry[] = [
      makeEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
      makeEntry({ userId: 'b', username: 'mateusz', currentPosition: 2, bestDurationMs: 80_500 }),
      makeEntry({ userId: 'c', username: 'ania', currentPosition: 3, bestDurationMs: 81_300 }),
      makeEntry({ userId: 'd', username: 'jan', currentPosition: 4, bestDurationMs: 82_000 }),
      makeEntry({ userId: 'user-me', username: 'me', currentPosition: 5, bestDurationMs: 83_100, isCurrentUser: true }),
      makeEntry({ userId: 'e', username: 'piotr', currentPosition: 6, bestDurationMs: 83_900 }),
    ];
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: rows,
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('USER_CHASING');
    expect(s.stickyUserRow).not.toBeNull();
    expect(s.stickyUserRow?.rank).toBe(5);
    expect(s.tailRows.find((r) => r.userId === 'user-me')).toBeUndefined();
    expect(s.tailRows.map((r) => r.userId)).toEqual(['d', 'e']);
  });

  test('USER_CHASING fallback — no leader name → "lider"', () => {
    const s = deriveLeaderboardState({
      ...DEFAULTS,
      primarySpotSummary: makeSpot(),
      trails: [makeTrail()],
      focusTrail: makeTrail(),
      leaderboardRows: [
        makeEntry({ userId: 'a', username: '', currentPosition: 1, bestDurationMs: 79_400 }),
        makeEntry({ userId: 'user-me', username: 'me', currentPosition: 2, bestDurationMs: 81_000, isCurrentUser: true }),
      ],
      currentUserId: 'user-me',
    });
    expect(s.kind).toBe('USER_CHASING');
    expect(s.hero.body).toContain('Do lidera');
    expect(s.hero.body).toContain('+1.6s');
  });
});
