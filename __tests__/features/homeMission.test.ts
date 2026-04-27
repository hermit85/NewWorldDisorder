// ═══════════════════════════════════════════════════════════
// deriveHomeMission — pins the seven Home mission states so the
// state machine can't silently regress. Real-data variants were
// verified visually in the simulator (USER_HAS_TIME, USER_BEATEN);
// this file covers the rest plus fallback-copy invariants.
// ═══════════════════════════════════════════════════════════

import { deriveHomeMission } from '@/features/home/mission';
import type { Trail } from '@/data/types';
import type { HeroBeat, PrimarySpotSummary } from '@/lib/api';

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

function makeBeat(overrides: Partial<HeroBeat> = {}): HeroBeat {
  return {
    trailId: 'trail-1',
    trailName: 'Prezydencka',
    beaterName: 'Kacper',
    happenedAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
    beaterTimeMs: 88_400,
    userTimeMs: 90_000,
    deltaMs: 1_600,
    previousPosition: 1,
    currentPosition: 2,
    ...overrides,
  };
}

describe('deriveHomeMission', () => {
  test('NO_SPOT — no primary spot at all', () => {
    const m = deriveHomeMission({
      primarySpotSummary: null,
      trails: [],
      heroBeat: null,
    });
    expect(m.kind).toBe('NO_SPOT');
    expect(m.action).toBe('ADD_SPOT');
    expect(m.cta).toBe('DODAJ BIKE PARK');
    expect(m.tone).toBe('green');
    expect(m.positionBadge).toBeUndefined();
    expect(m.komTime).toBeUndefined();
  });

  test('NO_TRAILS — spot exists but trailCount=0', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ trailCount: 0 }),
      trails: [],
      heroBeat: null,
    });
    expect(m.kind).toBe('NO_TRAILS');
    expect(m.action).toBe('PIONEER_TRAIL');
    expect(m.cta).toBe('NAGRAJ TRASĘ PIONIERA');
    expect(m.tone).toBe('amber');
  });

  test('TRAIL_CALIBRATING — trails exist, none verified', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot(),
      trails: [makeTrail({ calibrationStatus: 'fresh_pending_second_run' })],
      heroBeat: null,
    });
    expect(m.kind).toBe('TRAIL_CALIBRATING');
    expect(m.action).toBe('CALIBRATION_RUN');
    expect(m.cta).toBe('JEDŹ KALIBRACYJNIE');
    expect(m.tone).toBe('amber');
  });

  test('VERIFIED_NO_USER_TIME — verified trail, no user PB', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: null }),
      trails: [makeTrail()],
      heroBeat: null,
    });
    expect(m.kind).toBe('VERIFIED_NO_USER_TIME');
    expect(m.cta).toBe('START Z BRAMKI');
    expect(m.tone).toBe('green');
    expect(m.title).toBe('PREZYDENCKA');
  });

  test('USER_LEADS — heroBeat puts user at #1', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: 81_000 }),
      trails: [makeTrail()],
      heroBeat: makeBeat({ currentPosition: 1, previousPosition: 1 }),
    });
    expect(m.kind).toBe('USER_LEADS');
    expect(m.kicker).toBe('OBROŃ #1');
    expect(m.positionBadge).toBe('#1');
    expect(m.tone).toBe('green');
    expect(m.pressureLine).toBe('Dziś bronisz korony.');
  });

  test('USER_BEATEN — heroBeat with delta + named rival + relative time', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: 90_000 }),
      trails: [makeTrail()],
      heroBeat: makeBeat(),
      beaterRelativeTime: '14 min temu',
    });
    expect(m.kind).toBe('USER_BEATEN');
    expect(m.kicker).toBe('ODBIJ POZYCJĘ');
    expect(m.positionBadge).toBe('#2');
    expect(m.tone).toBe('amber');
    expect(m.body).toContain('Spadłeś na #2');
    expect(m.body).toContain('1.6s');
    expect(m.pressureLine).toBe('Kacper przejął #1 14 min temu.');
  });

  test('USER_BEATEN fallback — no rival name → "Ktoś przejął"', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: 90_000 }),
      trails: [makeTrail()],
      heroBeat: makeBeat({ beaterName: '' }),
    });
    expect(m.kind).toBe('USER_BEATEN');
    expect(m.pressureLine).toBe('Ktoś przejął #1.');
  });

  test('USER_BEATEN fallback — no delta → "lider czeka na kontrę"', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: 90_000 }),
      trails: [makeTrail()],
      heroBeat: makeBeat({ deltaMs: 0 }),
    });
    expect(m.kind).toBe('USER_BEATEN');
    expect(m.body).toBe('Spadłeś na #2 · lider czeka na kontrę');
  });

  test('USER_HAS_TIME — verified trail, PB exists, no recent drama', () => {
    const m = deriveHomeMission({
      primarySpotSummary: makeSpot({ bestDurationMs: 81_000 }),
      trails: [makeTrail()],
      heroBeat: null,
    });
    expect(m.kind).toBe('USER_HAS_TIME');
    expect(m.kicker).toBe('ATAK NA CZAS');
    expect(m.body).toContain('Twój rekord');
    expect(m.pressureLine).toBe('Jedź czysto. Urwij sekundę. Wejdź wyżej.');
    expect(m.tone).toBe('green');
  });
});
