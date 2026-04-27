// ═══════════════════════════════════════════════════════════
// deriveSpotArenaState — pins SPOTY's per-card truthful state.
//
// Sister to homeMission / leaderboardState / passport tests.
// Every test asserts at least one of the previously-broken
// claims SPOTY used to render: "0 trasy when trail exists",
// "PIONEER SLOT WOLNY when verified trail exists", or pioneer
// CTA when the rider clearly already has a PB.
// ═══════════════════════════════════════════════════════════

import { deriveSpotArenaState } from '@/features/spots/arenaState';
import type { CalibrationStatus, Spot, Trail } from '@/data/types';

function makeSpot(overrides: Partial<Spot> = {}): Spot {
  return {
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
    trailCount: 0, // intentionally 0 — proves the helper ignores this lie
    ...overrides,
  } as any as Spot;
}

function makeTrail(overrides: Partial<Trail> & { id: string; name?: string }): Trail {
  const base = {
    spotId: 'spot-1',
    slug: overrides.id,
    description: '',
    difficulty: 'S2' as any,
    trailType: 'enduro' as any,
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
    name: 'Prezydencka',
  };
  return { ...base, ...overrides } as any as Trail;
}

describe('deriveSpotArenaState', () => {
  test('NO_TRAILS — no trails at all', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [],
      userPbsByTrailId: new Map(),
    });
    expect(a.kind).toBe('NO_TRAILS');
    expect(a.label).toBe('PIONIER POTRZEBNY');
    expect(a.cta).toBe('UTWÓRZ PIERWSZĄ TRASĘ');
    expect(a.activeTrailCount).toBe(0);
    expect(a.totalTrailCount).toBe(0);
  });

  test('CALIBRATING — trails exist but none verified, never claims "0 trasy"', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [
        makeTrail({ id: 't1', calibrationStatus: 'fresh_pending_second_run' }),
      ],
      userPbsByTrailId: new Map(),
    });
    expect(a.kind).toBe('CALIBRATING');
    expect(a.label).toBe('TRASA W KALIBRACJI');
    expect(a.activeTrailCount).toBe(0);
    expect(a.totalTrailCount).toBe(1);
    expect(a.meta).toContain('1 trasa w kalibracji');
    // Crucially: cannot claim "0 trasy" — that's the bug we're pinning.
    expect(a.meta).not.toContain('0 tras');
  });

  test('ACTIVE — single verified trail, no PB; never says "PIONEER SLOT WOLNY"', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [makeTrail({ id: 't1', name: 'Prezydencka' })],
      userPbsByTrailId: new Map(),
    });
    expect(a.kind).toBe('ACTIVE');
    expect(a.label).toBe('ARENA AKTYWNA');
    expect(a.cta).toBe('WEJDŹ DO ARENY');
    expect(a.promotedTrailName).toBe('Prezydencka');
    expect(a.label).not.toContain('PIONIER');
    expect(a.cta).not.toContain('PIONIER');
  });

  test('USER_HAS_PB — verified trail + rider PB; promotes to "ATAK NA CZAS"', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [makeTrail({ id: 't1', name: 'Prezydencka' })],
      userPbsByTrailId: new Map([['t1', 81_000]]),
    });
    expect(a.kind).toBe('USER_HAS_PB');
    expect(a.label).toBe('TWOJA ARENA');
    expect(a.cta).toBe('ATAK NA CZAS');
    expect(a.userPbMs).toBe(81_000);
    expect(a.meta).toContain('Prezydencka');
    expect(a.meta).toContain('1:21');
    // The original SPOTY screen said "PIONEER SLOT WOLNY / JEDŹ JAKO
    // PIONIER" when the rider was clearly already #1 with a verified
    // PB. Pin those exact lies.
    expect(a.label).not.toContain('PIONIER');
    expect(a.cta).not.toContain('PIONIER');
  });

  test('USER_HAS_PB — promotes the trail where the rider has the PB, not the first verified', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [
        makeTrail({ id: 't1', name: 'Czarna' }),
        makeTrail({ id: 't2', name: 'Prezydencka' }),
      ],
      userPbsByTrailId: new Map([['t2', 81_000]]),
    });
    expect(a.kind).toBe('USER_HAS_PB');
    expect(a.promotedTrailId).toBe('t2');
    expect(a.promotedTrailName).toBe('Prezydencka');
    expect(a.meta).toContain('Prezydencka');
  });

  test('MULTI_TRAIL — multiple verified trails, no PB on any', () => {
    const a = deriveSpotArenaState({
      spot: makeSpot(),
      trails: [
        makeTrail({ id: 't1', name: 'Prezydencka' }),
        makeTrail({ id: 't2', name: 'Czarna' }),
        makeTrail({ id: 't3', name: 'Salomea' }),
      ],
      userPbsByTrailId: new Map(),
    });
    expect(a.kind).toBe('MULTI_TRAIL');
    expect(a.label).toContain('TRASY AKTYWNE');
    expect(a.cta).toBe('WYBIERZ TRASĘ');
    expect(a.activeTrailCount).toBe(3);
  });

  test('header counters: helper exposes activeTrailCount totals from trails, never from spot.trailCount', () => {
    // The DB column on `spots` is denormalised and `mapSpot` zeros it
    // out; if the helper trusted it the counter would always be 0.
    const a = deriveSpotArenaState({
      spot: makeSpot({ trailCount: 0 } as any),
      trails: [
        makeTrail({ id: 't1' }),
        makeTrail({ id: 't2' }),
      ],
      userPbsByTrailId: new Map(),
    });
    expect(a.activeTrailCount).toBe(2);
    expect(a.totalTrailCount).toBe(2);
  });
});
