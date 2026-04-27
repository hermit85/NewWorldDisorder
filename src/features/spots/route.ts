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
      if (arena.promotedTrailId) {
        return {
          pathname: '/trail/[id]',
          params: { id: arena.promotedTrailId },
        };
      }
      // Fallback to spot detail when promoted id is missing — we
      // never silently fall through to /trail/new from here.
      return { pathname: '/spot/[id]', params: { id: spotId } };
    case 'CALIBRATION_RUN':
    case 'OPEN_SPOT':
    default:
      return { pathname: '/spot/[id]', params: { id: spotId } };
  }
}
