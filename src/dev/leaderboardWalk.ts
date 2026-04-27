// ─────────────────────────────────────────────────────────────
// Tablica walk-through harness — visual QA only.
//
// Activates via __DEV__ + ?walk=<state> query param on the
// /(tabs)/leaderboard route. Each WalkState bundles a complete
// `DeriveLeaderboardStateInput` so the screen renders that exact
// branch deterministically — useful for screenshot reviews of
// states that real data won't easily reproduce (USER_CHASING,
// outside-top-3 sticky row, truly-empty trail).
// ─────────────────────────────────────────────────────────────

import type {
  CalibrationStatus,
  LeaderboardEntry,
  Trail,
} from '@/data/types';
import type { PrimarySpotSummary } from '@/lib/api';
import type { DeriveLeaderboardStateInput } from '@/features/leaderboard/state';

export type WalkState =
  | 'leads'
  | 'chasing'
  | 'outside_top3'
  | 'not_ranked'
  | 'truly_empty';

const MOCK_USER_ID = 'walk-user-me';

const MOCK_SPOT: PrimarySpotSummary = {
  spot: {
    id: 'walk-spot',
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
};

const MOCK_TRAIL = {
  id: 'walk-trail-prezydencka',
  spotId: 'walk-spot',
  name: 'Prezydencka',
  slug: 'prezydencka',
  description: '',
  difficulty: 'S2',
  trailType: 'enduro',
  distanceM: 800,
  elevationDropM: 120,
  isOfficial: false,
  isActive: true,
  sortOrder: 0,
  calibrationStatus: 'verified' as CalibrationStatus,
  geometryMissing: false,
  seedSource: null,
  pioneerUserId: null,
  geometryVersion: 0,
  trustTier: 'verified',
} as any as Trail;

function mkEntry(o: Partial<LeaderboardEntry>): LeaderboardEntry {
  return {
    userId: 'mock-user',
    username: 'rider',
    rankId: 'sender' as any,
    trailId: MOCK_TRAIL.id,
    periodType: 'all_time',
    bestDurationMs: 80_000,
    currentPosition: 1,
    previousPosition: 1,
    delta: 0,
    gapToNext: 0,
    gapToLeader: 0,
    isCurrentUser: false,
    avatarUrl: null,
    ...o,
  };
}

const ROWS_LEADS: LeaderboardEntry[] = [
  mkEntry({ userId: MOCK_USER_ID, username: 'hermit_nwd', currentPosition: 1, bestDurationMs: 79_400, isCurrentUser: true }),
  mkEntry({ userId: 'a', username: 'kacper', currentPosition: 2, bestDurationMs: 81_000 }),
  mkEntry({ userId: 'b', username: 'mateusz', currentPosition: 3, bestDurationMs: 82_800 }),
  mkEntry({ userId: 'c', username: 'ania', currentPosition: 4, bestDurationMs: 84_100 }),
];

const ROWS_CHASING: LeaderboardEntry[] = [
  mkEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
  mkEntry({ userId: MOCK_USER_ID, username: 'hermit_nwd', currentPosition: 2, bestDurationMs: 81_000, isCurrentUser: true }),
  mkEntry({ userId: 'b', username: 'mateusz', currentPosition: 3, bestDurationMs: 82_800 }),
];

const ROWS_OUTSIDE_TOP3: LeaderboardEntry[] = [
  mkEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
  mkEntry({ userId: 'b', username: 'mateusz', currentPosition: 2, bestDurationMs: 80_500 }),
  mkEntry({ userId: 'c', username: 'ania', currentPosition: 3, bestDurationMs: 81_300 }),
  mkEntry({ userId: 'd', username: 'jan', currentPosition: 4, bestDurationMs: 82_000 }),
  mkEntry({ userId: MOCK_USER_ID, username: 'hermit_nwd', currentPosition: 5, bestDurationMs: 83_100, isCurrentUser: true }),
  mkEntry({ userId: 'e', username: 'piotr', currentPosition: 6, bestDurationMs: 83_900 }),
];

const ROWS_NOT_RANKED: LeaderboardEntry[] = [
  mkEntry({ userId: 'a', username: 'kacper', currentPosition: 1, bestDurationMs: 79_400 }),
  mkEntry({ userId: 'b', username: 'mateusz', currentPosition: 2, bestDurationMs: 81_000 }),
  mkEntry({ userId: 'c', username: 'ania', currentPosition: 3, bestDurationMs: 82_800 }),
];

export function isWalkState(s: string | undefined): s is WalkState {
  return s === 'leads' || s === 'chasing' || s === 'outside_top3'
    || s === 'not_ranked' || s === 'truly_empty';
}

export function buildWalkInput(walk: WalkState): DeriveLeaderboardStateInput {
  switch (walk) {
    case 'leads':
      return {
        primarySpotSummary: MOCK_SPOT,
        trails: [MOCK_TRAIL],
        focusTrail: MOCK_TRAIL,
        leaderboardRows: ROWS_LEADS,
        historyRows: ROWS_LEADS,
        currentUserId: MOCK_USER_ID,
        scope: 'all_time',
      };
    case 'chasing':
      return {
        primarySpotSummary: MOCK_SPOT,
        trails: [MOCK_TRAIL],
        focusTrail: MOCK_TRAIL,
        leaderboardRows: ROWS_CHASING,
        historyRows: ROWS_CHASING,
        currentUserId: MOCK_USER_ID,
        scope: 'all_time',
      };
    case 'outside_top3':
      return {
        primarySpotSummary: MOCK_SPOT,
        trails: [MOCK_TRAIL],
        focusTrail: MOCK_TRAIL,
        leaderboardRows: ROWS_OUTSIDE_TOP3,
        historyRows: ROWS_OUTSIDE_TOP3,
        currentUserId: MOCK_USER_ID,
        scope: 'all_time',
      };
    case 'not_ranked':
      return {
        primarySpotSummary: MOCK_SPOT,
        trails: [MOCK_TRAIL],
        focusTrail: MOCK_TRAIL,
        leaderboardRows: ROWS_NOT_RANKED,
        historyRows: ROWS_NOT_RANKED,
        currentUserId: MOCK_USER_ID,
        scope: 'all_time',
      };
    case 'truly_empty':
      return {
        primarySpotSummary: MOCK_SPOT,
        trails: [MOCK_TRAIL],
        focusTrail: MOCK_TRAIL,
        leaderboardRows: [],
        historyRows: [],
        currentUserId: MOCK_USER_ID,
        scope: 'today',
      };
  }
}
