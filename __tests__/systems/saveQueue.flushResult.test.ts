// ═══════════════════════════════════════════════════════════
// saveQueue.flushSaveQueue — return-shape contract.
//
// The Sync Outbox card now reads `flushSaveQueue()`'s return value
// to render success / partial / error / "nothing to do" feedback.
// Pre-fix the function returned only `{retried, succeeded}` and
// the result never reached the UI — tap "Wyślij teraz" looked
// silent. These tests pin:
//
//   - empty queue → `{skipped: true, skipReason: 'empty_queue'}`
//   - all succeed → `{retried, succeeded, failures: []}`
//   - some succeed → failures array carries the per-run error
//   - all fail → succeeded === 0 with full failures array
// ═══════════════════════════════════════════════════════════

import { makeFinalizedRun } from '../factories';

const mockRetry = jest.fn();
jest.mock('@/systems/retrySubmit', () => ({
  __esModule: true,
  retryRunSubmit: (...args: unknown[]) => mockRetry(...args),
}));

jest.mock('@/hooks/useBackend', () => ({
  __esModule: true,
  isBackendConfigured: () => true,
}));

async function loadSaveQueue() {
  return await import('@/systems/saveQueue');
}

async function loadRunStore() {
  return await import('@/systems/runStore');
}

describe('flushSaveQueue return shape', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRetry.mockReset();
  });

  it('reports skipped="empty_queue" when nothing is queued', async () => {
    await jest.isolateModulesAsync(async () => {
      const queue = await loadSaveQueue();
      const result = await queue.flushSaveQueue({ ignoreCooldown: true });
      expect(result.skipped).toBe(true);
      expect(result.skipReason).toBe('empty_queue');
      expect(result.retried).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failures).toEqual([]);
    });
  });

  it('returns succeeded === retried with empty failures when all succeed', async () => {
    await jest.isolateModulesAsync(async () => {
      mockRetry.mockResolvedValue({ success: true });
      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'a', saveStatus: 'queued' }));
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'b', saveStatus: 'queued' }));
      const queue = await loadSaveQueue();
      const result = await queue.flushSaveQueue({ ignoreCooldown: true });
      expect(result.skipped).toBe(false);
      expect(result.retried).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failures).toEqual([]);
    });
  });

  it('partial: returns failures array with errorCode + trailName for each failed run', async () => {
    await jest.isolateModulesAsync(async () => {
      mockRetry
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({
          success: false,
          errorCode: 'corridor_coverage_low',
          errorDetail: 'too few points',
        });
      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'a', saveStatus: 'queued', trailName: 'Prezydencka' }));
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'b', saveStatus: 'queued', trailName: 'Czarna' }));
      const queue = await loadSaveQueue();
      const result = await queue.flushSaveQueue({ ignoreCooldown: true });
      expect(result.retried).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0]).toMatchObject({
        errorCode: 'corridor_coverage_low',
        errorDetail: 'too few points',
      });
    });
  });

  it('all-fail: succeeded === 0 and failures carries every run', async () => {
    await jest.isolateModulesAsync(async () => {
      mockRetry.mockResolvedValue({
        success: false,
        errorCode: 'rpc_null',
      });
      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'a', saveStatus: 'queued' }));
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'b', saveStatus: 'queued' }));
      const queue = await loadSaveQueue();
      const result = await queue.flushSaveQueue({ ignoreCooldown: true });
      expect(result.succeeded).toBe(0);
      expect(result.failures).toHaveLength(2);
    });
  });
});
