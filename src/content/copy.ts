// ═══════════════════════════════════════════════════════════
// Polish-first product copy — liga grawitacyjna, nie fitness app
// Brand terms kept in English: NWD, PB, XP, GPS, TOP 10
// ═══════════════════════════════════════════════════════════

export const copy = {
  // Result screen
  newPb: 'NOWE PB',
  noPb: 'BRAK PB',
  movedUp: (n: number) => `Awans o ${n} ${n === 1 ? 'miejsce' : n < 5 ? 'miejsca' : 'miejsc'}`,
  movedDown: (n: number) => `Spadek o ${n} ${n === 1 ? 'miejsce' : n < 5 ? 'miejsca' : 'miejsc'}`,
  holdingPosition: 'Pozycja utrzymana',
  gapToNext: (ms: number, pos: number, name: string) =>
    `${formatGap(ms)} do #${pos} ${name}`,
  gapToTop10: (ms: number) => `${formatGap(ms)} do TOP 10`,
  xpGained: (xp: number) => `+${xp} XP`,
  achievementUnlocked: 'Osiągnięcie odblokowane',
  challengeProgress: (current: number, target: number) =>
    `${current}/${target}`,
  challengeComplete: 'Wyzwanie ukończone',
  rankUp: (rankName: string) => `Awans na ${rankName}`,
  runAgain: 'Jedź ponownie',
  viewLeaderboard: 'Tablica wyników',
  shareResult: 'Udostępnij',

  // Run screen
  armed: 'GOTOWY',
  ready: 'READY',
  go: 'START',
  running: 'JAZDA',
  finishing: 'KOŃCZENIE',
  tapToStart: 'Dotknij gdy gotowy',
  tapToFinish: 'Dotknij aby zakończyć',

  // Trail detail
  startRun: 'Rozpocznij zjazd',
  yourPb: 'Twoje PB',
  noPbYet: 'Brak PB',
  nearestRival: 'Najbliższy rywal',
  topRiders: 'Najlepsi riderzy',

  // Leaderboard
  today: 'Dziś',
  weekend: 'Weekend',
  allTime: 'Wszechczasów',
  position: '#',
  timeDelta: (ms: number) => `+${formatGap(ms)}`,

  // Home
  activeChallenge: 'Aktywne wyzwanie',
  hotTrail: 'Popularna trasa',
  ridersToday: (n: number) => `${n} ${n === 1 ? 'rider' : 'riderów'} dziś`,
  weekendHeat: 'Weekend w pełni',
  yourRank: 'Twoja ranga',

  // Profile
  totalRuns: 'Zjazdy',
  personalBests: 'Rekordy',
  bestPosition: 'Najlepsza pozycja',
  favoriteTrail: 'Ulubiona trasa',

  // Spot
  trails: 'Trasy',
  challenges: 'Wyzwania',
} as const;

// Format milliseconds as readable gap
function formatGap(ms: number): string {
  if (ms < 1000) return `0.${Math.round(ms / 100)}s`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

// Format duration from ms to MM:SS.mmm
export function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secStr = seconds.toFixed(2).padStart(5, '0');
  if (minutes > 0) {
    return `${minutes}:${secStr}`;
  }
  return secStr;
}

// Format duration short (for leaderboard)
export function formatTimeShort(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const secStr = seconds.toFixed(1).padStart(4, '0');
  if (minutes > 0) {
    return `${minutes}:${secStr}`;
  }
  return secStr;
}
