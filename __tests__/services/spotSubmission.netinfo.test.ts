// ═══════════════════════════════════════════════════════════
// spotSubmission — NetInfo offline → online edge drains the queue.
// ═══════════════════════════════════════════════════════════

import { SUBMISSION_QUEUE_KEY } from '@/constants';

const mockSubmitSpot = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  submitSpot: (...args: unknown[]) => mockSubmitSpot(...args),
}));

async function loadSpotSubmission() {
  return await import('@/services/spotSubmission');
}

async function loadNetInfo() {
  const mod = await import('@react-native-community/netinfo');
  return mod.default as unknown as {
    __setState: (s: { isConnected: boolean | null }) => void;
    __reset: () => void;
  };
}

// Inside an isolateModulesAsync block — re-import AsyncStorage so it
// resolves to the same isolated mock instance the SUT imports.
async function seedQueue(items: Array<Record<string, unknown>>) {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(SUBMISSION_QUEUE_KEY, JSON.stringify(items));
}

async function clearStorage() {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.clear();
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('spotSubmission NetInfo wiring', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSubmitSpot.mockReset();
    mockSubmitSpot.mockResolvedValue({ ok: true, data: { spotId: 'srv-1' } });
  });

  it('does not re-drain on a redundant online tick', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();
      await clearStorage();
      await seedQueue([{ name: 'A', lat: 0, lng: 0, attemptedAt: 1 }]);

      const svc = await loadSpotSubmission();
      svc.initSubmissionQueue();
      await flushMicrotasks();

      // Init drained once.
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1);

      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1);
    });
  });

  it('drains again after offline → online edge', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();
      await clearStorage();
      await seedQueue([{ name: 'A', lat: 0, lng: 0, attemptedAt: 1 }]);

      const svc = await loadSpotSubmission();
      svc.initSubmissionQueue();
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1);

      // Re-seed — init drain emptied it. The point of this test is the
      // edge transition still triggers drainSubmissionQueue regardless of
      // whether anything is queued.
      await seedQueue([{ name: 'B', lat: 0, lng: 0, attemptedAt: 2 }]);

      netInfo.__setState({ isConnected: false });
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1); // offline alone — no drain

      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(2);
    });
  });

  it('treats isConnected=null as a no-op', async () => {
    await jest.isolateModulesAsync(async () => {
      const netInfo = await loadNetInfo();
      netInfo.__reset();
      await clearStorage();
      await seedQueue([{ name: 'A', lat: 0, lng: 0, attemptedAt: 1 }]);

      const svc = await loadSpotSubmission();
      svc.initSubmissionQueue();
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1);

      await seedQueue([{ name: 'B', lat: 0, lng: 0, attemptedAt: 2 }]);

      netInfo.__setState({ isConnected: null });
      await flushMicrotasks();
      netInfo.__setState({ isConnected: true });
      await flushMicrotasks();
      expect(mockSubmitSpot).toHaveBeenCalledTimes(1);
    });
  });
});
