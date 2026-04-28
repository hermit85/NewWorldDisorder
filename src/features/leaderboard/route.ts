// ─────────────────────────────────────────────────────────────
// resolveLeaderboardCtaRoute — Tablica hero CTA → route target.
//
// Same shape as the Home/Spots resolvers so the screen wraps it
// with router.push(...) and tests can pin exact targets.
// Returns null when the state's CTA needs context the caller
// cannot supply (e.g. focusTrail missing for a RANKED_RUN).
// ─────────────────────────────────────────────────────────────

import type { LeaderboardState } from '@/features/leaderboard/state';
import type { Trail } from '@/data/types';
import type { RouteTarget } from '@/features/home/route';

export interface LeaderboardRouteContext {
  primarySpotId: string | null;
  focusTrail: Trail | null;
}

export function resolveLeaderboardCtaRoute(
  state: LeaderboardState,
  ctx: LeaderboardRouteContext,
): RouteTarget | null {
  if (!state.cta) return null;
  switch (state.cta.action) {
    case 'ADD_SPOT':
      return { pathname: '/spot/new' };
    case 'PIONEER_TRAIL':
      if (!ctx.primarySpotId) return null;
      return { pathname: '/trail/new', params: { spotId: ctx.primarySpotId } };
    case 'CALIBRATION_RUN':
    case 'RANKED_RUN': {
      // Prefer the trail handle baked into the CTA (states like
      // NO_VERIFIED_TRAILS know which calibrating trail to route to
      // even when the focusTrail prop is null — focusTrail filters to
      // verified-only). Fall back to ctx.focusTrail for RANKED_RUN
      // states that haven't yet been migrated to carry the handle in
      // state.cta itself.
      const trailId = state.cta.trailId ?? ctx.focusTrail?.id;
      const trailName = state.cta.trailName ?? ctx.focusTrail?.name;
      if (!trailId) return null;
      return {
        pathname: '/run/active',
        params: {
          trailId,
          trailName: trailName ?? '',
          intent: 'ranked',
        },
      };
    }
  }
}
