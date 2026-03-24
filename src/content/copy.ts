// Centralized product copy — no generic fitness language allowed here
// Every string should feel like arcade racing, not sports tracking

export const copy = {
  // Result screen
  newPb: 'NEW PB',
  noPb: 'NO PB',
  movedUp: (n: number) => `Moved up ${n} place${n > 1 ? 's' : ''}`,
  movedDown: (n: number) => `Dropped ${n} place${n > 1 ? 's' : ''}`,
  holdingPosition: 'Holding position',
  gapToNext: (ms: number, pos: number, name: string) =>
    `${formatGap(ms)} to #${pos} ${name}`,
  gapToTop10: (ms: number) => `${formatGap(ms)} to Top 10`,
  xpGained: (xp: number) => `+${xp} XP`,
  achievementUnlocked: 'Achievement unlocked',
  challengeProgress: (current: number, target: number) =>
    `${current}/${target}`,
  challengeComplete: 'Challenge complete',
  rankUp: (rankName: string) => `Ranked up to ${rankName}`,
  runAgain: 'Run again',
  viewLeaderboard: 'View leaderboard',
  shareResult: 'Share',

  // Run screen
  armed: 'ARMED',
  ready: 'READY',
  go: 'GO',
  running: 'RUNNING',
  finishing: 'FINISHING',
  tapToStart: 'Tap when ready',
  tapToFinish: 'Tap to finish',

  // Trail detail
  startRun: 'Start run',
  yourPb: 'Your PB',
  noPbYet: 'No PB yet',
  nearestRival: 'Nearest rival',
  topRiders: 'Top riders',

  // Leaderboard
  today: 'Today',
  weekend: 'Weekend',
  allTime: 'All time',
  position: '#',
  timeDelta: (ms: number) => `+${formatGap(ms)}`,

  // Home
  activeChallenge: 'Active challenge',
  hotTrail: 'Hot trail',
  ridersToday: (n: number) => `${n} rider${n > 1 ? 's' : ''} today`,
  weekendHeat: 'Weekend heat is on',
  yourRank: 'Your rank',

  // Profile
  totalRuns: 'Total runs',
  personalBests: 'Personal bests',
  bestPosition: 'Best position',
  favoriteTrail: 'Favorite trail',

  // Spot
  trails: 'Trails',
  challenges: 'Challenges',
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
