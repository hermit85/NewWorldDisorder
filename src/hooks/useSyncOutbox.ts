import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import {
  drainSubmissionQueue,
  getQueuedSubmissionCount,
  getRejectedSubmissionCount,
} from '@/services/spotSubmission';
import {
  flushSaveQueue,
  getSaveQueueStatus,
  type FlushResult,
} from '@/systems/saveQueue';
import {
  discardFinalizedRun,
  getStaleRuns,
  subscribeFinalizedRun,
  type FinalizedRun,
} from '@/systems/runStore';
import { triggerRefresh } from './useRefresh';

export interface SyncOutboxState {
  pendingRuns: number;
  pendingSpots: number;
  rejectedSpots: number;
  staleRuns: FinalizedRun[];
  isRetrying: boolean;
  lastRetryAt: number;
  refreshing: boolean;
}

/** Visible feedback after the most recent flush. The card reads this
 *  to render success/partial/error/info instead of an invisible
 *  "did anything happen?" idle. */
export type SyncFeedback =
  | { kind: 'idle' }
  | { kind: 'syncing' }
  | { kind: 'success'; succeeded: number; total: number; at: number }
  | { kind: 'partial'; succeeded: number; total: number; failures: number; at: number }
  | { kind: 'error'; reason: string; at: number };

const EMPTY_STATE: SyncOutboxState = {
  pendingRuns: 0,
  pendingSpots: 0,
  rejectedSpots: 0,
  staleRuns: [],
  isRetrying: false,
  lastRetryAt: 0,
  refreshing: false,
};

const SKIP_REASON_COPY: Record<string, string> = {
  cooldown: 'Poczekaj chwilę i spróbuj ponownie.',
  already_retrying: 'Synchronizacja już trwa.',
  backend_unconfigured: 'Brak połączenia z serwerem.',
  empty_queue: 'Nic do wysłania.',
};

export function useSyncOutbox() {
  const mountedRef = useRef(true);
  const [state, setState] = useState<SyncOutboxState>(EMPTY_STATE);
  const [feedback, setFeedback] = useState<SyncFeedback>({ kind: 'idle' });

  const refresh = useCallback(async () => {
    const saveQueue = getSaveQueueStatus();
    const [pendingSpots, rejectedSpots] = await Promise.all([
      getQueuedSubmissionCount(),
      getRejectedSubmissionCount(),
    ]);
    if (!mountedRef.current) return;
    setState((current) => ({
      pendingRuns: saveQueue.pending,
      pendingSpots,
      rejectedSpots,
      staleRuns: getStaleRuns(),
      isRetrying: saveQueue.isRetrying,
      lastRetryAt: saveQueue.lastRetryAt,
      refreshing: current.refreshing,
    }));
  }, []);

  const flush = useCallback(async () => {
    setState((current) => ({ ...current, refreshing: true }));
    setFeedback({ kind: 'syncing' });

    const [runResult, spotResult] = await Promise.allSettled([
      flushSaveQueue({ ignoreCooldown: true }),
      drainSubmissionQueue(),
    ]);

    const runOutcome: FlushResult | null =
      runResult.status === 'fulfilled' ? runResult.value : null;
    const runRejection = runResult.status === 'rejected' ? String(runResult.reason) : null;

    await refresh();

    if (mountedRef.current) {
      setState((current) => ({ ...current, refreshing: false }));

      // Translate the saveQueue + spotSubmission outcomes into a
      // single feedback message the card can render.
      const at = Date.now();
      if (runRejection) {
        setFeedback({ kind: 'error', reason: `Wyjątek: ${runRejection}`, at });
      } else if (runOutcome?.skipped) {
        // No work could be done — surface the reason so the rider
        // doesn't think the button is broken.
        const reason = runOutcome.skipReason
          ? SKIP_REASON_COPY[runOutcome.skipReason] ?? `Pominięto: ${runOutcome.skipReason}`
          : 'Pominięto.';
        setFeedback({ kind: 'error', reason, at });
      } else if (runOutcome) {
        const total = runOutcome.retried;
        const succeeded = runOutcome.succeeded;
        const failures = runOutcome.failures.length;
        if (failures === 0) {
          setFeedback({ kind: 'success', succeeded, total, at });
        } else if (succeeded > 0) {
          setFeedback({ kind: 'partial', succeeded, total, failures, at });
        } else {
          // All failed — surface the first error code as the human reason.
          const firstReason = runOutcome.failures[0]?.errorCode ?? 'unknown';
          const detail = runOutcome.failures[0]?.errorDetail;
          setFeedback({
            kind: 'error',
            reason: detail ? `${firstReason}: ${detail}` : `Serwer odrzucił: ${firstReason}`,
            at,
          });
        }
      } else {
        setFeedback({ kind: 'idle' });
      }

      // Spot submission failures fall through silently for now —
      // they have their own retry surface (rejectedSpots count).
      if (spotResult.status === 'rejected' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[useSyncOutbox] spotSubmission drain rejected:', spotResult.reason);
      }

      // Push a global refresh so Home/Spoty/Tablica/JA re-pull data
      // after a successful sync (their own hooks subscribe to the
      // refresh signal). retryRunSubmit already fires this per-run,
      // but we re-fire here so a partial-success batch also nudges
      // every screen at the end of the flush.
      if (runOutcome && runOutcome.succeeded > 0) {
        triggerRefresh();
      }
    }
  }, [refresh]);

  /** User-confirmed discard of a stale local run. Removes the row
   *  from the local cache only — never from the server, since stale
   *  runs by definition never made it server-side. */
  const discardStale = useCallback((sessionId: string) => {
    discardFinalizedRun(sessionId);
    void refresh();
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
    feedback,
    totalPending: state.pendingRuns + state.pendingSpots,
    totalIssues: state.pendingRuns + state.pendingSpots + state.rejectedSpots + state.staleRuns.length,
    refresh,
    flush,
    discardStale,
  };
}
