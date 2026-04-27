// ─────────────────────────────────────────────────────────────
// Achievement unlock derivation — single source of truth.
//
// Lifted out of the ProfileScreen JSX so the rule "if scalar
// progress reaches target the card MUST render unlocked" can be
// pinned by tests. The original bug was a card showing "2/2 ·
// LOCKED" — 100% progress while still labelled as "do zdobycia",
// which is exactly the kind of small absurd a rider catches.
// ─────────────────────────────────────────────────────────────

export interface AchievementDefinition {
  slug: string;
  /** Optional scalar field on the user profile that maps directly
   *  to the unlock rule. Omit when the unlock condition is more
   *  nuanced (e.g. "two PBs in one day" — totalPbs lifetime is
   *  the WRONG scalar and would lie). */
  progressField?: 'totalRuns' | 'totalPbs';
  progressTarget?: number;
}

export interface AchievementUnlocked {
  slug: string;
}

export interface ProfileScalars {
  totalRuns?: number | null;
  totalPbs?: number | null;
}

export interface AchievementStatus {
  isUnlocked: boolean;
  /** Number to display in the locked-progress chip ("3/20"), or
   *  null when no chip is appropriate (already unlocked, or no
   *  progress field). Clamps to `target - 1` so a locked card
   *  never displays a 100% progress chip. */
  displayProgress: number | null;
  displayTarget: number | null;
}

export function deriveAchievementStatus(
  def: AchievementDefinition,
  serverUnlocked: AchievementUnlocked[],
  profile: ProfileScalars,
): AchievementStatus {
  const isServerUnlocked = serverUnlocked.some((a) => a.slug === def.slug);
  const fieldValue = def.progressField
    ? profile[def.progressField] ?? 0
    : 0;
  const meetsTarget =
    def.progressField != null
    && def.progressTarget != null
    && fieldValue >= def.progressTarget;
  const isUnlocked = isServerUnlocked || meetsTarget;

  if (isUnlocked) {
    return { isUnlocked: true, displayProgress: null, displayTarget: null };
  }
  if (def.progressField == null || def.progressTarget == null) {
    return { isUnlocked: false, displayProgress: null, displayTarget: null };
  }
  // Clamp to target - 1 so the chip can never lie "100% locked".
  return {
    isUnlocked: false,
    displayProgress: Math.min(fieldValue, def.progressTarget - 1),
    displayTarget: def.progressTarget,
  };
}
