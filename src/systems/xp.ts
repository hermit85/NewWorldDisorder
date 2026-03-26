// ═══════════════════════════════════════════════════════════
// XP & Level System
//
// XP is awarded per run based on what the rider achieved.
// Levels are a simple, satisfying number that grows with play.
// Ranks are prestige tiers (Rookie → Legend) with larger gaps.
//
// Levels and ranks are independent:
// - Level = total play engagement (every 100 XP = 1 level)
// - Rank = prestige tier (500, 2000, 5000, 12000, 30000 XP)
// ═══════════════════════════════════════════════════════════

// XP awards per action
export const XP_TABLE = {
  // Base run award
  validRun: 25,
  practiceRun: 5,

  // Bonus conditions (additive)
  newPb: 50,
  top10Entry: 200,
  top3Entry: 500,

  // Progression awards
  challengeComplete: 100,
  rankUp: 100,
} as const;

/**
 * Calculate total XP for a run based on what happened.
 * Returns breakdown for UI display.
 */
export interface XpBreakdown {
  base: number;
  pbBonus: number;
  positionBonus: number;
  total: number;
  reasons: string[];
}

export function calculateRunXp(params: {
  isEligible: boolean;
  isPractice: boolean;
  isPb: boolean;
  position: number | null;
  previousPosition: number | null;
}): XpBreakdown {
  const { isEligible, isPractice, isPb, position, previousPosition } = params;

  // Practice runs get minimal XP
  if (isPractice) {
    return { base: XP_TABLE.practiceRun, pbBonus: 0, positionBonus: 0, total: XP_TABLE.practiceRun, reasons: ['Trening'] };
  }

  // Non-eligible ranked runs get nothing
  if (!isEligible) {
    return { base: 0, pbBonus: 0, positionBonus: 0, total: 0, reasons: [] };
  }

  const reasons: string[] = ['Zjazd rankingowy'];
  let base = XP_TABLE.validRun;
  let pbBonus = 0;
  let positionBonus = 0;

  // PB bonus
  if (isPb) {
    pbBonus = XP_TABLE.newPb;
    reasons.push('Nowe PB');
  }

  // Position bonus — only on entry/improvement into tier
  const pos = position ?? 999;
  const prevPos = previousPosition ?? 999;
  if (pos <= 3 && prevPos > 3) {
    positionBonus = XP_TABLE.top3Entry;
    reasons.push('Podium');
  } else if (pos <= 10 && prevPos > 10) {
    positionBonus = XP_TABLE.top10Entry;
    reasons.push('TOP 10');
  }

  const total = base + pbBonus + positionBonus;
  return { base, pbBonus, positionBonus, total, reasons };
}

// ═══════════════════════════════════════════════════════════
// LEVEL SYSTEM
// Simple: every 100 XP = 1 level. Level 1 at 0 XP.
// Gives satisfying "level up" moments frequently.
// ═══════════════════════════════════════════════════════════

const XP_PER_LEVEL = 100;

export function getLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function getLevelProgress(xp: number): { level: number; currentXp: number; nextLevelXp: number; progress: number } {
  const level = getLevel(xp);
  const xpInLevel = xp % XP_PER_LEVEL;
  return {
    level,
    currentXp: xpInLevel,
    nextLevelXp: XP_PER_LEVEL,
    progress: xpInLevel / XP_PER_LEVEL,
  };
}

export function didLevelUp(xpBefore: number, xpAfter: number): boolean {
  return getLevel(xpAfter) > getLevel(xpBefore);
}
