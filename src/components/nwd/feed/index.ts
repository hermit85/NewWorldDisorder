// ─────────────────────────────────────────────────────────────
// Feed primitives — drama / live event surfaces.
//
// @deprecated · Phase 2
// LiveTicker ("TODAY'S DRAMA") and HeadToHeadCard were shipped in
// the earlier ranking polish pass and are explicitly dropped from
// Tablica Phase 1 per cc_prompt_tablica_phase1_final anti-drift
// list ("activity ticker = Phase 2", "trail label klikalny = Phase
// 2"). Components stay as dead code; new screens MUST NOT import
// from here until Phase 2 spec lands.
// ─────────────────────────────────────────────────────────────

export { LiveTicker, MOCK_TICKER_EVENTS } from './LiveTicker';
export type { LiveTickerProps, LiveTickerEvent, LiveTickerEventKind } from './LiveTicker';

export { HeadToHeadCard } from './HeadToHeadCard';
export type { HeadToHeadCardProps } from './HeadToHeadCard';
