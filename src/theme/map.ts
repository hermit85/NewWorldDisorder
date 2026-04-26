import { colors } from './colors';
import { Difficulty } from '@/data/types';

// ═══════════════════════════════════════════════════════════
// NWD Map Presentation System v1
// Reusable visual rules for all arena maps.
// Venue-specific data (polylines, zones) lives in seed files.
// ═══════════════════════════════════════════════════════════

// ── Trail colors by official colorClass ──
export const officialTrailColors: Record<string, string> = {
  green: '#00FF88',
  blue: '#4A9EFF',
  red: '#FF3B30',
  black: '#FFFFFF',
};

// ── Trail colors by difficulty (fallback) ──
export const trailLineColors: Record<Difficulty, string> = {
  easy: colors.diffEasy,
  medium: colors.diffMedium,
  hard: colors.diffHard,
  expert: colors.diffExpert,
  pro: colors.diffPro,
};

export function getTrailColor(colorClass?: string, difficulty?: Difficulty): string {
  if (colorClass && officialTrailColors[colorClass]) {
    return officialTrailColors[colorClass];
  }
  if (difficulty) {
    return trailLineColors[difficulty];
  }
  return colors.textTertiary;
}

// ── Trail line geometry ──
export const trailLineWidth = {
  default: 3,
  selected: 4.5,
  dimmed: 1.5,
  shadow: 6,
  selectedShadow: 10,
  glow: 12,
  selectedGlow: 22,
  selectedOuterGlow: 34,  // wide soft halo on selected
  hitTarget: 32,
} as const;

export const trailLineOpacity = {
  default: 0.90,
  selected: 1,
  dimmed: 0.18,        // ghost trails still provide spatial context
  shadow: 0.35,
} as const;

export const trailGlowOpacity = {
  default: 0.20,       // visible ambient glow on dark bg
  selected: 0.50,      // strong hero aura
  selectedOuter: 0.10, // wide soft outer halo
  dimmed: 0,
} as const;

// ── Edge gradients — blends map into UI chrome ──
export const mapGradient = {
  top: {
    colors: ['rgba(7, 7, 16, 0.92)', 'rgba(7, 7, 16, 0.5)', 'rgba(7, 7, 16, 0.1)', 'transparent'] as const,
    height: 110,
  },
  bottom: {
    colors: ['transparent', 'rgba(7, 7, 16, 0.3)', 'rgba(7, 7, 16, 0.7)', 'rgba(7, 7, 16, 0.95)'] as const,
    height: 100,
  },
  // Side vignette strips
  sideLeft: {
    colors: ['rgba(7, 7, 16, 0.5)', 'transparent'] as const,
    width: 48,
  },
  sideRight: {
    colors: ['transparent', 'rgba(7, 7, 16, 0.5)'] as const,
    width: 48,
  },
} as const;

// ── Terrain zone colors ──
// Subtle fills + visible stroke outlines = "sketched terrain" not "colored blobs"
export const terrainFill: Record<string, string> = {
  forest: 'rgba(5, 16, 8, 0.18)',
  openSlope: 'rgba(8, 14, 6, 0.10)',
  summit: 'rgba(14, 18, 12, 0.10)',
  base: 'rgba(8, 10, 16, 0.12)',
} as const;

export const terrainStroke: Record<string, string> = {
  forest: 'rgba(20, 50, 30, 0.14)',
  openSlope: 'rgba(25, 40, 20, 0.10)',
  summit: 'rgba(35, 45, 28, 0.12)',
  base: 'rgba(18, 22, 35, 0.10)',
} as const;

// Compat alias for lift line (used in ArenaMapCustom)
export const terrainColors: Record<string, string> = {
  ...terrainFill,
  liftLine: 'rgba(55, 55, 72, 0.20)',
} as const;

// ── Android dark map style (Google Maps JSON) ──
export const darkMapStyle = [
  // Base: ultra-dark
  { elementType: 'geometry', stylers: [{ color: '#070710' }] },

  // Kill all labels
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // Landscape — subtle terrain depth
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0B0B15' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ color: '#0E0E1C' }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ color: '#090E13' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#090910' }] },

  // Water — dark blue tint (not pure black — gives orientation)
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#080C14' }] },

  // Roads — ghost lines for orientation
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#111119' }, { weight: 0.5 }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#13131C' }, { weight: 0.8 }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },

  // Kill non-terrain
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
];

// markerConfig (with emoji) was a never-consumed compat shim;
// removed per voice.md "no emoji in UI". Markers now use IconGlyph
// (`flag` for finish, `lock` for armed, `rec` for live, etc.) so
// the visual identity stays inside the canonical glyph set.
