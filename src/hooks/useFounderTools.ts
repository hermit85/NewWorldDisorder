// ─────────────────────────────────────────────────────────────
// Founder tools hooks.
//
// useFounderStatus()      — boolean gate for "show menu entry".
// useTestDataPreview()    — counts shown above the RESET prompt.
// resetMyTestDataAction() — imperative wrapper used by the modal.
//
// All three RPCs are server-enforced: client-side hiding is just a
// UX nicety. Even if a non-founder somehow forced the menu open
// they'd hit a `forbidden` reply from the server.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import * as api from '@/lib/api';
import { useRefreshSignal } from './useRefresh';

export function useFounderStatus(userId: string | null | undefined) {
  const [isFounder, setIsFounder] = useState(false);
  const [loading, setLoading] = useState(false);
  const refreshSignal = useRefreshSignal();

  useEffect(() => {
    if (!userId) {
      setIsFounder(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.isFounderUser().then((flag) => {
      if (!cancelled) {
        setIsFounder(flag);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setIsFounder(false);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId, refreshSignal]);

  return { isFounder, loading };
}

export function useTestDataPreview(opts: {
  enabled: boolean;
  refreshKey?: number;
}) {
  const [preview, setPreview] = useState<api.TestDataPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!opts.enabled) {
      setPreview(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await api.previewTestDataReset();
    if (res.ok) {
      setPreview(res.data);
    } else {
      setPreview(null);
      setError(res.code);
    }
    setLoading(false);
  }, [opts.enabled]);

  useEffect(() => {
    refresh();
  }, [refresh, opts.refreshKey]);

  return { preview, loading, error, refresh };
}
