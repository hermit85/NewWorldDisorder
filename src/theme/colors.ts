// ─────────────────────────────────────────────────────────────
// NWD Design System v1.0 — Acid palette (canonical)
//
// Color tokens come from the design handoff at design-system/
// (`NWD Design System.html` § 02 Color, § 04 Elevation, § 12 Tokens).
// Three palettes exist (Acid / Forge / Arctic) — Acid is the
// canonical brand and the only one currently shipped. Forge and
// Arctic stay in the design source for future seasonal swaps.
//
// Race state owns color: training (muted), armed/verified (accent),
// pending (warn), invalid (danger). Accent is NEVER used for
// decoration outside a race-state context — see § 13 Handoff
// "Race state owns color".
//
// Layer model (§ 04 Elevation):
//   e0 bg      — screen background
//   e1 chrome  — navbar, status, frame
//   e2 panel   — cards, modals
//   e3 row     — list rows
//   e4 row-hot — armed / active row (panel + borderHot + glowSoft)
//
// Backward-compat aliases retained so legacy imports
// (bgCard, bgElevated, mutedSurface, …) keep compiling.
// ─────────────────────────────────────────────────────────────
export const colors = {
  // ── Layered surfaces (e0 → e4) ────────────────────────────
  bg: '#07090A',           // e0 — screen background
  chrome: '#0E1112',       // e1 — navbar / status / frame
  panel: '#13181A',        // e2 — cards, modals (= bgCard alias)
  row: '#1A2124',          // e3/e4 — list rows
  bgOverlay: 'rgba(7, 9, 10, 0.85)',

  // Backward-compat aliases — older code imports these.
  // bgCard maps to panel (e2), bgElevated maps to row (e3).
  bgCard: '#13181A',
  bgElevated: '#1A2124',

  // Locked / disabled surfaces
  mutedSurface: 'rgba(255, 255, 255, 0.05)',
  mutedBorder: 'rgba(255, 255, 255, 0.14)',

  // ── Accent (canonical brand — race-state only) ────────────
  accent: '#00FF87',
  accentDeep: '#00CC6A',          // gradient end-stop for accent (v8 onboarding)
  accentDim: 'rgba(0, 255, 135, 0.14)',
  accentGlow: 'rgba(0, 255, 135, 0.40)',
  accentInk: '#04150B',           // text color sitting ON accent

  // ── Podium & signals (§ 02 Color) ─────────────────────────
  gold: '#FFD23F',
  goldDim: 'rgba(255, 210, 63, 0.14)',
  goldGlow: 'rgba(255, 210, 63, 0.40)',
  silver: '#C9D1D6',
  bronze: '#E08A5C',

  // ── Race-state colors ─────────────────────────────────────
  warn: '#FFB020',                // pending — validating
  warnDim: 'rgba(255, 176, 32, 0.12)',
  danger: '#FF4757',              // invalid — DNF / DSQ
  dangerDim: 'rgba(255, 71, 87, 0.12)',

  // Legacy aliases — many call sites use red/orange/blue.
  red: '#FF4757',
  redDim: 'rgba(255, 71, 87, 0.15)',
  orange: '#FFB020',
  blue: '#50B4FF',                // matches Arctic accent + diff Blue

  // ── Text (§ 12 Tokens) ────────────────────────────────────
  // Off-white reduces OLED glare vs pure white. Muted/dim use
  // alpha-on-text so they automatically adapt to the surface.
  textPrimary: '#F2F4F3',
  textSecondary: 'rgba(242, 244, 243, 0.55)',  // = textMuted
  textTertiary: 'rgba(242, 244, 243, 0.32)',   // = textDim
  textDisabled: 'rgba(242, 244, 243, 0.20)',
  textAccent: '#00FF87',

  // Design-system canonical names (matches HTML CSS vars).
  textMuted: 'rgba(242, 244, 243, 0.55)',
  textDim: 'rgba(242, 244, 243, 0.32)',

  // ── Borders (§ 04 Elevation) ──────────────────────────────
  border: 'rgba(255, 255, 255, 0.06)',     // hairline (e2 cards)
  borderMid: 'rgba(255, 255, 255, 0.10)',  // visible (e3 rows)
  borderHot: 'rgba(0, 255, 135, 0.35)',    // accent ring (e4 hot)
  borderLight: 'rgba(255, 255, 255, 0.10)', // back-compat alias

  // ── Rank colors (kept stable for existing rank UI) ────────
  rankRookie: 'rgba(242, 244, 243, 0.55)',
  rankRider: '#50B4FF',
  rankSender: '#FFB020',
  rankRipper: '#FF4757',
  rankCharger: '#FFD23F',
  rankLegend: '#00FF87',

  // ── Difficulty (§ 09 Track lines · MTB / FIS standard) ────
  // Stroke = trudność, never armed-green. See § 09 ZASADA #2.
  diffGreen: '#2ECC71',           // S0 / S1 — beginner
  diffBlue: '#50B4FF',            // S2 — intermediate
  diffRed: '#FF4757',             // S3 — advanced
  diffBlack: '#F2F4F3',           // S4 / S5 — expert / pro

  // Legacy diff aliases — call sites use these.
  diffEasy: '#2ECC71',
  diffMedium: '#50B4FF',
  diffHard: '#FF4757',
  diffExpert: '#F2F4F3',
  diffPro: '#FFD23F',

  // ── Race state semantic tokens (canonical tokens.ts) ──────
  // These are the SOURCE OF TRUTH for any state UI per
  // design-system/tokens.ts § palette.acid.state*. Components
  // should consume `colors.stateArmed` etc., not raw `colors.accent`,
  // when expressing race state. Pioneer screens still read accent
  // for decoration of fresh-trail celebration — that's allowed.
  stateTraining: 'rgba(242, 244, 243, 0.45)',
  stateArmed:    '#00FF87',
  stateVerified: '#00FF87',
  statePending:  '#FFB020',
  stateInvalid:  '#FF4757',

  // ── Chunk 9 redesign aliases (gradually deprecating) ──────
  chunk9BgBase: '#000000',
  chunk9BgSurface: '#0B0B0C',
  chunk9BgHairline: '#1F1F22',
  chunk9TextPrimary: '#F2F4F3',
  chunk9TextSecondary: 'rgba(242, 244, 243, 0.55)',
  chunk9TextTertiary: 'rgba(242, 244, 243, 0.32)',
  chunk9AccentEmerald: '#00FF87',
} as const;

