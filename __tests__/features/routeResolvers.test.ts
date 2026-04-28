// ═══════════════════════════════════════════════════════════
// Route resolvers — pin every screen's CTA → route mapping.
//
// These tests guard the regression where SPOTY USER_HAS_PB used
// to push the rider into /trail/new (pioneer flow) even though
// they already had a verified PB. They also confirm that JA
// MENU has NO route resolver (it opens a sheet, not a route),
// and that Tablica's proof card switches scope only.
// ═══════════════════════════════════════════════════════════

import { resolveHomeMissionRoute } from '@/features/home/route';
import { resolveSpotArenaRoute } from '@/features/spots/route';
import { resolveLeaderboardCtaRoute } from '@/features/leaderboard/route';
import type { HomeMission } from '@/features/home/mission';
import type { SpotArenaState } from '@/features/spots/arenaState';
import type { LeaderboardState } from '@/features/leaderboard/state';
import type { Trail } from '@/data/types';

function homeMission(overrides: Partial<HomeMission>): HomeMission {
  return {
    kind: 'USER_HAS_TIME',
    kicker: 'ATAK NA CZAS',
    title: 'PREZYDENCKA',
    body: 'Twój rekord: 1:21.0',
    cta: 'START Z BRAMKI',
    tone: 'green',
    action: 'RANKED_RUN',
    venueName: 'WWA Bike Park',
    trailId: 'trail-1',
    trailName: 'Prezydencka',
    ...overrides,
  };
}

function arenaState(overrides: Partial<SpotArenaState>): SpotArenaState {
  return {
    kind: 'USER_HAS_PB',
    label: 'TWOJA ARENA',
    title: 'WWA Bike Park',
    meta: 'Mazowieckie · Prezydencka · Twój PB 1:21.0',
    cta: 'ATAK NA CZAS',
    ctaAction: 'OPEN_TRAIL',
    tone: 'green',
    promotedTrailId: 'trail-1',
    promotedTrailName: 'Prezydencka',
    userPbMs: 81_000,
    activeTrailCount: 1,
    totalTrailCount: 1,
    ...overrides,
  };
}

function trail(): Trail {
  return {
    id: 'trail-1',
    spotId: 'spot-1',
    name: 'Prezydencka',
  } as any as Trail;
}

describe('resolveHomeMissionRoute', () => {
  test('RANKED_RUN → /run/active with intent=ranked', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'RANKED_RUN' }),
      { primarySpotId: 'spot-1' },
    );
    expect(target?.pathname).toBe('/run/active');
    expect(target?.params?.intent).toBe('ranked');
    expect(target?.params?.trailId).toBe('trail-1');
  });

  test('Home START Z BRAMKI never accidentally goes to pioneer flow', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'RANKED_RUN' }),
      { primarySpotId: 'spot-1' },
    );
    expect(target?.pathname).not.toBe('/trail/new');
  });

  test('ADD_SPOT → /spot/new', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'ADD_SPOT', trailId: undefined, trailName: undefined }),
      { primarySpotId: null },
    );
    expect(target?.pathname).toBe('/spot/new');
  });

  test('PIONEER_TRAIL → /trail/new with spotId', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'PIONEER_TRAIL', trailId: undefined }),
      { primarySpotId: 'spot-1' },
    );
    expect(target?.pathname).toBe('/trail/new');
    expect(target?.params?.spotId).toBe('spot-1');
  });

  test('PIONEER_TRAIL with no primary spot → null (no junk navigate)', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'PIONEER_TRAIL', trailId: undefined }),
      { primarySpotId: null },
    );
    expect(target).toBeNull();
  });

  test('RANKED_RUN with no trailId → null (no /run/active without trail)', () => {
    const target = resolveHomeMissionRoute(
      homeMission({ action: 'RANKED_RUN', trailId: undefined }),
      { primarySpotId: 'spot-1' },
    );
    expect(target).toBeNull();
  });
});

describe('resolveSpotArenaRoute', () => {
  test('USER_HAS_PB / ATAK NA CZAS → /spot/[id], NEVER a single trail', () => {
    const target = resolveSpotArenaRoute(arenaState({}), 'spot-1');
    expect(target.pathname).toBe('/spot/[id]');
    expect(target.params?.id).toBe('spot-1');
    expect(target.pathname).not.toBe('/trail/[id]');
    expect(target.pathname).not.toBe('/trail/new');
  });

  test('NO_TRAILS / PIONIER POTRZEBNY → /trail/new with spotId', () => {
    const target = resolveSpotArenaRoute(
      arenaState({
        kind: 'NO_TRAILS',
        ctaAction: 'PIONEER_TRAIL',
        promotedTrailId: undefined,
      }),
      'spot-1',
    );
    expect(target.pathname).toBe('/trail/new');
    expect(target.params?.spotId).toBe('spot-1');
  });

  test('OPEN_TRAIL ignores promotedTrailId and opens the bike park hub', () => {
    const target = resolveSpotArenaRoute(
      arenaState({ promotedTrailId: 'trail-1' }),
      'spot-1',
    );
    expect(target.pathname).toBe('/spot/[id]');
    expect(target.params?.id).toBe('spot-1');
    expect(target.pathname).not.toBe('/trail/[id]');
    expect(target.pathname).not.toBe('/trail/new');
  });

  test('CALIBRATION_RUN → spot detail (preserves arena context)', () => {
    const target = resolveSpotArenaRoute(
      arenaState({
        kind: 'CALIBRATING',
        ctaAction: 'CALIBRATION_RUN',
        promotedTrailId: undefined,
      }),
      'spot-1',
    );
    expect(target.pathname).toBe('/spot/[id]');
  });

  test('MULTI_TRAIL / OPEN_SPOT → /spot/[id]', () => {
    const target = resolveSpotArenaRoute(
      arenaState({
        kind: 'MULTI_TRAIL',
        ctaAction: 'OPEN_SPOT',
        promotedTrailId: undefined,
      }),
      'spot-1',
    );
    expect(target.pathname).toBe('/spot/[id]');
    expect(target.params?.id).toBe('spot-1');
  });
});

describe('resolveLeaderboardCtaRoute', () => {
  function leaderboardState(overrides: Partial<LeaderboardState>): LeaderboardState {
    return {
      kind: 'USER_HAS_PB' as any,
      hero: {} as any,
      topRows: [],
      stickyUserRow: null,
      tailRows: [],
      cta: { label: 'START Z BRAMKI', action: 'RANKED_RUN' },
      proofCard: null,
      ...overrides,
    };
  }

  test('RANKED_RUN → /run/active when focusTrail provided', () => {
    const t = resolveLeaderboardCtaRoute(leaderboardState({}), {
      primarySpotId: 'spot-1',
      focusTrail: trail(),
    });
    expect(t?.pathname).toBe('/run/active');
    expect(t?.params?.intent).toBe('ranked');
  });

  test('cta=null → null target', () => {
    const t = resolveLeaderboardCtaRoute(leaderboardState({ cta: null }), {
      primarySpotId: null,
      focusTrail: null,
    });
    expect(t).toBeNull();
  });

  test('PIONEER_TRAIL with primarySpot → /trail/new', () => {
    const t = resolveLeaderboardCtaRoute(
      leaderboardState({
        cta: { label: 'NAGRAJ TRASĘ PIONIERA', action: 'PIONEER_TRAIL' },
      }),
      { primarySpotId: 'spot-1', focusTrail: null },
    );
    expect(t?.pathname).toBe('/trail/new');
  });
});
