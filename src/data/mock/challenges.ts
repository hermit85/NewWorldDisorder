import { Challenge } from '../types';

export const mockChallenges: Challenge[] = [
  {
    id: 'weekend-fastest',
    spotId: 'slotwiny-arena',
    trailId: 'dzida-czerwona',
    type: 'fastest_time',
    name: 'Weekend Heat: Dzida Czerwona',
    description: 'Set the fastest time on Dzida Czerwona this weekend',
    startAt: '2026-03-21T00:00:00',
    endAt: '2026-03-23T23:59:59',
    rewardXp: 300,
    isActive: true,
    currentProgress: 0,
    targetProgress: 1,
  },
  {
    id: 'three-runs-today',
    spotId: 'slotwiny-arena',
    trailId: null,
    type: 'run_count',
    name: '3 Runs Today',
    description: 'Complete 3 valid runs today at Słotwiny Arena',
    startAt: '2026-03-24T00:00:00',
    endAt: '2026-03-24T23:59:59',
    rewardXp: 100,
    isActive: true,
    currentProgress: 1,
    targetProgress: 3,
  },
];

export const getActiveChallenges = (spotId: string) =>
  mockChallenges.filter((c) => c.spotId === spotId && c.isActive);
