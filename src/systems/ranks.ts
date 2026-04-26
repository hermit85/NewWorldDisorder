import { Rank, RankId } from '@/data/types';
import { colors } from '@/theme/colors';

export const ranks: Rank[] = [
  { id: 'rookie', name: 'Rookie', xpThreshold: 0, color: colors.rankRookie, icon: '◇' },
  { id: 'rider', name: 'Rider', xpThreshold: 500, color: colors.rankRider, icon: '◆' },
  { id: 'sender', name: 'Sender', xpThreshold: 2000, color: colors.rankSender, icon: '▼' },
  { id: 'ripper', name: 'Ripper', xpThreshold: 5000, color: colors.rankRipper, icon: '★' },
  { id: 'charger', name: 'Charger', xpThreshold: 12000, color: colors.rankCharger, icon: '⬢' },
  { id: 'legend', name: 'Legend', xpThreshold: 30000, color: colors.rankLegend, icon: '✦' },
];

export function getRank(id: RankId): Rank {
  return ranks.find((r) => r.id === id) ?? ranks[0];
}

export function getRankForXp(xp: number): Rank {
  let current = ranks[0];
  for (const rank of ranks) {
    if (xp >= rank.xpThreshold) current = rank;
    else break;
  }
  return current;
}

export function getXpToNextRank(xp: number): { nextRank: Rank | null; xpNeeded: number; progress: number } {
  const currentRank = getRankForXp(xp);
  const currentIdx = ranks.indexOf(currentRank);
  const nextRank = ranks[currentIdx + 1] ?? null;

  if (!nextRank) return { nextRank: null, xpNeeded: 0, progress: 1 };

  const xpInLevel = xp - currentRank.xpThreshold;
  const xpForLevel = nextRank.xpThreshold - currentRank.xpThreshold;

  return {
    nextRank,
    xpNeeded: nextRank.xpThreshold - xp,
    progress: xpInLevel / xpForLevel,
  };
}
