// ═══════════════════════════════════════════════════════════
// Debug Events — structured instrumentation for pre-test visibility
// Circular buffer of typed events. No external deps.
// Gated: only active when __DEV__ or TEST_MODE is on.
// ═══════════════════════════════════════════════════════════

export type DebugCategory =
  | 'venue'       // venue/start detection
  | 'gps'         // location/permission
  | 'run'         // run lifecycle
  | 'save'        // backend save
  | 'fetch'       // data reads
  | 'auth'        // session/auth
  | 'nav'         // navigation context
  | 'sim'         // simulation events
  | 'queue';      // offline save queue

export type DebugStatus = 'start' | 'ok' | 'fail' | 'skip' | 'info' | 'warn';

export interface DebugEvent {
  id: number;
  category: DebugCategory;
  name: string;
  status: DebugStatus;
  ts: number;
  sessionId?: string;
  runSessionId?: string;
  trailId?: string;
  venueId?: string;
  payload?: Record<string, any>;
}

// ── Module state ──

const MAX_EVENTS = 200;
let _events: DebugEvent[] = [];
let _nextId = 1;
let _enabled = __DEV__;
const _listeners = new Set<() => void>();

// ── Public API ──

export function setDebugEnabled(on: boolean): void {
  _enabled = on;
}

export function isDebugEnabled(): boolean {
  return _enabled;
}

export function logDebugEvent(
  category: DebugCategory,
  name: string,
  status: DebugStatus,
  meta?: {
    sessionId?: string;
    runSessionId?: string;
    trailId?: string;
    venueId?: string;
    payload?: Record<string, any>;
  },
): void {
  if (!_enabled) return;

  const event: DebugEvent = {
    id: _nextId++,
    category,
    name,
    status,
    ts: Date.now(),
    ...meta,
  };

  _events.push(event);

  // Circular buffer
  if (_events.length > MAX_EVENTS) {
    _events = _events.slice(-MAX_EVENTS);
  }

  // Also log to console in dev (structured, not spammy)
  if (__DEV__) {
    const tag = `[NWD:${category}]`;
    const statusIcon = status === 'ok' ? '✓' : status === 'fail' ? '✗' : status === 'start' ? '→' : status === 'warn' ? '!' : '·';
    console.log(`${tag} ${statusIcon} ${name}`, meta?.payload ?? '');
  }

  _listeners.forEach((fn) => fn());
}

export function getDebugEvents(): DebugEvent[] {
  return _events;
}

export function getDebugEventsByCategory(category: DebugCategory): DebugEvent[] {
  return _events.filter((e) => e.category === category);
}

export function getRecentEvents(count: number = 30): DebugEvent[] {
  return _events.slice(-count);
}

export function clearDebugEvents(): void {
  _events = [];
  _listeners.forEach((fn) => fn());
}

export function subscribeDebugEvents(cb: () => void): () => void {
  _listeners.add(cb);
  return () => { _listeners.delete(cb); };
}

// ── Summary helpers ──

export function getDebugSummary(): {
  total: number;
  errors: number;
  lastError: DebugEvent | null;
  byCategory: Record<string, number>;
} {
  let errors = 0;
  let lastError: DebugEvent | null = null;
  const byCategory: Record<string, number> = {};

  for (const e of _events) {
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    if (e.status === 'fail') {
      errors++;
      lastError = e;
    }
  }

  return { total: _events.length, errors, lastError, byCategory };
}
