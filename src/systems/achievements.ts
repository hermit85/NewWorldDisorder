import { Achievement, ResultScenario } from '@/data/types';
import { mockAchievements } from '@/data/mock/achievements';

// Check if any achievement was just unlocked based on a result
export function checkAchievements(
  scenario: ResultScenario,
  userAchievements: Achievement[]
): Achievement | null {
  const unlockedIds = new Set(userAchievements.filter((a) => a.isUnlocked).map((a) => a.id));

  // Top 10 Entry
  if (
    scenario.rankPosition <= 10 &&
    scenario.previousPosition > 10 &&
    !unlockedIds.has('top-10-entry')
  ) {
    return mockAchievements.find((a) => a.id === 'top-10-entry') ?? null;
  }

  // Double PB — would need session context, skip for now

  return null;
}
