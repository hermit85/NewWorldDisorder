// ═══════════════════════════════════════════════════════════
// League Movement — re-engagement signals from real board data
// Small, truthful event model. Not a feed. Not spam.
// Notification-ready: each signal has enough metadata for push.
// ═══════════════════════════════════════════════════════════

export type SignalType =
  | 'holding_strong'      // rider holds a strong position (top 3/10)
  | 'close_to_threshold'  // 1-3 places from podium/top 10
  | 'has_today_result'    // rider is on today's board
  | 'venue_active_today'  // venue has runs today
  | 'trail_hot_today'     // specific trail is hot today
  | 'weekend_board_alive' // weekend board has entries
  | 'no_result_today';    // rider has board position but no run today

export type SignalScope = 'today' | 'weekend' | 'all_time' | 'venue';
export type SignalEntity = 'trail' | 'venue' | 'rider';

export interface LeagueSignal {
  type: SignalType;
  scope: SignalScope;
  entity: SignalEntity;
  riderSpecific: boolean;
  // Display
  headline: string;       // short, punchy — e.g. "Nadal TOP 3"
  detail: string | null;  // optional context — e.g. "Dzida Czerwona · wszechczasów"
  // Metadata for notifications
  trailId: string | null;
  venueId: string | null;
  position: number | null;
  // Priority (higher = more important, max 100)
  priority: number;
}

// ═══════════════════════════════════════════════════════════
// SIGNAL DERIVATION — from existing board/activity data
// ═══════════════════════════════════════════════════════════

export interface RiderBoardContext {
  trailId: string;
  trailName: string;
  allTimePosition: number | null;
  todayPosition: number | null;
  weekendPosition: number | null;
  todayBoardSize: number;
  weekendBoardSize: number;
  allTimeBoardSize: number;
}

export interface VenueActivityContext {
  venueId: string;
  venueName: string;
  verifiedRunsToday: number;
  activeRidersToday: number;
  hotTrailId: string | null;
  hotTrailName: string | null;
  hotTrailRuns: number;
}

export function deriveSignals(
  riderBoards: RiderBoardContext[],
  venueActivity: VenueActivityContext | null,
): LeagueSignal[] {
  const signals: LeagueSignal[] = [];

  // ── Rider-specific signals ──
  for (const board of riderBoards) {
    const pos = board.allTimePosition;

    // Holding strong position (top 3)
    if (pos !== null && pos <= 3) {
      signals.push({
        type: 'holding_strong',
        scope: 'all_time',
        entity: 'trail',
        riderSpecific: true,
        headline: `Nadal TOP 3 na ${board.trailName}`,
        detail: `#${pos} · wszechczasów`,
        trailId: board.trailId,
        venueId: null,
        position: pos,
        priority: 85,
      });
    }
    // Holding top 10 (but not top 3)
    else if (pos !== null && pos <= 10) {
      signals.push({
        type: 'holding_strong',
        scope: 'all_time',
        entity: 'trail',
        riderSpecific: true,
        headline: `TOP 10 na ${board.trailName}`,
        detail: `#${pos} · wszechczasów`,
        trailId: board.trailId,
        venueId: null,
        position: pos,
        priority: 70,
      });
    }

    // Close to threshold (all-time)
    if (pos !== null && pos > 3 && pos <= 6) {
      signals.push({
        type: 'close_to_threshold',
        scope: 'all_time',
        entity: 'trail',
        riderSpecific: true,
        headline: `${pos - 3} ${pos - 3 === 1 ? 'pozycja' : 'pozycje'} do podium`,
        detail: board.trailName,
        trailId: board.trailId,
        venueId: null,
        position: pos,
        priority: 75,
      });
    } else if (pos !== null && pos > 10 && pos <= 13) {
      signals.push({
        type: 'close_to_threshold',
        scope: 'all_time',
        entity: 'trail',
        riderSpecific: true,
        headline: `${pos - 10} ${pos - 10 === 1 ? 'pozycja' : 'pozycje'} do TOP 10`,
        detail: board.trailName,
        trailId: board.trailId,
        venueId: null,
        position: pos,
        priority: 65,
      });
    }

    // Has today result
    if (board.todayPosition !== null) {
      signals.push({
        type: 'has_today_result',
        scope: 'today',
        entity: 'trail',
        riderSpecific: true,
        headline: `#${board.todayPosition} dziś na ${board.trailName}`,
        detail: `${board.todayBoardSize} riderów dziś`,
        trailId: board.trailId,
        venueId: null,
        position: board.todayPosition,
        priority: 80,
      });
    }
    // Has all-time position but no today result
    else if (pos !== null && board.todayBoardSize > 0) {
      signals.push({
        type: 'no_result_today',
        scope: 'today',
        entity: 'trail',
        riderSpecific: true,
        headline: `Jeszcze bez wyniku dziś`,
        detail: `${board.trailName} · ${board.todayBoardSize} riderów dziś`,
        trailId: board.trailId,
        venueId: null,
        position: null,
        priority: 55,
      });
    }

    // Weekend board alive with rider
    if (board.weekendPosition !== null) {
      signals.push({
        type: 'weekend_board_alive',
        scope: 'weekend',
        entity: 'trail',
        riderSpecific: true,
        headline: `#${board.weekendPosition} w weekend na ${board.trailName}`,
        detail: `${board.weekendBoardSize} riderów`,
        trailId: board.trailId,
        venueId: null,
        position: board.weekendPosition,
        priority: 60,
      });
    }
  }

  // ── Venue/world signals ──
  if (venueActivity && venueActivity.verifiedRunsToday > 0) {
    signals.push({
      type: 'venue_active_today',
      scope: 'venue',
      entity: 'venue',
      riderSpecific: false,
      headline: `${venueActivity.venueName} żyje dziś`,
      detail: `${venueActivity.verifiedRunsToday} zjazdów · ${venueActivity.activeRidersToday} riderów`,
      trailId: null,
      venueId: venueActivity.venueId,
      position: null,
      priority: 50,
    });

    if (venueActivity.hotTrailId && venueActivity.hotTrailRuns >= 3) {
      signals.push({
        type: 'trail_hot_today',
        scope: 'today',
        entity: 'trail',
        riderSpecific: false,
        headline: `${venueActivity.hotTrailName ?? 'Trasa'} rozgrzana dziś`,
        detail: `${venueActivity.hotTrailRuns} zjazdów`,
        trailId: venueActivity.hotTrailId,
        venueId: venueActivity.venueId,
        position: null,
        priority: 45,
      });
    }
  }

  // Sort by priority descending
  signals.sort((a, b) => b.priority - a.priority);

  return signals;
}

// Get top N signals, preferring rider-specific first
export function getTopSignals(signals: LeagueSignal[], max: number = 3): LeagueSignal[] {
  // Already sorted by priority from deriveSignals
  return signals.slice(0, max);
}
