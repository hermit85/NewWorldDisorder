// ─────────────────────────────────────────────────────────────
// Chrome primitives — game-HUD decoration layer per
// design-system/components.md. Pure decorative wrappers; do not
// affect layout.
//
// Use HudFrame for the composed effect; the individual primitives
// are exported for screens that want only one piece (e.g.
// CornerBrackets without scan lines).
// ─────────────────────────────────────────────────────────────

export { CornerBrackets } from './CornerBrackets';
export type { CornerBracketsProps } from './CornerBrackets';

export { ScanLines } from './ScanLines';
export type { ScanLinesProps } from './ScanLines';

export { RaceNumber } from './RaceNumber';
export type { RaceNumberProps } from './RaceNumber';

export { SystemText } from './SystemText';
export type { SystemTextProps, SystemTextSlot } from './SystemText';

export { HudFrame } from './HudFrame';
export type { HudFrameProps } from './HudFrame';