export type ColorKey = keyof typeof colors;

// ─────────────────────────────────────────────────────────────
// Race state — color × label × animation triplet.
// The design system § 01 ZASADA #1 mandates these three together,
// never one without the others. Components that show race state
// must read from this map, not hardcode colors.
// ─────────────────────────────────────────────────────────────
export const raceState = {
  training: {
    color: colors.textSecondary,
    bg: colors.mutedSurface,
    border: colors.border,
    label: 'TRENING',
    // No animation — training is "I'm riding for myself, doesn't count"
    pulseMs: null,
  },
  armed: {
    color: colors.accent,
    bg: colors.accentDim,
    border: colors.borderHot,
    label: 'ARMED',
    pulseMs: 1200,        // urgent
  },
  verified: {
    color: colors.accent,
    bg: colors.accentDim,
    border: colors.borderHot,
    label: 'VERIFIED',
    pulseMs: 2400,        // calm breathe
  },
  pending: {
    color: colors.warn,
    bg: colors.warnDim,
    border: 'rgba(255, 176, 32, 0.30)',
    label: 'PENDING',
    pulseMs: 600,         // anxious blink
  },
  invalid: {
    color: colors.danger,
    bg: colors.dangerDim,
    border: 'rgba(255, 71, 87, 0.30)',
    label: 'INVALID',
    pulseMs: null,        // solid — finality
  },
} as const;

export type RaceStateKey = keyof typeof raceState;
