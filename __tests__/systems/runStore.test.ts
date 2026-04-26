// ═══════════════════════════════════════════════════════════
// runStore — persistence + hydration + stuck-run recovery
//
// runStore holds module-level state (in-memory Map + hydration
// flag) and the AsyncStorage mock is also a module-level Map.
// jest.isolateModulesAsync rebuilds both — so seeding the mock
// has to happen INSIDE the isolated callback to share the
// module instance with the subject under test.
// ═══════════════════════════════════════════════════════════

import { makeFinalizedRun } from '../factories';

const STORAGE_KEY = '@nwd:finalized_runs';

async function seedStorage(value: unknown) {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

async function readStorage(): Promise<unknown> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function loadRunStore() {
  return await import('@/systems/runStore');
}

describe('runStore', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('hydrates from empty storage as a no-op', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadRunStore();
      await store.hydrateRunStore();
      expect(store.isRunStoreHydrated()).toBe(true);
      expect(store.getAllFinalizedRuns()).toEqual([]);
    });
  });

  it('hydrates persisted runs back into the cache', async () => {
    await jest.isolateModulesAsync(async () => {
      // Seed inside the isolated module graph so the AsyncStorage
      // singleton is shared with the runStore module being tested.
      await seedStorage([
        makeFinalizedRun({ sessionId: 'persisted-1', saveStatus: 'saved' }),
      ]);

      const store = await loadRunStore();
      await store.hydrateRunStore();

      expect(store.getFinalizedRun('persisted-1')).toMatchObject({
        sessionId: 'persisted-1',
        saveStatus: 'saved',
      });
      expect(store.getAllFinalizedRuns()).toHaveLength(1);
    });
  });

  it('recovers stuck saving runs by resetting them to queued on hydrate', async () => {
    await jest.isolateModulesAsync(async () => {
      await seedStorage([
        makeFinalizedRun({ sessionId: 'stuck-1', saveStatus: 'saving' }),
        makeFinalizedRun({ sessionId: 'pending-1', saveStatus: 'pending' }),
        makeFinalizedRun({ sessionId: 'ok-1', saveStatus: 'saved' }),
      ]);

      const store = await loadRunStore();
      await store.hydrateRunStore();

      // Stuck saving + pending → queued for retry
      expect(store.getFinalizedRun('stuck-1')?.saveStatus).toBe('queued');
      expect(store.getFinalizedRun('pending-1')?.saveStatus).toBe('queued');
      // Already saved untouched
      expect(store.getFinalizedRun('ok-1')?.saveStatus).toBe('saved');
    });
  });

  it('persists writes to AsyncStorage (debounced)', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadRunStore();
      await store.hydrateRunStore();

      const run = makeFinalizedRun({ sessionId: 'fresh-1' });
      store.setFinalizedRun(run);

      // Write is debounced; flush forces it to land on disk.
      await store.flushRunStorePersistence();

      const persisted = (await readStorage()) as { sessionId: string }[];
      expect(persisted).toHaveLength(1);
      expect(persisted[0].sessionId).toBe('fresh-1');
    });
  });

  it('removes a run by sessionId', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadRunStore();
      await store.hydrateRunStore();

      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'a' }));
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'b' }));
      expect(store.getAllFinalizedRuns()).toHaveLength(2);

      const removed = store.removeFinalizedRunBySession('a');
      expect(removed).toBe(true);
      expect(store.getFinalizedRun('a')).toBeUndefined();
      expect(store.getFinalizedRun('b')).toBeDefined();
    });
  });

  it('purges saved runs whose backend id is not in the live set', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadRunStore();
      await store.hydrateRunStore();

      // purgeOrphanedRuns only touches 'saved' rows (the contract
      // is "DB sync drift cleanup" — non-saved rows are still in
      // flight and untouched).
      store.setFinalizedRun(
        makeFinalizedRun({
          sessionId: 'live-run',
          saveStatus: 'saved',
          backendResult: { run: { id: 'live-uuid' } } as never,
        }),
      );
      store.setFinalizedRun(
        makeFinalizedRun({
          sessionId: 'stale-run',
          saveStatus: 'saved',
          backendResult: { run: { id: 'stale-uuid' } } as never,
        }),
      );

      const purgedCount = store.purgeOrphanedRuns(new Set(['live-uuid']));

      expect(purgedCount).toBe(1);
      expect(store.getFinalizedRun('live-run')).toBeDefined();
      expect(store.getFinalizedRun('stale-run')).toBeUndefined();
    });
  });

  it('leaves non-saved orphans untouched (purge only targets saved runs)', async () => {
    await jest.isolateModulesAsync(async () => {
      const store = await loadRunStore();
      await store.hydrateRunStore();

      store.setFinalizedRun(
        makeFinalizedRun({
          sessionId: 'pending-orphan',
          saveStatus: 'pending',
          backendResult: { run: { id: 'pending-uuid' } } as never,
        }),
      );
      store.setFinalizedRun(
        makeFinalizedRun({
          sessionId: 'queued-orphan',
          saveStatus: 'queued',
          backendResult: { run: { id: 'queued-uuid' } } as never,
        }),
      );

      const purgedCount = store.purgeOrphanedRuns(new Set([]));
      expect(purgedCount).toBe(0);
      expect(store.getFinalizedRun('pending-orphan')).toBeDefined();
      expect(store.getFinalizedRun('queued-orphan')).toBeDefined();
    });
  });
});
