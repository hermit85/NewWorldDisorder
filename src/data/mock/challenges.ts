import { Challenge } from '../types';

export const mockChallenges: Challenge[] = [
  {
    id: 'weekend-fastest',
    spotId: 'slotwiny-arena',
    trailId: 'dzida-czerwona',
    type: 'fastest_time',
    name: 'Weekend: Dzida Czerwona',
    description: 'Ustaw najszybszy czas na Dzida Czerwona w ten weekend',
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
    name: '3 zjazdy dziś',
    description: 'Ukończ 3 prawidłowe zjazdy dziś na Słotwiny Arena',
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
