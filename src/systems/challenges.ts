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

export function isChallengeExpired(challenge: Challenge): boolean {
  if (!challenge.endAt) return false;
  return new Date(challenge.endAt) < new Date();
}

export function isChallengeActive(challenge: Challenge): boolean {
  const now = new Date();
  if (challenge.startAt && new Date(challenge.startAt) > now) return false;
  if (challenge.endAt && new Date(challenge.endAt) < now) return false;
  return challenge.isActive;
}
