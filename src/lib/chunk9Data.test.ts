import {
  deriveDailyChallengesFromRuns,
  deriveStreakFromRuns,
  formatRelativeTimestamp,
} from '@/lib/api';

describe('chunk9 data helpers', () => {
  test('deriveDailyChallengesFromRuns counts practice for ride today and verified for complete three', () => {
    const challenges = deriveDailyChallengesFromRuns([
      { verification_status: 'practice_only', is_pb: false },
      { verification_status: 'verified', is_pb: true },
      { verification_status: 'verified', is_pb: false },
      { verification_status: 'verified', is_pb: false },
    ] as any);

    expect(challenges).toEqual([
      expect.objectContaining({
        id: 'ride_today',
        rewardXp: 50,
        current: 1,
        target: 1,
        completed: true,
      }),
      expect.objectContaining({
        id: 'beat_pb',
        rewardXp: 100,
        current: 1,
        target: 1,
        completed: true,
      }),
      expect.objectContaining({
        id: 'complete_three',
        rewardXp: 150,
        current: 3,
        target: 3,
        completed: true,
      }),
    ]);
  });

  test('deriveStreakFromRuns keeps consecutive streak safe when rider already rode today', () => {
    const streak = deriveStreakFromRuns(
      [
        {
          started_at: '2026-04-22T09:30:00.000Z',
          verification_status: 'verified',
          duration_ms: 90_000,
        },
        {
          started_at: '2026-04-21T14:00:00.000Z',
          verification_status: 'practice_only',
          duration_ms: 70_000,
        },
        {
          started_at: '2026-04-20T11:00:00.000Z',
          verification_status: 'verified',
          duration_ms: 80_000,
        },
      ],
      new Date('2026-04-22T20:00:00.000Z'),
    );

    expect(streak.days).toBe(3);
    expect(streak.currentDayComplete).toBe(true);
    expect(streak.mode).toBe('safe');
    expect(streak.graceExpiresAt).toContain('2026-04-23');
  });

  test('deriveStreakFromRuns enters warn mode inside final 6 hours of grace', () => {
    const streak = deriveStreakFromRuns(
      [
        {
          started_at: '2026-04-21T08:00:00.000Z',
          verification_status: 'verified',
          duration_ms: 75_000,
        },
        {
          started_at: '2026-04-20T08:00:00.000Z',
          verification_status: 'verified',
          duration_ms: 75_000,
        },
      ],
      new Date('2026-04-22T20:30:00.000Z'),
    );

    expect(streak.days).toBe(2);
    expect(streak.currentDayComplete).toBe(false);
    expect(streak.mode).toBe('warn');
    expect(streak.remainingHours).toBeGreaterThanOrEqual(0);
    expect(streak.remainingHours).toBeLessThanOrEqual(6);
    expect(streak.remainingMinutes).toBeGreaterThanOrEqual(0);
    expect(streak.remainingMinutes).toBeLessThan(60);
  });

  test('deriveStreakFromRuns resets once grace expires', () => {
    const streak = deriveStreakFromRuns(
      [
        {
          started_at: '2026-04-20T08:00:00.000Z',
          verification_status: 'verified',
          duration_ms: 75_000,
        },
      ],
      new Date('2026-04-22T00:10:00.000Z'),
    );

    expect(streak.days).toBe(0);
    expect(streak.mode).toBe('safe');
    expect(streak.currentDayComplete).toBe(false);
  });

  test('deriveStreakFromRuns ignores short runs and non-counting verification states', () => {
    const streak = deriveStreakFromRuns(
      [
        {
          started_at: '2026-04-22T09:30:00.000Z',
          verification_status: 'outside_start_gate',
          duration_ms: 120_000,
        },
        {
          started_at: '2026-04-21T14:00:00.000Z',
          verification_status: 'practice_only',
          duration_ms: 50_000,
        },
      ],
      new Date('2026-04-22T20:00:00.000Z'),
    );

    expect(streak.days).toBe(0);
  });

  test('formatRelativeTimestamp returns compact labels', () => {
    const now = new Date('2026-04-22T12:00:00.000Z');

    expect(formatRelativeTimestamp('2026-04-22T11:45:00.000Z', now)).toBe('15m');
    expect(formatRelativeTimestamp('2026-04-22T09:00:00.000Z', now)).toBe('3h');
    expect(formatRelativeTimestamp('2026-04-20T12:00:00.000Z', now)).toBe('2d');
  });
});
