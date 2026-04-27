// ═══════════════════════════════════════════════════════════
// Sync Outbox — staleness + discard + retry-result plumbing.
//
// The TestFlight bug: 4 zjazdy stuck in queue, "Wyślij teraz"
// appeared to do nothing. Root cause: the flush function was
// returning a result, but the result never reached the UI; and
// stale runs that the server permanently rejected kept being
// retried forever, masking real errors.
//
// These tests pin the data-layer contract that the new card
// relies on:
//   1. recordSaveAttempt increments saveAttempts and records
//      a lastError on failure; clears lastError on success.
//   2. After MAX_AUTOMATIC_RETRIES failures, getRetryableRuns
//      stops returning the run (so the queue can't loop forever)
//      and getStaleRuns surfaces it instead.
//   3. discardFinalizedRun removes the row only after explicit
//      caller action — never silently.
// ═══════════════════════════════════════════════════════════

import { makeFinalizedRun } from '../factories';

async function loadStore() {
  return await import('@/systems/runStore');
}

describe('runStore — saveAttempts / lastError / stale split', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('records a failure: increments saveAttempts and stores lastError', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'r1', saveStatus: 'queued' }));
      store.recordSaveAttempt('r1', {
        success: false,
        error: { code: 'corridor_coverage_low', detail: 'too few points', at: 1 },
      });
      const run = store.getFinalizedRun('r1');
      expect(run?.saveAttempts).toBe(1);
      expect(run?.lastError?.code).toBe('corridor_coverage_low');
    });
  });

  it('records a success: clears lastError without touching saveAttempts', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'r2', saveStatus: 'queued' }));
      // Two failures first
      store.recordSaveAttempt('r2', {
        success: false,
        error: { code: 'rpc_null', at: 1 },
      });
      store.recordSaveAttempt('r2', {
        success: false,
        error: { code: 'rpc_null', at: 2 },
      });
      // Then a success
      store.recordSaveAttempt('r2', { success: true });
      const run = store.getFinalizedRun('r2');
      expect(run?.saveAttempts).toBe(2); // unchanged on success
      expect(run?.lastError).toBeNull();
    });
  });

  it('stops auto-retry after MAX_AUTOMATIC_RETRIES; surfaces in getStaleRuns', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'stale-1', saveStatus: 'queued' }));
      // Hit the cap
      for (let i = 0; i < store.MAX_AUTOMATIC_RETRIES; i++) {
        store.recordSaveAttempt('stale-1', {
          success: false,
          error: { code: 'corridor_coverage_low', at: i },
        });
      }
      expect(store.getRetryableRuns().map((r) => r.sessionId)).not.toContain('stale-1');
      expect(store.getStaleRuns().map((r) => r.sessionId)).toContain('stale-1');
      // Pending count for the Sync Outbox excludes stale; getStaleRunCount
      // tells the card how many to put in the discard section.
      expect(store.getPendingSaveCount()).toBe(0);
      expect(store.getStaleRunCount()).toBe(1);
    });
  });

  it('discardFinalizedRun removes the row only after explicit call', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'd1', saveStatus: 'queued' }));
      // Make it stale
      for (let i = 0; i < store.MAX_AUTOMATIC_RETRIES; i++) {
        store.recordSaveAttempt('d1', {
          success: false,
          error: { code: 'rpc_null', at: i },
        });
      }
      expect(store.getStaleRunCount()).toBe(1);
      // Stale run is still in the cache — never silent delete
      expect(store.getFinalizedRun('d1')).not.toBeUndefined();

      const removed = store.discardFinalizedRun('d1');
      expect(removed).toBe(true);
      expect(store.getFinalizedRun('d1')).toBeUndefined();
      expect(store.getStaleRunCount()).toBe(0);
    });
  });

  it('discardFinalizedRun returns false when sessionId unknown', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadStore();
      expect(store.discardFinalizedRun('nope')).toBe(false);
    });
  });
});
