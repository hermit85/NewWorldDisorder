// ═══════════════════════════════════════════════════════════
// Founder reset — post-reset state assertions across screens.
//
// The destructive RPCs themselves (reset_my_test_data,
// delete_test_spot) live in supabase/migrations and are tested
// in the database harness. What we CAN pin here unit-side is
// the cross-screen invariant the user demanded:
//
//   "After reset:
//     Home    → no active mission / pioneer or add-arena state
//     Spoty   → no test bike park or no active trails
//     Tablica → no Prezydencka history
//     JA      → PB TRAS 0, BIKE PARKI 0, PASSA 0"
//
// We feed each screen's derive helper with the EXACT data shape
// the RPC leaves behind (runs/leaderboard/challenge/achievement
// rows wiped; profile + spot rows intact) and verify each screen
// flips to its fresh-rider equivalent.
// ═══════════════════════════════════════════════════════════

import { deriveHomeMission } from '@/features/home/mission';
import { deriveSpotArenaState } from '@/features/spots/arenaState';
import { deriveLeaderboardState } from '@/features/leaderboard/state';
import { derivePassport } from '@/features/profile/passport';
import type { CalibrationStatus, Spot, Trail } from '@/data/types';
import type { PrimarySpotSummary } from '@/lib/api';
import type { TablicaSection } from '@/hooks/useTablicaSections';

// Pre-reset fixture: rider has Prezydencka PB 1:21.0, is #1.
// Post-reset fixture: same spot/trail rows (we don't delete the
// trail), but zero runs / leaderboard / PB rows for the rider.

const SPOT: Spot = {
  id: 'spot-wwa',
  name: 'WWA Bike Park',
  slug: 'wwa',
  description: '',
  region: 'Mazowieckie',
  isOfficial: true,
  coverImage: '',
  status: 'active',
  submissionStatus: 'active',
  activeRidersToday: 0,
  trailCount: 0,
} as any as Spot;

const TRAIL: Trail = {
  id: 'trail-prezydencka',
  spotId: SPOT.id,
  name: 'Prezydencka',
  slug: 'prezydencka',
  description: '',
  difficulty: 'S2',
  trailType: 'enduro',
  distanceM: 800,
  elevationDropM: 120,
  isOfficial: true,
  isActive: true,
  sortOrder: 0,
  calibrationStatus: 'verified' as CalibrationStatus,
  geometryMissing: false,
  seedSource: null,
  pioneerUserId: null, // not the founder — keeps the trail alive
  geometryVersion: 1,
  trustTier: 'verified',
} as any as Trail;

// Post-reset PrimarySpotSummary: bestDurationMs flips to null
// because the underlying runs are gone. Spot row stays.
const POST_RESET_PRIMARY_SPOT: PrimarySpotSummary = {
  spot: SPOT,
  trailCount: 1,
  bestDurationMs: null,
};

// Post-reset Tablica sections from useTablicaSections: the hook
// groups spots BY the user's runs, so once runs are wiped the
// hook returns an empty array. The trail/spot rows still exist
// in the DB; they just don't surface in the rider's passport.
const POST_RESET_SECTIONS: TablicaSection[] = [];

describe('founder reset — derived state across screens', () => {
  test('Home flips to VERIFIED_NO_USER_TIME (verified trail still exists, no PB)', () => {
    const m = deriveHomeMission({
      primarySpotSummary: POST_RESET_PRIMARY_SPOT,
      trails: [TRAIL],
      heroBeat: null,
    });
    expect(m.kind).toBe('VERIFIED_NO_USER_TIME');
    expect(m.body).toContain('Ustaw swój pierwszy wynik');
    expect(m.cta).toBe('START Z BRAMKI');
  });

  test('Home falls back to NO_SPOT when spot itself was deleted', () => {
    const m = deriveHomeMission({
      primarySpotSummary: null,
      trails: [],
      heroBeat: null,
    });
    expect(m.kind).toBe('NO_SPOT');
    expect(m.cta).toBe('DODAJ BIKE PARK');
  });

  test('Spoty flips to ACTIVE (verified trail, no PB)', () => {
    const a = deriveSpotArenaState({
      spot: SPOT,
      trails: [TRAIL],
      userPbsByTrailId: new Map(),
    });
    expect(a.kind).toBe('ACTIVE');
    expect(a.label).toBe('ARENA AKTYWNA');
    expect(a.cta).toBe('WEJDŹ DO ARENY');
    // Critically: must NOT regress to PIONIER copy after reset.
    expect(a.label).not.toContain('PIONIER');
    expect(a.cta).not.toContain('PIONIER');
  });

  test('Tablica today scope: TRAIL_LEAGUE_EMPTY when both scoped + history empty', () => {
    const s = deriveLeaderboardState({
      primarySpotSummary: POST_RESET_PRIMARY_SPOT,
      trails: [TRAIL],
      focusTrail: TRAIL,
      leaderboardRows: [],
      historyRows: [],
      currentUserId: 'founder-user',
      scope: 'today',
    });
    expect(s.kind).toBe('TRAIL_LEAGUE_EMPTY');
    expect(s.proofCard).toBeNull();
  });

  test('JA passport counts collapse to 0 / 0 / 0', () => {
    const p = derivePassport({
      sections: POST_RESET_SECTIONS,
      pioneerCount: 0,
      passaDays: 0,
    });
    expect(p.bikeParksCount).toBe(0); // no trails with PBs → spot doesn't count
    expect(p.pbCount).toBe(0);
    expect(p.pioneerCount).toBe(0);
    expect(p.passaDays).toBe(0);
    expect(p.records).toEqual([]);
  });

  test('JA passport: empty sections (post-reset) → all counters at 0', () => {
    // useTablicaSections groups by user runs; after reset there are
    // no runs so there are no sections. This is the data-layer
    // invariant the founder reset relies on for cross-screen flip.
    const p = derivePassport({
      sections: [],
      pioneerCount: 0,
      passaDays: 0,
    });
    expect(p.bikeParksCount).toBe(0);
    expect(p.pbCount).toBe(0);
    expect(p.records).toHaveLength(0);
  });
});
