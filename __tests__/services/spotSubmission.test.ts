// ═══════════════════════════════════════════════════════════
// spotSubmission — offline queue + drain + hard-reject drop
//
// The submit_spot path has three classes of outcomes the queue
// must distinguish:
//   1. ok=true            → done, nothing queued
//   2. rpc_error + network message → queue, retry on AppState=active
//   3. typed reject (duplicate / validation / auth) → drop, do NOT
//      queue — server already passed judgement, looping is harmful
//
// These tests pin those three branches and the drain semantics
// (still-offline rows stay, hard-rejects drop, ok rows count toward
// `drained`).
// ═══════════════════════════════════════════════════════════

const mockSubmitSpot = jest.fn();

jest.mock('@/lib/api', () => ({
  __esModule: true,
  submitSpot: (...args: unknown[]) => mockSubmitSpot(...args),
}));

import {
  submitSpotWithQueue,
  drainSubmissionQueue,
  getQueuedSubmissionCount,
  getRejectedSubmissionCount,
} from '@/services/spotSubmission';
import { SUBMISSION_QUEUE_KEY, SUBMISSION_REJECTIONS_KEY } from '@/constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const baseParams = {
  name: 'Test Park',
  lat: 52.0,
  lng: 21.0,
  region: 'mazowieckie',
  description: 'Test description',
};

async function clearQueue() {
  await AsyncStorage.removeItem(SUBMISSION_QUEUE_KEY);
  await AsyncStorage.removeItem(SUBMISSION_REJECTIONS_KEY);
}

async function getQueueRaw(): Promise<unknown[]> {
  const raw = await AsyncStorage.getItem(SUBMISSION_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

describe('submitSpotWithQueue', () => {
  beforeEach(async () => {
    mockSubmitSpot.mockReset();
    await clearQueue();
  });

  it('returns ok with spotId on RPC success and does not queue', async () => {
    mockSubmitSpot.mockResolvedValueOnce({
      ok: true,
      data: { spotId: 'submitted-abc' },
    });

    const res = await submitSpotWithQueue(baseParams);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.spotId).toBe('submitted-abc');
      expect(res.queued).toBe(false);
    }
    expect(await getQueuedSubmissionCount()).toBe(0);
  });

  it('returns the typed rejection without queueing on hard reject (duplicate_nearby)', async () => {
    mockSubmitSpot.mockResolvedValueOnce({
      ok: false,
      code: 'duplicate_nearby',
      message: 'Inny spot 200m od ciebie',
      extra: { nearSpotId: 'submitted-other', distanceM: 200 },
    });

    const res = await submitSpotWithQueue(baseParams);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('duplicate_nearby');
      expect(res.extra?.nearSpotId).toBe('submitted-other');
    }
    expect(await getQueuedSubmissionCount()).toBe(0);
  });

  it('queues the submission on rpc_error with a network-flavoured message', async () => {
    mockSubmitSpot.mockResolvedValueOnce({
      ok: false,
      code: 'rpc_error',
      message: 'fetch failed',
    });

    const res = await submitSpotWithQueue(baseParams);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.spotId).toBeNull();
      expect(res.queued).toBe(true);
    }
    expect(await getQueuedSubmissionCount()).toBe(1);

    const queue = (await getQueueRaw()) as Array<typeof baseParams & { attemptedAt: number }>;
    expect(queue[0].name).toBe(baseParams.name);
    expect(queue[0].region).toBe('mazowieckie');
    expect(typeof queue[0].attemptedAt).toBe('number');
  });

  it('queues when the RPC throws (treats any throw as offline)', async () => {
    mockSubmitSpot.mockRejectedValueOnce(new Error('Network request failed'));

    const res = await submitSpotWithQueue(baseParams);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.queued).toBe(true);
    }
    expect(await getQueuedSubmissionCount()).toBe(1);
  });

  it('does NOT queue on rpc_error with a non-network message (e.g. 500)', async () => {
    mockSubmitSpot.mockResolvedValueOnce({
      ok: false,
      code: 'rpc_error',
      message: 'internal server error',
    });

    const res = await submitSpotWithQueue(baseParams);

    expect(res.ok).toBe(false);
    expect(await getQueuedSubmissionCount()).toBe(0);
  });
});

