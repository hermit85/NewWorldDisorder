import { colors } from './colors';
import { Difficulty } from '@/data/types';

// Trail line styling by difficulty (fallback)
export const trailLineColors: Record<Difficulty, string> = {
  easy: colors.diffEasy,
  medium: colors.diffMedium,
  hard: colors.diffHard,
  expert: colors.diffExpert,
  pro: colors.diffPro,
};

// Official trail colors — use colorClass from seed data, not difficulty
export const officialTrailColors: Record<string, string> = {
  green: '#00FF88',  // Dookoła Świata
  blue: '#4A9EFF',   // Gałgan, Kometa
  red: '#FF3B30',    // Dzida
  black: '#FFFFFF',  // future expert trails
};

// Get the correct display color for a trail
export function getTrailColor(colorClass?: string, difficulty?: Difficulty): string {
  if (colorClass && officialTrailColors[colorClass]) {
    return officialTrailColors[colorClass];
  }
  if (difficulty) {
    return trailLineColors[difficulty];
  }
  return colors.textTertiary;
}

export const trailLineWidth = {
  default: 3.5,
  selected: 6,
  dimmed: 2,
  shadow: 8, // dark outline behind trail for separation from terrain
} as const;

export const trailLineOpacity = {
  default: 0.85,
  selected: 1,
  dimmed: 0.15,
  shadow: 0.4,
} as const;

// ═══════════════════════════════════════════════════════════
// Stylized Dark Terrain Map — NWD branded mountain basemap
// Strips all city/navigation elements. Emphasizes terrain.
// Used on Android (Google Maps JSON styling)
// ═══════════════════════════════════════════════════════════
export const darkMapStyle = [
  // ── Base geometry: ultra-dark mountain background ──
  { elementType: 'geometry', stylers: [{ color: '#080810' }] },

  // ── Kill ALL labels ──
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // ── Landscape: dark terrain with subtle differentiation ──
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0C0C16' }] },
  { featureType: 'landscape.natural.terrain', elementType: 'geometry', stylers: [{ color: '#101020' }] },
  { featureType: 'landscape.natural.landcover', elementType: 'geometry', stylers: [{ color: '#0A0E14' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#0A0A12' }] },

  // ── Water: very dark, subtle presence ──
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#06060C' }] },

  // ── Roads: nearly invisible — just ghost lines ──
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#12121C' }, { weight: 0.5 }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#14141E' }, { weight: 0.8 }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },

  // ── Kill everything non-terrain ──
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', stylers: [{ visibility: 'off' }] },
];

// ═══════════════════════════════════════════════════════════
// Terrain zone colors — for polygon overlays on the map
// These create the stylized mountain terrain feel
// ═══════════════════════════════════════════════════════════
export const terrainColors = {
  forest: 'rgba(8, 20, 12, 0.65)',       // dark forest masses
  openSlope: 'rgba(16, 20, 14, 0.40)',   // lighter meadow/slope areas
  summit: 'rgba(24, 28, 20, 0.35)',      // summit plateau
  base: 'rgba(12, 14, 18, 0.50)',        // base area
  liftLine: 'rgba(90, 90, 106, 0.25)',   // lift corridor
} as const;

// Marker types (legacy — kept for compatibility)
export const markerConfig = {
  startGate: { emoji: '🏁', size: 24, label: 'START' },
  finishGate: { emoji: '🔻', size: 20, label: 'FINISH' },
  hotTrail: { emoji: '🔥', size: 22, label: 'HOT' },
  challenge: { emoji: '⚡', size: 20, label: 'CHALLENGE' },
  crown: { emoji: '👑', size: 20, label: 'RECORD' },
} as const;
