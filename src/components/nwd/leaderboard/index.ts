// ─────────────────────────────────────────────────────────────
// Leaderboard primitives — arena surfaces.
//
// @deprecated · Phase 2
// These primitives (PodiumPortraits 3-card swap layout +
// TrailThumbnailRow with elevation silhouettes) were shipped in
// the earlier "TRUE Ranking redesign" pass and are explicitly
// dropped from Tablica Phase 1 per cc_prompt_tablica_phase1_final
// anti-drift list. Components stay in the tree as dead code; if
// Phase 2 reintroduces drama-feed / podium-swap UX, they're ready
// to wire back. New screens MUST NOT import from here.
// ─────────────────────────────────────────────────────────────

export { PodiumPortraits } from './PodiumPortraits';
export type { PodiumPortraitsProps, PodiumEntry } from './PodiumPortraits';

export { TrailThumbnailRow } from './TrailThumbnailRow';
export type { TrailThumbnailRowProps, TrailThumbnail } from './TrailThumbnailRow';