describe('drainSubmissionQueue', () => {
  beforeEach(async () => {
    mockSubmitSpot.mockReset();
    await clearQueue();
  });

  it('returns zero counts on empty queue', async () => {
    const result = await drainSubmissionQueue();
    expect(result).toEqual({ drained: 0, failed: 0 });
  });

  it('drains a queued spot when the next attempt succeeds', async () => {
    // Pre-seed queue with one offline submission.
    mockSubmitSpot.mockRejectedValueOnce(new Error('offline'));
    await submitSpotWithQueue({ ...baseParams, name: 'Queued Spot' });
    expect(await getQueuedSubmissionCount()).toBe(1);

    // Network back — drain succeeds.
    mockSubmitSpot.mockResolvedValueOnce({
      ok: true,
      data: { spotId: 'submitted-xyz' },
    });
    const result = await drainSubmissionQueue();

    expect(result).toEqual({ drained: 1, failed: 0 });
    expect(await getQueuedSubmissionCount()).toBe(0);
  });

  it('keeps the row queued when the retry is still a network error', async () => {
    mockSubmitSpot.mockRejectedValueOnce(new Error('offline'));
    await submitSpotWithQueue(baseParams);
    expect(await getQueuedSubmissionCount()).toBe(1);

    // Retry — still offline.
    mockSubmitSpot.mockResolvedValueOnce({
      ok: false,
      code: 'rpc_error',
      message: 'Failed to fetch',
    });
    const result = await drainSubmissionQueue();

    expect(result).toEqual({ drained: 0, failed: 1 });
    expect(await getQueuedSubmissionCount()).toBe(1);
  });

  it('drops the row when retry returns a hard rejection (drop, do not loop)', async () => {
    mockSubmitSpot.mockRejectedValueOnce(new Error('offline'));
    await submitSpotWithQueue(baseParams);
    expect(await getQueuedSubmissionCount()).toBe(1);

    // Server now says "duplicate" — drop the row to break the loop.
    mockSubmitSpot.mockResolvedValueOnce({
      ok: false,
      code: 'duplicate_nearby',
      message: 'Inny spot 200m od ciebie',
    });
    const result = await drainSubmissionQueue();

    expect(result).toEqual({ drained: 0, failed: 0 });
    expect(await getQueuedSubmissionCount()).toBe(0);
    expect(await getRejectedSubmissionCount()).toBe(1);
  });

  it('processes mixed outcomes in queue order (success, network-fail, hard-reject)', async () => {
    // Queue 3 offline submissions
    mockSubmitSpot.mockRejectedValueOnce(new Error('o1'));
    mockSubmitSpot.mockRejectedValueOnce(new Error('o2'));
    mockSubmitSpot.mockRejectedValueOnce(new Error('o3'));
    await submitSpotWithQueue({ ...baseParams, name: 'A' });
    await submitSpotWithQueue({ ...baseParams, name: 'B' });
    await submitSpotWithQueue({ ...baseParams, name: 'C' });
    expect(await getQueuedSubmissionCount()).toBe(3);

    // Drain — A succeeds, B still offline (stays), C duplicate (drops).
    mockSubmitSpot.mockResolvedValueOnce({ ok: true, data: { spotId: 'a-id' } });
    mockSubmitSpot.mockResolvedValueOnce({ ok: false, code: 'rpc_error', message: 'Failed to fetch' });
    mockSubmitSpot.mockResolvedValueOnce({ ok: false, code: 'duplicate_nearby', message: 'too close' });

    const result = await drainSubmissionQueue();

    expect(result).toEqual({ drained: 1, failed: 1 });
    const remaining = (await getQueueRaw()) as { name: string }[];
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('B');
    expect(await getRejectedSubmissionCount()).toBe(1);
  });
});
