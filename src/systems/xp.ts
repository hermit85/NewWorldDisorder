import { ResultScenario, RankId } from '@/data/types';

// XP awards per action
const XP_TABLE = {
  validRun: 25,
  newPb: 50,
  top10Entry: 200,
  top3Entry: 500,
  challengeComplete: 100,
  rankUp: 100,
} as const;

export function calculateXp(scenario: Pick<ResultScenario, 'isPb' | 'rankPosition' | 'previousPosition' | 'challengeProgress' | 'rankUp'>): number {
  let xp = XP_TABLE.validRun;

  if (scenario.isPb) xp += XP_TABLE.newPb;
  if (scenario.rankPosition <= 10 && scenario.previousPosition > 10) xp += XP_TABLE.top10Entry;
  if (scenario.rankPosition <= 3 && scenario.previousPosition > 3) xp += XP_TABLE.top3Entry;
  if (scenario.challengeProgress?.justCompleted) xp += XP_TABLE.challengeComplete;
  if (scenario.rankUp) xp += XP_TABLE.rankUp;

  return xp;
}

export { XP_TABLE };
