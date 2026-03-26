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
// This ensures blue trails render blue, not green/orange
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
  default: 3,
  selected: 5,
  dimmed: 2,
} as const;

export const trailLineOpacity = {
  default: 0.7,
  selected: 1,
  dimmed: 0.2,
} as const;

// Dark map style for Apple Maps / Google Maps
// This strips the map to a minimal dark base
export const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0A0A0F' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1C1C28' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#2A2A38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#14141C' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0E0E16' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1C1C28' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.neighborhood', stylers: [{ visibility: 'off' }] },
];

// Marker types
export const markerConfig = {
  startGate: {
    emoji: '🏁',
    size: 24,
    label: 'START',
  },
  finishGate: {
    emoji: '🔻',
    size: 20,
    label: 'FINISH',
  },
  hotTrail: {
    emoji: '🔥',
    size: 22,
    label: 'HOT',
  },
  challenge: {
    emoji: '⚡',
    size: 20,
    label: 'CHALLENGE',
  },
  crown: {
    emoji: '👑',
    size: 20,
    label: 'RECORD',
  },
} as const;
