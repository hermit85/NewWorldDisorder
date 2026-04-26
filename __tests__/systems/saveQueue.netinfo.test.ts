// ═══════════════════════════════════════════════════════════
// saveQueue — NetInfo offline → online edge triggers a flush.
//
// Each test rebuilds saveQueue + runStore via isolateModulesAsync so
// the module-level subscription state is fresh and the AsyncStorage
// mock map starts empty.
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

async function loadNetInfo() {
  const mod = await import('@react-native-community/netinfo');
  return mod.default as unknown as {
    __setState: (s: { isConnected: boolean | null }) => void;
    __reset: () => void;
  };
}

// Drains microtasks so the void flushSaveQueue() chain resolves before
// we assert on mock call counts.
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('saveQueue NetInfo wiring', () => {
  beforeEach(() => {
    jest.resetModules();
    mockRetry.mockReset();
    mockRetry.mockResolvedValue({ success: true });
  });

  it('does not flush again when NetInfo reports online without a prior offline edge', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();

      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'q-1', saveStatus: 'queued' }));

      const queue = await loadSaveQueue();
      queue.initSaveQueue();
      await flushMicrotasks();

      // initSaveQueue itself triggers one flush.
      expect(mockRetry).toHaveBeenCalledTimes(1);

      // A redundant online tick (no offline in between) must NOT flush again.
      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes after a confirmed offline → online transition', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();

      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'q-1', saveStatus: 'queued' }));

      const queue = await loadSaveQueue();
      queue.initSaveQueue();
      await flushMicrotasks();
      expect(mockRetry).toHaveBeenCalledTimes(1); // from init

      netInfo.__setState({ isConnected: false });
      await flushMicrotasks();
      // Going offline alone never retries.
      expect(mockRetry).toHaveBeenCalledTimes(1);

      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      // Reconnect drains the queue, bypassing the cooldown.
      expect(mockRetry).toHaveBeenCalledTimes(2);
    });
  });

  it('treats isConnected=null as a no-op', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();

      const store = await loadRunStore();
      store.setFinalizedRun(makeFinalizedRun({ sessionId: 'q-1', saveStatus: 'queued' }));

      const queue = await loadSaveQueue();
      queue.initSaveQueue();
      await flushMicrotasks();
      expect(mockRetry).toHaveBeenCalledTimes(1);

      // Unknown → online tick (e.g. NetInfo still resolving) shouldn't flip
      // the offline edge or trigger a retry.
      netInfo.__setState({ isConnected: null });
      await flushMicrotasks();
      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });
  });
});
