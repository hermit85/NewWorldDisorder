import { User, Achievement } from '../types';
import { mockAchievements } from './achievements';

export const mockUser: User = {
  id: 'user-me',
  username: 'You',
  rankId: 'rider',
  xp: 1450,
  xpToNextRank: 2000,
  totalRuns: 23,
  totalPbs: 5,
  bestPosition: 8,
  favoriteTrailId: 'dzida-czerwona',
  joinedAt: '2025-06-15',
  achievements: mockAchievements.filter((a) => a.isUnlocked),
  avatarUrl: null,
};
