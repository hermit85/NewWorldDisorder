// ═══════════════════════════════════════════════════════════
// derivePassport — pins JA's permanent-record math.
//
// Tests cover the four DOROBEK metrics and the REKORDY OSOBISTE
// list ordering. Same discipline as the Home and Tablica derive
// helpers: only the math is tested; the UI is dumb.
// ═══════════════════════════════════════════════════════════

import { derivePassport } from '@/features/profile/passport';
import type { TablicaSection, TablicaTrailRow } from '@/hooks/useTablicaSections';
import type { Spot, Trail } from '@/data/types';

function makeSpot(id: string, name: string): Spot {
  return {
    id,
    name,
    slug: id,
    description: '',
    region: 'Mazowieckie',
    isOfficial: false,
    coverImage: '',
    status: 'active',
    submissionStatus: 'active',
    activeRidersToday: 0,
    trailCount: 0,
  } as any as Spot;
}

function makeTrail(id: string, name: string, spotId: string): Trail {
  return {
    id,
    spotId,
    name,
    slug: id,
    description: '',
    difficulty: 'S2' as any,
    trailType: 'enduro' as any,
    distanceM: 0,
    elevationDropM: 0,
    isOfficial: false,
    isActive: true,
    sortOrder: 0,
    calibrationStatus: 'verified' as any,
    geometryMissing: false,
    seedSource: null,
    pioneerUserId: null,
    geometryVersion: 0,
    trustTier: 'verified',
  } as any as Trail;
}

function row(
  trailId: string,
  spotId: string,
  pbMs: number | null,
  position: number | null,
): TablicaTrailRow {
  return {
    trail: makeTrail(trailId, trailId.toUpperCase(), spotId),
    userPbMs: pbMs,
    userPosition: position,
    userRunCount: 0,
  };
}

describe('derivePassport', () => {
  test('counts pioneer + passa straight off the inputs', () => {
    const p = derivePassport({
      sections: [],
      pioneerCount: 3,
      passaDays: 5,
    });
    expect(p.pioneerCount).toBe(3);
    expect(p.passaDays).toBe(5);
    expect(p.bikeParksCount).toBe(0);
    expect(p.pbCount).toBe(0);
    expect(p.records).toEqual([]);
  });

  test('bikeParksCount counts only sections with at least one trail', () => {
    const sections: TablicaSection[] = [
      { spot: makeSpot('s1', 'WWA'), trails: [row('t1', 's1', 81_000, 1)], lastRunAt: '' },
      { spot: makeSpot('s2', 'KOPA'), trails: [], lastRunAt: '' },
      { spot: makeSpot('s3', 'GLINIANKI'), trails: [row('t3', 's3', 90_000, null)], lastRunAt: '' },
    ];
    const p = derivePassport({ sections, pioneerCount: 0, passaDays: 0 });
    expect(p.bikeParksCount).toBe(2);
  });

  test('pbCount counts only trails where the user actually has a PB', () => {
    const sections: TablicaSection[] = [
      {
        spot: makeSpot('s1', 'WWA'),
        trails: [
          row('t1', 's1', 81_000, 1),
          row('t2', 's1', null, null), // no PB
          row('t3', 's1', 95_000, 4),
        ],
        lastRunAt: '',
      },
    ];
    const p = derivePassport({ sections, pioneerCount: 0, passaDays: 0 });
    expect(p.pbCount).toBe(2);
    expect(p.records).toHaveLength(2);
  });

  test('records sort: ranked positions ascending first, unranked tail by PB time', () => {
    const sections: TablicaSection[] = [
      {
        spot: makeSpot('s1', 'WWA'),
        trails: [
          row('t-unranked-fast', 's1', 75_000, null),
          row('t-rank-2', 's1', 81_000, 2),
          row('t-rank-1', 's1', 79_000, 1),
          row('t-unranked-slow', 's1', 100_000, null),
        ],
        lastRunAt: '',
      },
    ];
    const p = derivePassport({ sections, pioneerCount: 0, passaDays: 0 });
    expect(p.records.map((r) => r.trailId)).toEqual([
      't-rank-1',
      't-rank-2',
      't-unranked-fast',
      't-unranked-slow',
    ]);
  });

  test('records carry the spot name from their parent section', () => {
    const sections: TablicaSection[] = [
      { spot: makeSpot('s1', 'WWA'), trails: [row('t1', 's1', 81_000, 1)], lastRunAt: '' },
      { spot: makeSpot('s2', 'KOPA'), trails: [row('t2', 's2', 90_000, 3)], lastRunAt: '' },
    ];
    const p = derivePassport({ sections, pioneerCount: 0, passaDays: 0 });
    const wwa = p.records.find((r) => r.trailId === 't1');
    const kopa = p.records.find((r) => r.trailId === 't2');
    expect(wwa?.spotName).toBe('WWA');
    expect(kopa?.spotName).toBe('KOPA');
  });
});
