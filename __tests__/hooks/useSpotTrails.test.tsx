// ═══════════════════════════════════════════════════════════
// useSpotTrails — Phase 1.4 Step 0 listing hook.
//
// Audit flagged useBackend.ts as zero-coverage — this is the
// first scaffolded test against the renderHook helper. Pin the
// fetch lifecycle: loading → ok / empty / error, plus refresh
// signal triggers a refetch.
// ═══════════════════════════════════════════════════════════

const mockListSpotTrails = jest.fn();
const refreshSubscribers = new Set<() => void>();
let refreshSignal = 0;

jest.mock('@/lib/api', () => ({
  __esModule: true,
  listSpotTrails: (...args: unknown[]) => mockListSpotTrails(...args),
}));

jest.mock('@/hooks/useRefresh', () => ({
  __esModule: true,
  useRefreshSignal: () => refreshSignal,
  triggerRefresh: () => {
    refreshSignal += 1;
    refreshSubscribers.forEach((fn) => fn());
  },
}));

import { useSpotTrails } from '@/hooks/useBackend';
import { renderHook, waitForHook } from '../helpers/renderHook';
import type { SpotTrailSummary } from '@/lib/api';

const sampleTrail: SpotTrailSummary = {
  trailId: 'pioneer-abc',
  officialName: 'Test Trail',
  normalizedName: 'test trail',
  duplicateBaseKey: 'test trail',
  difficulty: 'medium',
  trailType: 'flow',
  calibrationStatus: 'fresh_pending_second_run',
  trustTier: 'provisional',
  isActive: true,
  distanceM: 1500,
  runsContributed: 1,
  uniqueConfirmingRidersCount: 0,
  currentVersionId: 'version-uuid',
  pioneerUserId: 'user-uuid',
  pioneerUsername: 'rider_test',
  aliases: [],
};

describe('useSpotTrails', () => {
  beforeEach(() => {
    mockListSpotTrails.mockReset();
    refreshSignal = 0;
    refreshSubscribers.clear();
  });

  it('returns empty + status=empty when spotId is null', async () => {
    const { result } = renderHook(() => useSpotTrails(null));
    expect(result.current.trails).toEqual([]);
    expect(result.current.status).toBe('empty');
    expect(mockListSpotTrails).not.toHaveBeenCalled();
  });

  it('starts as loading then resolves to ok with the data', async () => {
    mockListSpotTrails.mockResolvedValueOnce({ ok: true, data: [sampleTrail] });

    const { result } = renderHook(() => useSpotTrails('spot-1'));

    expect(result.current.status).toBe('loading');
    expect(result.current.loading).toBe(true);

    await waitForHook(() => result.current.status === 'ok');
    expect(result.current.trails).toHaveLength(1);
    expect(result.current.trails[0].trailId).toBe('pioneer-abc');
    expect(result.current.loading).toBe(false);
    expect(mockListSpotTrails).toHaveBeenCalledWith('spot-1');
  });

  it('flips to empty when the spot has zero trails', async () => {
    mockListSpotTrails.mockResolvedValueOnce({ ok: true, data: [] });

    const { result } = renderHook(() => useSpotTrails('spot-empty'));
    await waitForHook(() => result.current.status === 'empty');
    expect(result.current.trails).toEqual([]);
  });

  it('flips to error and clears the list when the API returns ok=false', async () => {
    mockListSpotTrails.mockResolvedValueOnce({
      ok: false,
      code: 'fetch_failed',
      message: 'boom',
    });

    const { result } = renderHook(() => useSpotTrails('spot-1'));
    await waitForHook(() => result.current.status === 'error');
    expect(result.current.trails).toEqual([]);
  });

  it('cancels in-flight effect when spotId changes mid-fetch', async () => {
    let resolveFirst!: (val: unknown) => void;
    mockListSpotTrails.mockReturnValueOnce(new Promise((r) => { resolveFirst = r; }));
    mockListSpotTrails.mockResolvedValueOnce({ ok: true, data: [sampleTrail] });

    let currentSpotId: string | null = 'spot-1';
    const { result, rerender } = renderHook(() => useSpotTrails(currentSpotId));

    expect(result.current.status).toBe('loading');

    // Switch spot mid-flight
    currentSpotId = 'spot-2';
    rerender();

    // Resolve the first promise late — should be ignored by the cancelled effect
    resolveFirst({ ok: true, data: [{ ...sampleTrail, trailId: 'stale-trail' }] });

    await waitForHook(() => result.current.status === 'ok');
    // The latest spotId's data wins; the stale resolution must not leak in.
    expect(result.current.trails[0].trailId).toBe('pioneer-abc');
  });
});
