// NWD Design System — single source of truth.
// All tokens frozen. Import this; never hardcode.

export const tokens = {
  // ============================================================
  // COLOR — 3 palettes, identical structure. Acid is canonical.
  // ============================================================
  palette: {
    acid: {
      // Surfaces (5-step elevation)
      bg:        '#07090A', // e0 — screen background
      chrome:    '#0E1112', // e1 — navbar, status bar, frame
      panel:     '#13181A', // e2 — cards, sections, modals
      row:       '#1A2124', // e3 — list rows, tiles
      rowHot:    '#1A2124', // e4 — armed/active row (paired with borderHot + glowSoft)

      // Borders
      border:    'rgba(255,255,255,0.06)',
      borderMid: 'rgba(255,255,255,0.10)',
      borderHot: 'rgba(0,255,135,0.35)',

      // Text
      text:      '#F2F4F3',
      textMuted: 'rgba(242,244,243,0.55)',
      textDim:   'rgba(242,244,243,0.32)',

      // Accent + state (state.* is the source of truth — accent is a generic alias for compat)
      accent:    '#00FF87',
      accentDim: 'rgba(0,255,135,0.14)',
      accentInk: '#04150B',  // text on accent fill
      warn:      '#FFB020',
      danger:    '#FF4757',

      // Race state (USE THESE for any state UI)
      stateTraining: 'rgba(242,244,243,0.45)',
      stateArmed:    '#00FF87',
      stateVerified: '#00FF87',
      statePending:  '#FFB020',
      stateInvalid:  '#FF4757',

      // Podium
      gold:   '#FFD23F',
      silver: '#C9D1D6',
      bronze: '#E08A5C',

      // Glows
      glowHot:  '0 0 24px rgba(0,255,135,0.30)',
      glowSoft: '0 0 16px rgba(0,255,135,0.12)',
    },

    forge: {
      bg:        '#0A0807', chrome: '#11100E', panel: '#1A1815', row: '#22201C', rowHot: '#22201C',
      border:    'rgba(255,255,255,0.06)', borderMid: 'rgba(255,255,255,0.10)', borderHot: 'rgba(255,138,46,0.40)',
      text:      '#F4F1EE', textMuted: 'rgba(244,241,238,0.55)', textDim: 'rgba(244,241,238,0.32)',
      accent:    '#FF8A2E', accentDim: 'rgba(255,138,46,0.14)', accentInk: '#1A0B02',
      warn:      '#FFD23F', danger: '#FF4757',
      stateTraining: 'rgba(244,241,238,0.45)', stateArmed: '#FF8A2E', stateVerified: '#FF8A2E',
      statePending: '#FFD23F', stateInvalid: '#FF4757',
      gold: '#FFD23F', silver: '#C9D1D6', bronze: '#E08A5C',
      glowHot:  '0 0 24px rgba(255,138,46,0.30)', glowSoft: '0 0 16px rgba(255,138,46,0.12)',
    },

    arctic: {
      bg:        '#06090C', chrome: '#0D1117', panel: '#131922', row: '#1B2330', rowHot: '#1B2330',
      border:    'rgba(255,255,255,0.06)', borderMid: 'rgba(255,255,255,0.10)', borderHot: 'rgba(80,180,255,0.40)',
      text:      '#EEF3F8', textMuted: 'rgba(238,243,248,0.55)', textDim: 'rgba(238,243,248,0.32)',
      accent:    '#50B4FF', accentDim: 'rgba(80,180,255,0.14)', accentInk: '#021018',
      warn:      '#FFB020', danger: '#FF4757',
      stateTraining: 'rgba(238,243,248,0.45)', stateArmed: '#50B4FF', stateVerified: '#50B4FF',
      statePending: '#FFB020', stateInvalid: '#FF4757',
      gold: '#FFD23F', silver: '#C9D1D6', bronze: '#E08A5C',
      glowHot:  '0 0 24px rgba(80,180,255,0.30)', glowSoft: '0 0 16px rgba(80,180,255,0.12)',
    },
  },

  // ============================================================
  // TYPOGRAPHY — 7-step scale + telemetry specials
  // ============================================================
  font: {
    display: '"Rajdhani", "Inter", system-ui, sans-serif',  // condensed sport
    body:    '"Inter", system-ui, sans-serif',
    mono:    '"JetBrains Mono", ui-monospace, Menlo, monospace',
  },

  // 7-step scale (use these for ALL non-telemetry text)
  size: {
    hero:    { px: 56, weight: 800, lh: 0.95, track: '-0.02em',  family: 'display', case: 'none'  },
    title:   { px: 32, weight: 700, lh: 1.05, track: '-0.01em',  family: 'display', case: 'none'  },
    lead:    { px: 22, weight: 600, lh: 1.20, track: '-0.005em', family: 'display', case: 'none'  },
    body:    { px: 15, weight: 400, lh: 1.50, track: '0',        family: 'body',    case: 'none'  },
    caption: { px: 13, weight: 500, lh: 1.40, track: '0',        family: 'body',    case: 'none'  },
    label:   { px: 11, weight: 800, lh: 1.00, track: '0.24em',   family: 'mono',    case: 'upper' },
    micro:   { px: 9,  weight: 700, lh: 1.00, track: '0.32em',   family: 'mono',    case: 'upper' },
  },

  // Telemetry-specific (always tabular-nums — no exceptions)
  telemetry: {
    timerHero:    { px: 56, weight: 800, lh: 1.0,  track: '-0.01em',  family: 'display' },
    timerSplit:   { px: 26, weight: 700, lh: 1.0,  track: '-0.005em', family: 'display' },
    timerWidget:  { px: 28, weight: 700, lh: 1.0,  track: '-0.005em', family: 'display' },
    delta:        { px: 18, weight: 800, lh: 1.0,  track: '0',        family: 'mono'    },
    deltaSmall:   { px: 13, weight: 800, lh: 1.0,  track: '0',        family: 'mono'    },
    positionRank: { px: 88, weight: 900, lh: 0.85, track: '-0.04em',  family: 'display' },
    positionRow:  { px: 22, weight: 700, lh: 1.0,  track: '-0.01em',  family: 'display' },
  },

  // ============================================================
  // ELEVATION — 5 layers (paired with palette surface colors)
  // ============================================================
  elevation: {
    e0: { surface: 'bg',     border: 'transparent',                   glow: 'none',          use: 'screen background' },
    e1: { surface: 'chrome', border: 'rgba(255,255,255,0.04)',        glow: 'none',          use: 'navbar / status bar / frame' },
    e2: { surface: 'panel',  border: 'border',                         glow: 'none',          use: 'cards, sections, modals' },
    e3: { surface: 'row',    border: 'borderMid',                      glow: 'none',          use: 'list rows, tiles' },
    e4: { surface: 'rowHot', border: 'borderHot',                      glow: 'glowSoft',      use: 'armed / active row' },
  },

  // ============================================================
  // MOTION — 6 named animations (intent-based, not duration-based)
  // ============================================================
  motion: {
    pulseArmed:    { dur: '1.2s', ease: 'ease-in-out', infinite: true,  use: 'armed: riding for ranking' },
    pulseVerified: { dur: '2.4s', ease: 'ease-in-out', infinite: true,  use: 'verified: run accepted' },
    pulsePending:  { dur: '0.6s', ease: 'linear',      infinite: true,  use: 'pending: validating' },
    scanAmbient:   { dur: '4.2s', ease: 'ease-in-out', infinite: true,  use: 'HUD scan line' },
    sparkParticle: { dur: '2.8s', ease: 'ease-out',    infinite: true,  use: 'particle field, sparks' },
    glitchEvent:   { dur: '5.0s', ease: 'linear',      infinite: true,  use: 'rare event glitch (5% of cycle)' },
  },

  // ============================================================
  // SPACING + RADIUS
  // ============================================================
  space:  { xs: 6, sm: 10, md: 16, lg: 24, xl: 36, xxl: 56 },
  radius: { sm: 4, md: 8, lg: 14, pill: 999 },

  // ============================================================
  // DENSITY (3 modes)
  // ============================================================
  density: {
    compact:  { pad: 16, gap: 10, fontScale: 0.95 },
    regular:  { pad: 20, gap: 14, fontScale: 1.00 },
    spacious: { pad: 24, gap: 18, fontScale: 1.06 },
  },
} as const;

export type Tokens = typeof tokens;
export type PaletteName = keyof typeof tokens.palette;
export type SizeName = keyof typeof tokens.size;
export type TelemetryName = keyof typeof tokens.telemetry;
export type MotionName = keyof typeof tokens.motion;
export type ElevationName = keyof typeof tokens.elevation;
