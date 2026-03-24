import { Challenge } from '@/data/types';

export function updateChallengeProgress(
  challenge: Challenge,
  increment: number = 1
): Challenge {
  const newProgress = Math.min(challenge.currentProgress + increment, challenge.targetProgress);
  return {
    ...challenge,
    currentProgress: newProgress,
  };
}

export function isChallengeComplete(challenge: Challenge): boolean {
  return challenge.currentProgress >= challenge.targetProgress;
}
