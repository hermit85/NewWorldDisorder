// ═══════════════════════════════════════════════════════════
// Achievement status — pin "no 100% locked" + truthful progress.
//
// The original Profile bug surfaced "Podwójny PB · 2/2" while
// rendering the locked styling. The unlock condition for that
// achievement is "two PBs in one day", not "totalPbs ≥ 2", so
// the chip lied. The catalog now omits progressField for that
// def, and this helper guarantees: if a chip is shown, it shows
// strictly below target.
// ═══════════════════════════════════════════════════════════

import { deriveAchievementStatus } from '@/features/profile/achievement';

describe('deriveAchievementStatus', () => {
  test('server-unlocked → ZDOBYTE, no chip', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 1 },
      [{ slug: 'a' }],
      { totalRuns: 1 },
    );
    expect(s.isUnlocked).toBe(true);
    expect(s.displayProgress).toBeNull();
    expect(s.displayTarget).toBeNull();
  });

  test('local progress reaches target → unlocked even if server lags', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 20 },
      [],
      { totalRuns: 25 },
    );
    expect(s.isUnlocked).toBe(true);
  });

  test('locked card NEVER shows 100% progress chip — clamps to target-1', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 50 },
      [],
      // Server lags but profile.totalRuns has reached 50.
      { totalRuns: 50 },
    );
    // Reaching the target unlocks. No "50/50 LOCKED" can occur.
    expect(s.isUnlocked).toBe(true);
    expect(s.displayProgress).toBeNull();
  });

  test('partial progress shows the chip with the live count', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 20 },
      [],
      { totalRuns: 10 },
    );
    expect(s.isUnlocked).toBe(false);
    expect(s.displayProgress).toBe(10);
    expect(s.displayTarget).toBe(20);
  });

  test('overshoot but server still says locked → render unlocked, never "21/20"', () => {
    // Pre-fix bug: profile shows totalRuns=21, target=20, server hasn't
    // synced. The old UI rendered "21/20 · LOCKED". Now we unlock.
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 20 },
      [],
      { totalRuns: 21 },
    );
    expect(s.isUnlocked).toBe(true);
  });

  test('no progressField → no chip, locked until server unlocks', () => {
    // "Podwójny PB" — unlock = "two PBs in one day", not totalPbs.
    const s = deriveAchievementStatus(
      { slug: 'double-pb' },
      [],
      { totalPbs: 99 },
    );
    expect(s.isUnlocked).toBe(false);
    expect(s.displayProgress).toBeNull();
    expect(s.displayTarget).toBeNull();
  });

  test('null profile values default to 0', () => {
    const s = deriveAchievementStatus(
      { slug: 'a', progressField: 'totalRuns', progressTarget: 1 },
      [],
      { totalRuns: null },
    );
    expect(s.isUnlocked).toBe(false);
    expect(s.displayProgress).toBe(0);
    expect(s.displayTarget).toBe(1);
  });
});
