// ─────────────────────────────────────────────────────────────
// Brand primitives — chrome for every non-tab screen (Auth,
// Help, Settings, Run flow, Empty states). Three signature
// elements + one shared atom; screens compose them with their
// own content. See design-system/brand-primitives.md.
// ─────────────────────────────────────────────────────────────

export { LiveDot } from './LiveDot';
export type { LiveDotProps, LiveDotMode } from './LiveDot';

export { NWDHeader } from './NWDHeader';
export type { NWDHeaderProps, NWDHeaderRightContext } from './NWDHeader';

export { PageLabel } from './PageLabel';
export type { PageLabelProps, PageLabelVariant } from './PageLabel';

export { BottomBand } from './BottomBand';
export type { BottomBandProps, BottomBandVariant } from './BottomBand';
