// Mock per-trail stats for the current user

export interface UserTrailStats {
  trailId: string;
  pbMs: number | null;
  position: number | null;
  totalRuns: number;
  nearestRival: {
    username: string;
    position: number;
    timeMs: number;
    gapMs: number; // how much faster they are
  } | null;
  top3: {
    position: number;
    username: string;
    timeMs: number;
  }[];
}

export const mockUserTrailStats: UserTrailStats[] = [
  {
    trailId: 'galgan-niebieska',
    pbMs: 165000,
    position: 8,
    totalRuns: 8,
    nearestRival: {
      username: 'AniaRider',
      position: 7,
      timeMs: 162400,
      gapMs: 2600,
    },
    top3: [
      { position: 1, username: 'WolfRider', timeMs: 142800 },
      { position: 2, username: 'AsiaMTB', timeMs: 145600 },
      { position: 3, username: 'KubaShreds', timeMs: 147200 },
    ],
  },
  {
    trailId: 'dookola-swiata-zielona',
    pbMs: 210000,
    position: 6,
    totalRuns: 6,
    nearestRival: {
      username: 'PiotrekG',
      position: 5,
      timeMs: 207400,
      gapMs: 2600,
    },
    top3: [
      { position: 1, username: 'KubaShreds', timeMs: 186200 },
      { position: 2, username: 'WolfRider', timeMs: 189800 },
      { position: 3, username: 'TomekEnduro', timeMs: 192400 },
    ],
  },
  {
    trailId: 'kometa-niebieska',
    pbMs: 147200,
    position: 12,
    totalRuns: 15,
    nearestRival: {
      username: 'DawidMTB',
      position: 11,
      timeMs: 145100,
      gapMs: 2100,
    },
    top3: [
      { position: 1, username: 'WolfRider', timeMs: 122400 },
      { position: 2, username: 'KubaShreds', timeMs: 124800 },
      { position: 3, username: 'MarekDH', timeMs: 126200 },
    ],
  },
  {
    trailId: 'dzida-czerwona',
    pbMs: 108000,
    position: 14,
    totalRuns: 5,
    nearestRival: {
      username: 'OlaSender',
      position: 13,
      timeMs: 106200,
      gapMs: 1800,
    },
    top3: [
      { position: 1, username: 'WolfRider', timeMs: 88400 },
      { position: 2, username: 'MarekDH', timeMs: 90600 },
      { position: 3, username: 'PiotrekG', timeMs: 92200 },
    ],
  },
];

export const getUserTrailStats = (trailId: string) =>
  mockUserTrailStats.find((s) => s.trailId === trailId);
