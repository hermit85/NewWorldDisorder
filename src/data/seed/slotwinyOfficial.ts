// ═══════════════════════════════════════════════════════════
// OFFICIAL SEED: Słotwiny Arena — Season 01
// Source: Grupa Pingwina official trail maps & descriptions
// This is manually seeded content, not parsed/scraped.
// ═══════════════════════════════════════════════════════════

import { Difficulty, TrailType } from '../types';

// ── Spot ──

export const slotwinySpot = {
  id: 'slotwiny-arena',
  name: 'Słotwiny Arena',
  slug: 'slotwiny-arena',
  description: 'Season 01 — Krynica-Zdrój. Official gravity playground by Grupa Pingwina. Four race trails from flow to full send.',
  region: 'Krynica-Zdrój',
  operator: 'Grupa Pingwina',
  isOfficial: true,
  coverImage: '',
  status: 'active' as const,
  season: {
    id: 'season-01',
    name: 'Season 01',
    label: 'SEASON 01',
  },
  sourceMeta: {
    source: 'Grupa Pingwina official PDF trail map',
    lastVerified: '2026-03-24',
    notes: 'Seeded from official Słotwiny bike park trail map and description documents',
  },
} as const;

// ── POIs ──

export interface SlotwinePOI {
  id: string;
  label: string;
  mapLetter: string;
  type: 'facility' | 'transport' | 'parking' | 'viewpoint';
  coordinate: { latitude: number; longitude: number };
  emoji: string;
}

export const slotwinyPOIs: SlotwinePOI[] = [
  {
    id: 'poi-a',
    label: 'Pensjonat / Restauracja',
    mapLetter: 'A',
    type: 'facility',
    coordinate: { latitude: 49.4132, longitude: 20.9572 },
    emoji: '🏠',
  },
  {
    id: 'poi-b',
    label: 'Kasy / WC',
    mapLetter: 'B',
    type: 'facility',
    coordinate: { latitude: 49.4138, longitude: 20.9580 },
    emoji: '🎫',
  },
  {
    id: 'poi-c',
    label: 'Wieża widokowa',
    mapLetter: 'C',
    type: 'viewpoint',
    coordinate: { latitude: 49.4248, longitude: 20.9575 },
    emoji: '🗼',
  },
  {
    id: 'poi-d',
    label: 'Kolej linowa 6-osobowa',
    mapLetter: 'D',
    type: 'transport',
    coordinate: { latitude: 49.4190, longitude: 20.9568 },
    emoji: '🚡',
  },
  {
    id: 'poi-p',
    label: 'Parking',
    mapLetter: 'P',
    type: 'parking',
    coordinate: { latitude: 49.4125, longitude: 20.9560 },
    emoji: '🅿️',
  },
];

// ── Official trails ──

export interface OfficialTrail {
  id: string;
  mapNumber: number;
  officialName: string;
  shortName: string;
  gameLabel: string;
  colorClass: string; // official color code from map
  gameDifficulty: Difficulty;
  trailType: TrailType;
  distanceM: number;
  avgGradePct: number;
  elevationDropM: number; // computed from distance × grade
  officialDescription: string;
  gameFlavor: string;
  features: string[];
  isRaceTrail: boolean;
  isActive: boolean;
  sortOrder: number;
  sourceMeta: {
    source: string;
    officialColor: string;
    buildType: 'machine-built' | 'natural' | 'mixed';
    obstacleGrade: string;
  };
}

