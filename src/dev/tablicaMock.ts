// ═══════════════════════════════════════════════════════════
// tablicaMock — __DEV__-only fixture data for walk-test screenshots.
//
// In production __DEV__ is false → these constants are reachable
// via dead-code-elimination only when __DEV__ is true. The screens
// import them BUT only render mocks when both:
//   1. __DEV__ === true (runtime guard)
//   2. real data fetch returned empty
//
// This way:
//   - Walk-test on __DEV__ build with empty backend → see mocks
//   - Walk-test on __DEV__ build with real data → see real (mocks
//     never displace truth)
//   - Production build → __DEV__ false, always real, mocks excluded
//
// Per spec Krok 9: 5 walk-test screenshots required. Mock variants
// here cover all 5 scenarios.
// ═══════════════════════════════════════════════════════════

import type { LeaderboardEntry, Spot, Trail } from '@/data/types';
import type { TablicaSection } from '@/hooks/useTablicaSections';

// ── TablicaScreen Stan A — 2 parks, 6 trails, mixed times ──

const MOCK_SPOT_SLOTWINY: Spot = {
  id: 'mock-spot-slotwiny',
  slug: 'slotwiny-arena',
  name: 'Słotwiny Arena',
  region: 'Małopolskie',
  status: 'active',
  submissionStatus: 'active',
  trailCount: 4,
  activeRidersToday: 41,
  description: '',
  isOfficial: true,
  coverImage: '',
};

const MOCK_SPOT_BESKID: Spot = {
  id: 'mock-spot-beskid',
  slug: 'bike-park-beskid',
  name: 'Bike Park Beskid',
  region: 'Śląskie',
  status: 'active',
  submissionStatus: 'active',
  trailCount: 2,
  activeRidersToday: 18,
  description: '',
  isOfficial: true,
  coverImage: '',
};

function mockTrail(
  id: string,
  spotId: string,
  name: string,
  difficulty: Trail['difficulty'],
): Trail {
  return {
    id,
    spotId,
    name,
    slug: id,
    description: '',
    difficulty,
    trailType: 'downhill',
    distanceM: 1200,
    elevationDropM: 200,
    isOfficial: true,
    isActive: true,
    sortOrder: 0,
    calibrationStatus: 'verified',
    geometryMissing: false,
    seedSource: 'curator',
    trustTier: 'verified',
    confidenceLabel: 'confirmed',
    consistentPioneerRunsCount: 5,
    uniqueConfirmingRidersCount: 5,
    currentVersionId: 'mock-version',
    pioneerUserId: null,
    pioneerUsername: null,
    pioneeredAt: null,
  };
}

export const MOCK_TABLICA_SECTIONS: TablicaSection[] = [
  {
    spot: MOCK_SPOT_SLOTWINY,
    lastRunAt: '2026-04-26T16:30:00Z',
    trails: [
      {
        trail: mockTrail('mock-tr-dzida', 'mock-spot-slotwiny', 'Dzida', 'hard'),
        userPbMs: 86_000,
        userPosition: 5,
        userRunCount: 38,
      },
      {
        trail: mockTrail('mock-tr-galgan', 'mock-spot-slotwiny', 'Gałgan', 'medium'),
        userPbMs: 102_300,
        userPosition: 1,
        userRunCount: 64,
      },
      {
        trail: mockTrail('mock-tr-kometa', 'mock-spot-slotwiny', 'Kometa', 'medium'),
        userPbMs: null,
        userPosition: null,
        userRunCount: 22,
      },
      {
        trail: mockTrail('mock-tr-dookola', 'mock-spot-slotwiny', 'Dookoła Świata', 'easy'),
        userPbMs: null,
        userPosition: null,
        userRunCount: 12,
      },
    ],
  },
  {
    spot: MOCK_SPOT_BESKID,
    lastRunAt: '2026-04-22T11:15:00Z',
    trails: [
      {
        trail: mockTrail('mock-tr-czarna', 'mock-spot-beskid', 'Czarna', 'hard'),
        userPbMs: 131_400,
        userPosition: 7,
        userRunCount: 18,
      },
      {
        trail: mockTrail('mock-tr-trasab', 'mock-spot-beskid', 'Trasa B', 'medium'),
        userPbMs: null,
        userPosition: null,
        userRunCount: 5,
      },
    ],
  },
];

