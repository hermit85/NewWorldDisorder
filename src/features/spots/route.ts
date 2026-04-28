// ─────────────────────────────────────────────────────────────
// resolveSpotArenaRoute — pure router-target derivation for SPOTY.
//
// The pre-fix Spoty screen sometimes pushed users with a verified
// Prezydencka PB into /trail/new (pioneer flow). Tests against
// this function pin the routing rules so the regression cannot
// silently come back.
// ─────────────────────────────────────────────────────────────

import type { SpotArenaState } from '@/features/spots/arenaState';
import type { RouteTarget } from '@/features/home/route';

export function resolveSpotArenaRoute(
  arena: SpotArenaState,
  spotId: string,
): RouteTarget {
  switch (arena.ctaAction) {
    case 'PIONEER_TRAIL':
      return { pathname: '/trail/new', params: { spotId } };
    case 'OPEN_TRAIL':
      // Bike-park cards must open the bike park hub, even when the
      // card meta promotes one trail/PB. The rider picks the exact
      // trail and ranked/training intent one level deeper.
      return { pathname: '/spot/[id]', params: { id: spotId } };
    case 'CALIBRATION_RUN':
    case 'OPEN_SPOT':
    default:
      return { pathname: '/spot/[id]', params: { id: spotId } };
  }
}
