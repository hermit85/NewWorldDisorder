// tokens.jsx — design tokens, palettes, typography pairs, layout densities
// All accessed via getTokens(tweaks) which returns the live token bag.

const PALETTES = {
  acid: {
    // Current vibe — neon green on near-black. The "race fluid" identity.
    name: 'Acid Track',
    bg: '#07090A',
    bgElev: '#0E1112',
    bgCard: '#13181A',
    bgCardHi: '#1A2124',
    border: 'rgba(255,255,255,0.06)',
    borderHi: 'rgba(0,255,135,0.35)',
    text: '#F2F4F3',
    textMuted: 'rgba(242,244,243,0.55)',
    textDim: 'rgba(242,244,243,0.32)',
    accent: '#00FF87',
    accentDim: 'rgba(0,255,135,0.15)',
    accentInk: '#04150B',
    warn: '#FFB020',
    danger: '#FF4757',
    podium1: '#FFD23F',
    podium2: '#C9D1D6',
    podium3: '#E08A5C',
    glow: '0 0 40px rgba(0,255,135,0.25)',
    glowSoft: '0 0 24px rgba(0,255,135,0.12)',
  },
  forge: {
    // Forza-inspired molten orange on coal. Warmer, more aggressive.
    name: 'Forge',
    bg: '#0A0807',
    bgElev: '#11100E',
    bgCard: '#1A1815',
    bgCardHi: '#22201C',
    border: 'rgba(255,255,255,0.06)',
    borderHi: 'rgba(255,138,46,0.4)',
    text: '#F4F1EE',
    textMuted: 'rgba(244,241,238,0.55)',
    textDim: 'rgba(244,241,238,0.32)',
    accent: '#FF8A2E',
    accentDim: 'rgba(255,138,46,0.15)',
    accentInk: '#1A0B02',
    warn: '#FFD23F',
    danger: '#FF4757',
    podium1: '#FFD23F',
    podium2: '#C9D1D6',
    podium3: '#E08A5C',
    glow: '0 0 40px rgba(255,138,46,0.25)',
    glowSoft: '0 0 24px rgba(255,138,46,0.12)',
  },
  arctic: {
    // Whoop-inspired ice blue. Cooler, more clinical, premium.
    name: 'Arctic',
    bg: '#06090C',
    bgElev: '#0D1117',
    bgCard: '#131922',
    bgCardHi: '#1B2330',
    border: 'rgba(255,255,255,0.06)',
    borderHi: 'rgba(80,180,255,0.4)',
    text: '#EEF3F8',
    textMuted: 'rgba(238,243,248,0.55)',
    textDim: 'rgba(238,243,248,0.32)',
    accent: '#50B4FF',
    accentDim: 'rgba(80,180,255,0.15)',
    accentInk: '#021018',
    warn: '#FFB020',
    danger: '#FF4757',
    podium1: '#FFD23F',
    podium2: '#C9D1D6',
    podium3: '#E08A5C',
    glow: '0 0 40px rgba(80,180,255,0.28)',
    glowSoft: '0 0 24px rgba(80,180,255,0.14)',
  },
};

const TYPE_PAIRS = {
  rajdhani: {
    name: 'Rajdhani × Inter',
    display: '"Rajdhani", "Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    timer: '"Rajdhani", system-ui, sans-serif',
    timerWeight: 700,
    displayWeight: 700,
    displayTracking: '-0.01em',
  },
  grotesk: {
    name: 'Space Grotesk',
    display: '"Space Grotesk", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, Menlo, monospace',
    timer: '"Space Grotesk", system-ui, sans-serif',
    timerWeight: 700,
    displayWeight: 700,
    displayTracking: '-0.02em',
  },
  geist: {
    name: 'Geist Mono',
    display: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
    body: '"Geist", "Inter", system-ui, sans-serif',
    mono: '"Geist Mono", ui-monospace, Menlo, monospace',
    timer: '"Geist Mono", ui-monospace, monospace',
    timerWeight: 700,
    displayWeight: 700,
    displayTracking: '-0.04em',
  },
};

const DENSITIES = {
  compact: { pad: 16, gap: 10, radius: 14, cardRadius: 18, fontScale: 0.95 },
  regular: { pad: 20, gap: 14, radius: 16, cardRadius: 22, fontScale: 1.0 },
  spacious: { pad: 24, gap: 18, radius: 20, cardRadius: 26, fontScale: 1.06 },
};

function getTokens(tweaks) {
  const palette = PALETTES[tweaks.palette] || PALETTES.acid;
  const type = TYPE_PAIRS[tweaks.typography] || TYPE_PAIRS.rajdhani;
  const density = DENSITIES[tweaks.density] || DENSITIES.regular;
  return {
    c: palette,
    t: type,
    d: density,
    motion: tweaks.motion !== false,
  };
}

Object.assign(window, { PALETTES, TYPE_PAIRS, DENSITIES, getTokens });
