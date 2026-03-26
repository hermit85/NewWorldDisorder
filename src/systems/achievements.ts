// Achievement system — only unlocks for real, verifiable reasons.
// Achievements that require aggregated state not yet available
// from the backend are not checked here. They stay locked.
//
// Currently verifiable on a per-run basis:
// - first-blood: first valid run (handled via backend upsert)
//
// NOT verifiable per-run (require aggregated queries):
// - top-10-entry: needs leaderboard context post-save
// - weekend-warrior: needs session tracking across runs
// - double-pb: needs day-scoped PB tracking
// - trail-hunter: needs per-trail completion aggregation
// - slotwiny-local: needs total runs count
// - gravity-addict: needs total runs count
//
// These will be implemented when the backend supports
// aggregated achievement evaluation. Until then, they stay
// locked rather than faking unlock.
