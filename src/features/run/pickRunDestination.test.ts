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
});
