// ─────────────────────────────────────────────────────────────
// NWD canonical components — one source of truth.
//
// All atoms here derive from design-system/components.md and
// consume tokens via @/theme. Screens import from here, never
// hand-roll Btn/Pill/Row equivalents.
//
// Lock-in (per user directive 2026-04-25):
//   palette = Acid (canonical, dark-only)
//   type    = Rajdhani (display) × Inter (body) × JetBrains Mono
//   density = Compact (pad 16, gap 10, cardRadius 18)
// ─────────────────────────────────────────────────────────────

// Atoms
export { Btn } from './Btn';
export type { BtnProps, BtnVariant, BtnSize } from './Btn';

export { Pill } from './Pill';
export type { PillProps, PillState } from './Pill';

export { IconGlyph } from './IconGlyph';
export type { IconName, IconGlyphProps } from './IconGlyph';

// Telemetry
export { RaceTime } from './RaceTime';
export type { RaceTimeProps, RaceTimeSize } from './RaceTime';

// Surfaces
export { Card } from './Card';
export type { CardProps } from './Card';

export { HudPanel } from './HudPanel';
export type { HudPanelProps } from './HudPanel';

// Composition
export { StatBox } from './StatBox';
export type { StatBoxProps } from './StatBox';

export { SectionHead } from './SectionHead';
export type { SectionHeadProps } from './SectionHead';

export { PageTitle } from './PageTitle';
export type { PageTitleProps } from './PageTitle';

export { TopBar } from './TopBar';
export type { TopBarProps } from './TopBar';

export { LeaderboardRow } from './LeaderboardRow';
export type { LeaderboardRowProps } from './LeaderboardRow';

export { SpotRow } from './SpotRow';
export type { SpotRowProps } from './SpotRow';

export { TrailCard } from './TrailCard';
export type { TrailCardProps, TrailStatus } from './TrailCard';

// Chrome primitives — game-HUD decoration (HudFrame composes the rest).
export { CornerBrackets, ScanLines, RaceNumber, SystemText, HudFrame } from './chrome';
export type {
  CornerBracketsProps,
  ScanLinesProps,
  RaceNumberProps,
  SystemTextProps,
  SystemTextSlot,
  HudFrameProps,
} from './chrome';

// Atmosphere primitives — alive HUD layer (Sprint 1).
export { AmbientScan } from './atmosphere';
export type { AmbientScanProps } from './atmosphere';

// Profile primitives — rider identity surfaces.
export { RiderIdCard } from './profile';
export type { RiderIdCardProps } from './profile';

// Feed primitives — drama / event surfaces.
export { LiveTicker, MOCK_TICKER_EVENTS, HeadToHeadCard } from './feed';
export type {
  LiveTickerProps,
  LiveTickerEvent,
  LiveTickerEventKind,
  HeadToHeadCardProps,
} from './feed';

// Brand primitives — chrome for non-tab screens (Auth, Help, Settings).
export { LiveDot } from './brand';
export type { LiveDotProps, LiveDotMode } from './brand';

export { NWDHeader } from './brand';
export type { NWDHeaderProps, NWDHeaderRightContext } from './brand';

export { PageLabel } from './brand';
export type { PageLabelProps, PageLabelVariant } from './brand';

export { BottomBand } from './brand';
export type { BottomBandProps, BottomBandVariant } from './brand';
