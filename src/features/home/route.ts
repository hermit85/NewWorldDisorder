// ─────────────────────────────────────────────────────────────
// resolveHomeMissionRoute — pure router-target derivation.
//
// Pulled out of the screen so tests can pin exact pathnames and
// params for each MissionAction. The screen wraps this with
// router.push(...). When promotedTrailId/spotId is missing we
// return null so the caller can no-op rather than navigate to
// a junk route.
// ─────────────────────────────────────────────────────────────

import type { HomeMission } from '@/features/home/mission';

export interface RouteTarget {
  pathname: string;
  params?: Record<string, string>;
}

export function resolveHomeMissionRoute(
  mission: HomeMission,
  context: { primarySpotId: string | null },
): RouteTarget | null {
  switch (mission.action) {
    case 'ADD_SPOT':
      return { pathname: '/spot/new' };
    case 'PIONEER_TRAIL':
      if (!context.primarySpotId) return null;
      return { pathname: '/trail/new', params: { spotId: context.primarySpotId } };
    case 'CALIBRATION_RUN':
    case 'RANKED_RUN':
      if (!mission.trailId) return null;
      return {
        pathname: '/run/active',
        params: {
          trailId: mission.trailId,
          trailName: mission.trailName ?? '',
          intent: 'ranked',
        },
      };
  }
}
