// ── Core entities ──

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'pro';
export type TrailType = 'downhill' | 'enduro' | 'freeride' | 'flow' | 'tech';
export type ValidationStatus = 'valid' | 'suspicious' | 'rejected';
export type PeriodType = 'day' | 'weekend' | 'all_time';
export type ChallengeType = 'fastest_time' | 'run_count' | 'pb_improvement' | 'multi_trail';

export type RankId = 'rookie' | 'rider' | 'sender' | 'ripper' | 'charger' | 'legend';

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
  /** Raw DB submission state — surfaces the 'pending' / 'rejected' cases
   *  that `status` collapses to 'closed' for public consumers. Curator
   *  UI uses this to label the bike-park status pill. */
  submissionStatus: 'pending' | 'active' | 'rejected';
  activeRidersToday: number;
  trailCount: number;
}

// ── Trail ──

/** ADR-012: two orthogonal axes describing a trail's provenance and
 *  current confidence. seedSource is immutable (origin); trustTier is
 *  mutable (state). Both null on drafts until finalize_seed_run stamps. */
export type SeedSource = 'curator' | 'rider';
export type TrustTier  = 'provisional' | 'verified' | 'disputed';
export type CalibrationStatus =
  | 'draft'
  | 'fresh_pending_second_run'
  | 'live_fresh'
  | 'live_confirmed'
  | 'stable'
  | 'calibrating'
  | 'verified'
  | 'locked';
export type ConfidenceLabel = 'fresh' | 'confirmed' | 'community_checked' | 'stable';

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
  /** Pioneer flow state. Legacy values are kept during rollout. */
  calibrationStatus: CalibrationStatus;
  /** True when `trails.geometry` is null (no pioneer run yet). */
  geometryMissing: boolean;

  // ── Sprint 4 — trust + versioning + Pioneer identity ──
  /** Origin: who first seeded the geometry. Null on drafts. */
  seedSource: SeedSource | null;
  /** Current confidence tier. Null on drafts. */
  trustTier: TrustTier | null;
  /** Organic confidence label derived from consistent current-version runs. */
  confidenceLabel: ConfidenceLabel | null;
  consistentPioneerRunsCount: number;
  uniqueConfirmingRidersCount: number;
  /** UUID of the currently-authoritative `trail_versions` row. */
  currentVersionId: string | null;
  /** Pioneer identity — IMMUTABLE after first assignment (DB trigger). */
  pioneerUserId: string | null;
  /** Joined from profiles for display; null if unjoined. */
  pioneerUsername: string | null;
  /** ISO timestamp of first Pioneer seeding. */
  pioneeredAt: string | null;
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
  /** Avatar URL — null if rider has no photo */
  avatarUrl: string | null;
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
  /** Avatar URL from Supabase Storage — null if not set */
  avatarUrl: string | null;
  /** Sprint 4 Pioneer counters (mig 011). `verified` populated Sprint 5+. */
  pioneeredTotalCount: number;
  pioneeredVerifiedCount: number;
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
