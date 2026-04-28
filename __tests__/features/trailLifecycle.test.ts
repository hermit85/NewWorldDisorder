import {
  getAvailableTrailActions,
  getTrailDisplayState,
} from '@/features/trails/trailLifecycle';

describe('trail lifecycle display contract', () => {
  test('draft/geometry-missing trails are rider-facing sketches', () => {
    const state = getTrailDisplayState({
      calibrationStatus: 'draft',
      geometryMissing: true,
    });

    expect(state.kind).toBe('sketch');
    expect(state.label).toBe('Szkic');
    expect(state.body).toContain('nie ma jeszcze nagranej linii');
  });

  test('fresh pending trails are new trails, not calibration chores', () => {
    const state = getTrailDisplayState({
      calibrationStatus: 'fresh_pending_second_run',
      geometryMissing: false,
    });
    const actions = getAvailableTrailActions({
      calibrationStatus: 'fresh_pending_second_run',
      geometryMissing: false,
    });

    expect(state.kind).toBe('new');
    expect(state.label).toBe('Nowa trasa');
    expect(actions.primary.label).toBe('Jedź rankingowo');
    expect(actions.primary.caption).toContain('pomóc potwierdzić trasę');
  });

  test('live fresh trails have an open league', () => {
    const state = getTrailDisplayState({ calibrationStatus: 'live_fresh' });

    expect(state.kind).toBe('league_open');
    expect(state.label).toBe('Liga otwarta');
    expect(state.cardStatus).toBe('open');
  });

  test('confirmed-like backend states collapse to one rider-facing state', () => {
    for (const calibrationStatus of ['live_confirmed', 'stable', 'verified']) {
      const state = getTrailDisplayState({ calibrationStatus });
      expect(state.kind).toBe('confirmed');
      expect(state.label).toBe('Potwierdzona');
    }
  });

  test('disputed or inactive trails require review', () => {
    expect(getTrailDisplayState({ calibrationStatus: 'verified', trustTier: 'disputed' }).kind)
      .toBe('needs_review');
    expect(getTrailDisplayState({ calibrationStatus: 'verified', isActive: false }).kind)
      .toBe('needs_review');
  });

  test('training-only trails expose only practice', () => {
    const actions = getAvailableTrailActions(
      { calibrationStatus: 'verified' },
      { isTrainingOnly: true },
    );

    expect(actions.rankedAvailable).toBe(false);
    expect(actions.primary.id).toBe('practice');
    expect(actions.secondary).toBeNull();
  });
});
