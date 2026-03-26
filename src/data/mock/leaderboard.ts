import { LeaderboardEntry } from '../types';

// Generate mock leaderboard for Dzida Czerwona — all-time
const entries: LeaderboardEntry[] = [
  entry('user-wolf', 'WolfRider', 'slayer', 1, 1, 132400, 0),
  entry('user-kuba', 'KubaShreds', 'hunter', 2, 2, 134200, 1800),
  entry('user-marek', 'MarekDH', 'hunter', 3, 5, 135100, 2700),
  entry('user-asia', 'AsiaMTB', 'rider', 4, 3, 136800, 4400),
  entry('user-piotrek', 'PiotrekG', 'hunter', 5, 4, 137500, 5100),
  entry('user-tomek', 'TomekEnduro', 'rider', 6, 6, 139200, 6800),
  entry('user-ania', 'AniaRider', 'rider', 7, 9, 140100, 7700),
  entry('user-bartek', 'BartekFR', 'rider', 8, 7, 141300, 8900),
  entry('user-kamil', 'KamilSpeed', 'rider', 9, 8, 142600, 10200),
  entry('user-gosia', 'GosiaDirt', 'rookie', 10, 10, 143800, 11400),
  entry('user-dawid', 'DawidMTB', 'rookie', 11, 11, 145100, 12700),
  // Current user
  entry('user-me', 'You', 'rider', 12, 15, 147200, 14800, true),
  entry('user-ola', 'OlaSender', 'rookie', 13, 12, 148900, 16500),
  entry('user-szymon', 'SzymonGrav', 'rookie', 14, 14, 150200, 17800),
  entry('user-kasia', 'KasiaRoots', 'rookie', 15, 13, 151800, 19400),
  entry('user-mateusz', 'MateuszDrop', 'rookie', 16, 16, 153100, 20700),
  entry('user-zuzia', 'ZuziaTrail', 'rookie', 17, 17, 155600, 23200),
  entry('user-filip', 'FilipFlow', 'rookie', 18, 19, 157200, 24800),
  entry('user-ewa', 'EwaSend', 'rookie', 19, 18, 159800, 27400),
  entry('user-jan', 'JanGravity', 'rookie', 20, 20, 162400, 30000),
];

function entry(
  userId: string,
  username: string,
  rankId: LeaderboardEntry['rankId'],
  currentPosition: number,
  previousPosition: number,
  bestDurationMs: number,
  gapToLeader: number,
  isCurrentUser = false
): LeaderboardEntry {
  return {
    userId,
    username,
    rankId,
    trailId: 'dzida-czerwona',
    periodType: 'all_time',
    bestDurationMs,
    currentPosition,
    previousPosition,
    delta: previousPosition - currentPosition,
    gapToNext: 0, // computed after array is built
    gapToLeader,
    isCurrentUser,
    avatarUrl: null,
  };
}

// Fix gapToNext after array is built (circular ref workaround)
// Sort by position first so gap computation is correct
const sorted = [...entries].sort((a, b) => a.currentPosition - b.currentPosition);
sorted.forEach((e, i) => {
  if (i === 0) {
    e.gapToNext = 0;
  } else {
    e.gapToNext = e.bestDurationMs - sorted[i - 1].bestDurationMs;
  }
});

export const mockLeaderboard: LeaderboardEntry[] = entries;

export const getLeaderboardForTrail = (trailId: string, period: LeaderboardEntry['periodType'] = 'all_time') =>
  mockLeaderboard.filter((e) => e.trailId === trailId && e.periodType === period);

export const getCurrentUserEntry = () =>
  mockLeaderboard.find((e) => e.isCurrentUser);
