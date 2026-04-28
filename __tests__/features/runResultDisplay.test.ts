import { getRunResultDisplayState } from '@/features/run/runResultDisplay';

describe('run result display contract', () => {
  test('ranked verified counted runs are leaderboard results', () => {
    const state = getRunResultDisplayState({
      mode: 'ranked',
      saveStatus: 'saved',
      verificationStatus: 'verified',
      countedInLeaderboard: true,
      rankPosition: 3,
    });

    expect(state.kind).toBe('leaderboard');
    expect(state.title).toBe('Wynik na tablicy');
    expect(state.body).toContain('lidze tej trasy');
  });

  test('practice runs never look like leaderboard results', () => {
    const state = getRunResultDisplayState({
      mode: 'practice',
      saveStatus: 'saved',
      verificationStatus: 'practice_only',
    });

    expect(state.kind).toBe('practice');
    expect(state.title).toBe('Zjazd treningowy');
    expect(state.reasonCode).toBe('training_mode');
  });

  test('ranked finish-gate failures explain that the ranking did not count', () => {
    const state = getRunResultDisplayState({
      mode: 'ranked',
      saveStatus: 'saved',
      verificationStatus: 'outside_finish_gate',
      leaderboardEligible: false,
    });

    expect(state.kind).toBe('ranked_not_counted');
    expect(state.title).toBe('Nie zaliczono rankingu');
    expect(state.reasonCode).toBe('missed_finish_gate');
  });

  test('offline and queued runs are local saves', () => {
    for (const saveStatus of ['offline', 'queued', 'failed']) {
      const state = getRunResultDisplayState({
        mode: 'ranked',
        saveStatus,
        verificationStatus: 'verified',
      });

      expect(state.kind).toBe('local');
      expect(state.title).toBe('Zapis lokalny');
      expect(state.reasonCode).toBe('saved_locally');
    }
  });

  test('pioneer result copy focuses on the saved line', () => {
    const state = getRunResultDisplayState({
      mode: 'ranked',
      saveStatus: 'saved',
      verificationStatus: 'verified',
      isPioneer: true,
    });

    expect(state.kind).toBe('pioneer_line');
    expect(state.title).toBe('Linia trasy zapisana');
  });
});
