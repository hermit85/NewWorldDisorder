// ═══════════════════════════════════════════════════════════
// runIntent.test — lock down the B29 intent-immutability contract.
//
// WHY: B28 walk-test turned up a silent ranked→practice demotion
// bug. The product-owner decision was to make the run mode a pre-
// declared, immutable intent carried on the route: every entry
// point pins it at push-time, /run/active validates it, and
// useRealRun binds state.mode to it at mount with no setter.
//
// These tests cover the two rules that keep the invariant honest:
//
//   1. parseRunIntent accepts only 'ranked' | 'practice' — typos,
//      empty strings, objects, and undefined all become null so the
//      guard can fire a clean redirect.
//
//   2. decideIntentGuard redirects exactly two cases:
//        - intent === null (missing / invalid)
//        - intent === 'ranked' && isTrainingOnly (honest rejection
//          on a trail that can't host a ranked attempt)
//      Every other combination passes through with the parsed
//      intent — including practice on a training-only venue.
//
// If any of these loosens (e.g. a bug adds a "default to ranked on
// empty intent" fallback), at least one test below fails.
// ═══════════════════════════════════════════════════════════

import {
  parseRunIntent,
  decideIntentGuard,
  getIntentGuardMessage,
  resolveHookIntent,
} from './runIntent';

describe('parseRunIntent', () => {
  it('returns "ranked" for the ranked string', () => {
    expect(parseRunIntent('ranked')).toBe('ranked');
  });

  it('returns "practice" for the practice string', () => {
    expect(parseRunIntent('practice')).toBe('practice');
  });

  it('returns null for undefined', () => {
    expect(parseRunIntent(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRunIntent('')).toBeNull();
  });

  it('returns null for typos / partial matches', () => {
    expect(parseRunIntent('Ranked')).toBeNull();
    expect(parseRunIntent('rank')).toBeNull();
    expect(parseRunIntent('training')).toBeNull();
  });

  it('returns null for non-string inputs', () => {
    expect(parseRunIntent(null)).toBeNull();
    expect(parseRunIntent(0)).toBeNull();
    expect(parseRunIntent(true)).toBeNull();
    expect(parseRunIntent({ intent: 'ranked' })).toBeNull();
    expect(parseRunIntent(['ranked'])).toBeNull();
  });

  it('B29 invariant: there is no silent default — every falsy input is null', () => {
    // Future regression magnet: if someone adds a `?? 'practice'`
    // somewhere in the parser, this test's null expectation flips
    // and we know immediately.
    for (const v of [undefined, null, '', 'RANKED', 'ranked ', ' ranked', 'pract']) {
      expect(parseRunIntent(v)).toBeNull();
    }
  });
});

describe('decideIntentGuard', () => {
  it('redirects when intent is null (missing route param)', () => {
    const d = decideIntentGuard({ intent: null, isTrainingOnly: false });
    expect(d).toEqual({ action: 'redirect', reason: 'missing' });
  });

  it('redirects when intent=ranked on a training-only venue', () => {
    const d = decideIntentGuard({ intent: 'ranked', isTrainingOnly: true });
    expect(d).toEqual({ action: 'redirect', reason: 'training_only' });
  });

  it('passes ranked intent on a ranked-capable venue', () => {
    const d = decideIntentGuard({ intent: 'ranked', isTrainingOnly: false });
    expect(d).toEqual({ action: 'pass', intent: 'ranked' });
  });

  it('passes practice intent on a ranked-capable venue', () => {
    const d = decideIntentGuard({ intent: 'practice', isTrainingOnly: false });
    expect(d).toEqual({ action: 'pass', intent: 'practice' });
  });

  it('passes practice intent on a training-only venue (that is exactly the case this flow supports)', () => {
    const d = decideIntentGuard({ intent: 'practice', isTrainingOnly: true });
    expect(d).toEqual({ action: 'pass', intent: 'practice' });
  });

  it('B29 invariant: there is NO branch that turns ranked-on-training into a silent practice pass', () => {
    // The old pre-B29 logic auto-downgraded this to practice. The
    // product-owner kill switch says this must redirect, never
    // quietly arm practice.
    const d = decideIntentGuard({ intent: 'ranked', isTrainingOnly: true });
    expect(d.action).toBe('redirect');
    if (d.action === 'pass') {
      // Would only fire if the invariant regressed, kept for a
      // clearer TS narrowing + assertion target.
      expect(d.intent).not.toBe('practice');
    }
  });
});

describe('getIntentGuardMessage', () => {
  it('returns distinct copy for missing vs training_only', () => {
    const missing = getIntentGuardMessage('missing');
    const training = getIntentGuardMessage('training_only');
    expect(missing.title).toBeTruthy();
    expect(training.title).toBeTruthy();
    expect(missing.body).not.toEqual(training.body);
  });
});

describe('resolveHookIntent', () => {
  it('maps "ranked" through', () => {
    expect(resolveHookIntent('ranked')).toBe('ranked');
  });

  it('maps "practice" through', () => {
    expect(resolveHookIntent('practice')).toBe('practice');
  });

  it('maps null to practice as the safe mount default', () => {
    // The redirect effect fires on the same render cycle; the hook
    // only needs *some* valid RunMode to initialise makeInitialState.
    // Practice is safe because idle-phase has no side-effects and
    // the Alert blocks further interaction.
    expect(resolveHookIntent(null)).toBe('practice');
  });

  it('B29 invariant: null never resolves to ranked', () => {
    // If this ever flips, a bad deep-link would mount a ranked
    // useRealRun closure for one render — exactly the silent-arm
    // class of bug the refactor eliminated.
    expect(resolveHookIntent(null)).not.toBe('ranked');
  });
});
