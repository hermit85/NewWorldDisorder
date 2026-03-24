// ── Core entities ──

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'pro';
export type TrailType = 'downhill' | 'enduro' | 'freeride' | 'flow' | 'tech';
export type ValidationStatus = 'valid' | 'suspicious' | 'rejected';
export type PeriodType = 'day' | 'weekend' | 'all_time';
export type ChallengeType = 'fastest_time' | 'run_count' | 'pb_improvement' | 'multi_trail';

export type RankId = 'rookie' | 'rider' | 'hunter' | 'slayer' | 'apex' | 'legend';

// ── Run state machine ──

export type RunPhase =
  | 'idle'
  | 'armed'
  | 'countdown'
  | 'running'
  | 'finishing'
  | 'completed'
  | 'error';

// ── Spot ──

export interface Spot {
  id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  isOfficial: boolean;
  coverImage: string;
  status: 'active' | 'closed' | 'seasonal';
  activeRidersToday: number;
  trailCount: number;
}

// ── Trail ──

export interface Trail {
  id: string;
  spotId: string;
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  trailType: TrailType;
  distanceM: number;
  elevationDropM: number;
  isOfficial: boolean;
  isActive: boolean;
  sortOrder: number;
}

// ── Run ──

export interface Run {
  id: string;
  userId: string;
  spotId: string;
  trailId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  validationStatus: ValidationStatus;
  xpAwarded: number;
  isPb: boolean;
}

// ── Leaderboard ──

export interface LeaderboardEntry {
  userId: string;
  username: string;
  rankId: RankId;
  trailId: string;
  periodType: PeriodType;
  bestDurationMs: number;
  currentPosition: number;
  previousPosition: number;
  delta: number; // positive = moved up
  gapToNext: number; // ms gap to next position above
  gapToLeader: number; // ms gap to #1
  isCurrentUser: boolean;
}

// ── Challenge ──

export interface Challenge {
  id: string;
  spotId: string;
  trailId: string | null;
  type: ChallengeType;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  rewardXp: number;
  isActive: boolean;
  // User progress
  currentProgress: number;
  targetProgress: number;
}

// ── Achievement ──

export interface Achievement {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  isUnlocked: boolean;
  unlockedAt?: string;
}

// ── Rank ──

export interface Rank {
  id: RankId;
  name: string;
  xpThreshold: number;
  color: string;
  icon: string;
}

// ── User ──

export interface User {
  id: string;
  username: string;
  rankId: RankId;
  xp: number;
  xpToNextRank: number;
  totalRuns: number;
  totalPbs: number;
  bestPosition: number;
  favoriteTrailId: string;
  joinedAt: string;
  achievements: Achievement[];
}

// ── Result scenario (for testing result screen) ──

export interface ResultScenario {
  id: string;
  name: string; // scenario label for dev
  trailId: string;
  trailName: string;
  durationMs: number;
  isPb: boolean;
  previousPbMs: number | null;
  pbImprovementMs: number | null;
  rankPosition: number;
  previousPosition: number;
  positionDelta: number; // positive = moved up
  gapToNextMs: number;
  nextTargetPosition: number;
  nextTargetUsername: string;
  xpGained: number;
  achievementUnlocked: Achievement | null;
  challengeProgress: {
    challengeName: string;
    current: number;
    target: number;
    justCompleted: boolean;
  } | null;
  rankUp: {
    from: RankId;
    to: RankId;
  } | null;
}