// ── RankingScreen — 3 leaderboard variants ──

function mockEntry(
  position: number,
  username: string,
  bestDurationMs: number,
  isCurrentUser: boolean = false,
  avatarUrl: string | null = null,
): LeaderboardEntry {
  return {
    userId: `mock-user-${position}-${username}`,
    username,
    rankId: 'rider',
    trailId: 'mock-tr-dzida',
    periodType: 'all_time',
    bestDurationMs,
    currentPosition: position,
    previousPosition: position,
    delta: 0,
    gapToNext: 0,
    gapToLeader: 0,
    isCurrentUser,
    avatarUrl,
  };
}

/** Variant 1: rider is #5 (mid-pack) — most common walk-test scenario. */
export const MOCK_LEADERBOARD_USER_5: LeaderboardEntry[] = [
  mockEntry(1, 'kamil_z', 81_000),
  mockEntry(2, 'mateusz_p', 83_400),
  mockEntry(3, 'jan_w', 84_100),
  mockEntry(4, 'wojtek_27', 85_800),
  mockEntry(5, 'hermit_nwd', 86_000, true),
  mockEntry(6, 'marek_dh', 87_200),
  mockEntry(7, 'ania_park', 88_400),
  mockEntry(8, 'rider_22', 89_100),
];

/** Variant 2: rider is #1 — self override + pioneer combo. */
export const MOCK_LEADERBOARD_USER_1: LeaderboardEntry[] = [
  mockEntry(1, 'hermit_nwd', 81_000, true),
  mockEntry(2, 'kamil_z', 83_400),
  mockEntry(3, 'mateusz_p', 84_100),
  mockEntry(4, 'wojtek_27', 85_800),
  mockEntry(5, 'jan_w', 86_000),
  mockEntry(6, 'marek_dh', 87_200),
  mockEntry(7, 'ania_park', 88_400),
  mockEntry(8, 'rider_22', 89_100),
];

/** Variant 3: rider is #14 — out-of-top-8 separator scenario. */
export const MOCK_LEADERBOARD_USER_14: LeaderboardEntry[] = [
  mockEntry(1, 'kamil_z', 81_000),
  mockEntry(2, 'mateusz_p', 83_400),
  mockEntry(3, 'jan_w', 84_100),
  mockEntry(4, 'wojtek_27', 85_800),
  mockEntry(5, 'lukasz_dh', 86_000),
  mockEntry(6, 'marek_dh', 87_200),
  mockEntry(7, 'ania_park', 88_400),
  mockEntry(8, 'rider_22', 89_100),
  // Hidden middle (would render only top 8 + separator + this self row)
  mockEntry(14, 'hermit_nwd', 94_500, true),
];

/** Pick a default variant — the #5 case is the canonical walk-test
 *  baseline. Override per-screen via local state if needed. */
export const MOCK_LEADERBOARD_DEFAULT = MOCK_LEADERBOARD_USER_5;

// Pioneer userId helper — Variant 1 makes the rider the pioneer when
// they're #1; Variants 2/3 make a different non-self user the pioneer.
export const MOCK_PIONEER_USER_ID_FOR_VARIANT_1 = MOCK_LEADERBOARD_USER_1[0].userId;
export const MOCK_PIONEER_USER_ID_FOR_OTHERS = MOCK_LEADERBOARD_USER_5[0].userId;

// Breadcrumb display for RankingScreen — IDs in mock URLs (e.g.
// `mock-tr-dzida`) don't exist in the DB, so useTrail/useSpot return
// null. These constants give the breadcrumb proper text under dev mocks.
export const MOCK_BREADCRUMB_SPOT_NAME = 'Słotwiny Arena';
export const MOCK_BREADCRUMB_TRAIL_NAME = 'Dzida';
export const MOCK_BREADCRUMB_DIFFICULTY: Trail['difficulty'] = 'hard';
