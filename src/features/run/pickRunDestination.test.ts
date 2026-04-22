// ═══════════════════════════════════════════════════════════
// pickRunDestination.test — lock down the routing decision that
// broke in Chunk 10.1.
//
// Before Chunk 10.2 both /spot/[id].tsx and /trail/new.tsx sent
// every trail (including draft Pioneer) to '/run/active', so
// freshly-created trails got stranded with no way to seed
// geometry. These tests exist so a future screen adding a
// "ride this trail" CTA cannot silently regress by bypassing
// the helper.
// ═══════════════════════════════════════════════════════════

import { pickRunDestination } from './pickRunDestination';
import { setDebugEnabled, logDebugEvent } from '@/systems/debugEvents';

const BASE = {
  trailId: 'trail-uuid',
  spotId: 'spot-uuid',
  trailName: 'Parkowa',
};

describe('pickRunDestination', () => {
  it('routes draft trails to /run/recording with trailId + spotId', () => {
    const href = pickRunDestination({ ...BASE, calibrationStatus: 'draft' });
    expect(href).toEqual({
      pathname: '/run/recording',
      params: { trailId: 'trail-uuid', spotId: 'spot-uuid' },
    });
  });

  it('treats explicit geometryMissing as draft even if status drifted', () => {
    // Defensive: if calibration_status somehow says 'calibrating' but
    // geometry row is null, we still must record — otherwise the gate
    // engine crashes on null geo.
    const href = pickRunDestination({
      ...BASE,
      calibrationStatus: 'calibrating',
      geometryMissing: true,
    });
    expect(href).toMatchObject({ pathname: '/run/recording' });
  });

  it('routes calibrating trails to /run/active (gate engine has geometry)', () => {
    const href = pickRunDestination({ ...BASE, calibrationStatus: 'calibrating' });
    expect(href).toEqual({
      pathname: '/run/active',
      params: { trailId: 'trail-uuid', trailName: 'Parkowa' },
    });
  });

  it('routes verified trails to /run/active', () => {
    const href = pickRunDestination({ ...BASE, calibrationStatus: 'verified' });
    expect(href).toMatchObject({ pathname: '/run/active' });
  });

  it('routes locked trails to /run/active (read-only ranking but the ride still works)', () => {
    const href = pickRunDestination({ ...BASE, calibrationStatus: 'locked' });
    expect(href).toMatchObject({ pathname: '/run/active' });
  });

  it('never emits pioneer=1 or trailName on the recording path', () => {
    // Chunk 10.1 regression: the educator flow emitted a dead
    // pioneer=1 param + trailName that recording.tsx never reads.
    const href = pickRunDestination({ ...BASE, calibrationStatus: 'draft' });
    expect(href).toEqual({
      pathname: '/run/recording',
      params: { trailId: 'trail-uuid', spotId: 'spot-uuid' },
    });
    const paramKeys = Object.keys((href as { params: Record<string, string> }).params);
    expect(paramKeys).not.toContain('pioneer');
    expect(paramKeys).not.toContain('trailName');
  });

  describe('unknown calibration_status guard (S1.1.2)', () => {
    // setDebugEnabled(true) because __DEV__ is false under jest's node
    // env, so logDebugEvent would otherwise early-return without ever
    // calling into its internals. Spying on the exported function
    // catches the call regardless of the gate.
    let spy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      setDebugEnabled(true);
      spy = jest.spyOn(
        require('@/systems/debugEvents'),
        'logDebugEvent',
      );
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      spy.mockRestore();
      warnSpy.mockRestore();
      setDebugEnabled(false);
    });

    it('falls back to /run/recording with recovery=1 param', () => {
      const href = pickRunDestination({
        ...BASE,
        calibrationStatus: 'future_status_xyz' as unknown as string,
      });

      expect(href).toEqual({
        pathname: '/run/recording',
        params: {
          trailId: 'trail-uuid',
          spotId: 'spot-uuid',
          trailName: 'Parkowa',
          recovery: '1',
        },
      });
    });

    it('emits a nav:pickRunDestination:unknown_status debug event with context', () => {
      pickRunDestination({
        ...BASE,
        calibrationStatus: 'future_status_xyz' as unknown as string,
      });

      expect(spy).toHaveBeenCalledWith(
        'nav',
        'pickRunDestination:unknown_status',
        'warn',
        expect.objectContaining({
          trailId: 'trail-uuid',
          payload: expect.objectContaining({
            received: 'future_status_xyz',
            spotId: 'spot-uuid',
          }),
        }),
      );
    });

    it('logs a console.warn mentioning the unknown status', () => {
      pickRunDestination({
        ...BASE,
        calibrationStatus: 'future_status_xyz' as unknown as string,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('future_status_xyz'),
      );
    });

    it('does not trip the guard on known statuses (draft/calibrating/verified/locked)', () => {
      for (const status of ['draft', 'calibrating', 'verified', 'locked']) {
        pickRunDestination({ ...BASE, calibrationStatus: status });
      }
      expect(spy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });
});

// Silence unused-import warning — we import logDebugEvent purely so
// the test file's type dependency stays honest even if jest.spyOn
// goes through require(). Keeping the named import also makes the
// dead import lint rule catch any future divergence.
void logDebugEvent;
