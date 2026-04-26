import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { drainSubmissionQueue, getQueuedSubmissionCount } from '@/services/spotSubmission';
import { flushSaveQueue, getSaveQueueStatus } from '@/systems/saveQueue';
import { subscribeFinalizedRun } from '@/systems/runStore';

export interface SyncOutboxState {
  pendingRuns: number;
  pendingSpots: number;
  isRetrying: boolean;
  lastRetryAt: number;
  refreshing: boolean;
}

const EMPTY_STATE: SyncOutboxState = {
  pendingRuns: 0,
  pendingSpots: 0,
  isRetrying: false,
  lastRetryAt: 0,
  refreshing: false,
};

export function useSyncOutbox() {
  const mountedRef = useRef(true);
  const [state, setState] = useState<SyncOutboxState>(EMPTY_STATE);

  const refresh = useCallback(async () => {
    const saveQueue = getSaveQueueStatus();
    const pendingSpots = await getQueuedSubmissionCount();
    if (!mountedRef.current) return;
    setState((current) => ({
      pendingRuns: saveQueue.pending,
      pendingSpots,
      isRetrying: saveQueue.isRetrying,
      lastRetryAt: saveQueue.lastRetryAt,
      refreshing: current.refreshing,
    }));
  }, []);

  const flush = useCallback(async () => {
    setState((current) => ({ ...current, refreshing: true }));
    await Promise.all([
      flushSaveQueue({ ignoreCooldown: true }),
      drainSubmissionQueue(),
    ]);
    await refresh();
    if (mountedRef.current) {
      setState((current) => ({ ...current, refreshing: false }));
    }
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const unsubscribeRuns = subscribeFinalizedRun(() => {
      void refresh();
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    const interval = setInterval(() => {
      void refresh();
    }, 5000);

    return () => {
      mountedRef.current = false;
      unsubscribeRuns();
      appStateSub.remove();
      clearInterval(interval);
    };
  }, [refresh]);

  return {
    state,
    totalPending: state.pendingRuns + state.pendingSpots,
    refresh,
    flush,
  };
}