export const slotwinyTrails: OfficialTrail[] = [
  {
    id: 'galgan-niebieska',
    mapNumber: 1,
    officialName: 'Gałgan Niebieska',
    shortName: 'Gałgan',
    gameLabel: 'THE WARM-UP',
    colorClass: 'blue',
    gameDifficulty: 'easy',
    trailType: 'flow',
    distanceM: 2700,
    avgGradePct: 7.5,
    elevationDropM: 203, // 2700 × 0.075
    officialDescription: 'Machine-built blue trail with tables, berms, rollers and wood features. Safe progression for all levels.',
    gameFlavor: 'Smooth berms. Big tables. Build your speed.',
    features: ['tables', 'berms', 'rollers', 'wood features'],
    isRaceTrail: true,
    isActive: true,
    sortOrder: 1,
    sourceMeta: {
      source: 'Grupa Pingwina official trail map',
      officialColor: 'blue',
      buildType: 'machine-built',
      obstacleGrade: 'S/M',
    },
  },
  {
    id: 'dookola-swiata-zielona',
    mapNumber: 2,
    officialName: 'Dookoła Świata Zielona',
    shortName: 'Dookoła Świata',
    gameLabel: 'WORLD TOUR',
    colorClass: 'green',
    gameDifficulty: 'easy',
    trailType: 'flow',
    distanceM: 3100,
    avgGradePct: 5,
    elevationDropM: 155, // 3100 × 0.05
    officialDescription: 'Machine-built green flow trail with S/M obstacles. Tables, berms, rollers and wood features throughout. Designed for safe progression.',
    gameFlavor: 'The long way down. Flow state guaranteed.',
    features: ['tables', 'berms', 'rollers', 'wood features'],
    isRaceTrail: true,
    isActive: true,
    sortOrder: 2,
    sourceMeta: {
      source: 'Grupa Pingwina official trail map',
      officialColor: 'green',
      buildType: 'machine-built',
      obstacleGrade: 'S/M',
    },
  },
  {
    id: 'kometa-niebieska',
    mapNumber: 3,
    officialName: 'Kometa Niebieska',
    shortName: 'Kometa',
    gameLabel: 'COMET LINE',
    colorClass: 'blue',
    gameDifficulty: 'medium',
    trailType: 'flow',
    distanceM: 2300,
    avgGradePct: 8,
    elevationDropM: 184, // 2300 × 0.08
    officialDescription: 'Machine-built blue trail with intermediate features. Berms and rollers define the rhythm. S/M obstacles throughout.',
    gameFlavor: 'Find the rhythm. Carry the speed. Hit the line.',
    features: ['berms', 'rollers', 'intermediate features'],
    isRaceTrail: true,
    isActive: true,
    sortOrder: 3,
    sourceMeta: {
      source: 'Grupa Pingwina official trail map',
      officialColor: 'blue',
      buildType: 'machine-built',
      obstacleGrade: 'S/M',
    },
  },
  {
    id: 'dzida-czerwona',
    mapNumber: 4,
    officialName: 'Dzida Czerwona',
    shortName: 'Dzida',
    gameLabel: 'THE SPEAR',
    colorClass: 'red',
    gameDifficulty: 'hard',
    trailType: 'tech',
    distanceM: 1500,
    avgGradePct: 11,
    elevationDropM: 165, // 1500 × 0.11
    officialDescription: 'Advanced natural trail. Fast and technical with gaps, rocks, roots. Alternate lines and bypasses on bigger features.',
    gameFlavor: 'Raw. Fast. No forgiveness. Prove yourself.',
    features: ['gaps', 'rocks', 'roots', 'alternate lines', 'bypasses'],
    isRaceTrail: true,
    isActive: true,
    sortOrder: 4,
    sourceMeta: {
      source: 'Grupa Pingwina official trail map',
      officialColor: 'red',
      buildType: 'natural',
      obstacleGrade: 'L/XL',
    },
  },
];

// Walking route — NOT a race trail
export const slotwinyWalkingRoute = {
  id: 'pingwinkowy-szlak',
  mapNumber: 5,
  officialName: 'Pingwinkowy Szlak Dookoła Świata',
  shortName: 'Pingwinkowy Szlak',
  type: 'walking',
  isRaceTrail: false,
  note: 'Walking route, not included in race leaderboards',
} as const;

// ── Helpers ──

export const getRaceTrails = () => slotwinyTrails.filter((t) => t.isRaceTrail);
export const getTrailById = (id: string) => slotwinyTrails.find((t) => t.id === id);
