// ═══════════════════════════════════════════════════════════
// Refresh system — app-wide data re-fetch after run saves
// Increment counter → all useRefreshSignal hooks re-render
// ═══════════════════════════════════════════════════════════

import { useEffect, useReducer, useRef } from 'react';

let _counter = 0;
const _subs = new Set<() => void>();

/** Call this after a run saves, achievement unlocks, etc. */
export function triggerRefresh() {
  _counter++;
  _subs.forEach((fn) => fn());
}

/** Returns a key that changes on every triggerRefresh() call.
 *  Use as a dependency in useEffect/useCallback to re-fetch. */
export function useRefreshSignal(): number {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const subRef = useRef(forceUpdate);
  subRef.current = forceUpdate;

  useEffect(() => {
    const handler = () => subRef.current();
    _subs.add(handler);
    return () => { _subs.delete(handler); };
  }, []);

  return _counter;
}
