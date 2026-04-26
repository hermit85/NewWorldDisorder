// ═══════════════════════════════════════════════════════════
// useUserRunCount — count of verified runs the rider has logged.
//
// Tablica Phase 1 detection logic: count === 0 → Stan B (fresh
// rider), count > 0 → Stan A (standard). Uses Supabase head:true
// + count:'exact' to avoid pulling row data — only the count is
// needed, payload stays minimal.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useRefreshSignal } from './useRefresh';

export type RunCountStatus = 'loading' | 'ok' | 'error' | 'signed_out';

export function useUserRunCount(userId: string | null | undefined) {
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<RunCountStatus>('loading');
  const refreshSignal = useRefreshSignal();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!userId) {
        setCount(null);
        setStatus('signed_out');
        return;
      }
      if (!isSupabaseConfigured || !supabase) {
        setCount(null);
        setStatus('error');
        return;
      }
      setStatus('loading');
      const { count: c, error } = await supabase
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (cancelled) return;
      if (error) {
        setCount(null);
        setStatus('error');
        return;
      }
      setCount(c ?? 0);
      setStatus('ok');
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshSignal]);

  return { count, status, isFresh: status === 'ok' && (count ?? 0) === 0 };
}
