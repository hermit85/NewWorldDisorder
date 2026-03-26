// ═══════════════════════════════════════════════════════════
// Run Store — single source of truth for finalized runs
// Written by useRealRun. Read by result screen.
// Lives in memory — survives navigation, not app restart.
// Capped at MAX_STORED_RUNS to prevent memory leaks.
// ═══════════════════════════════════════════════════════════

import { VerificationResult, RunMode } from '@/data/verificationTypes';
import { SubmitRunResult } from '@/lib/api';

export type SaveStatus = 'pending' | 'saving' | 'saved' | 'failed' | 'offline';

/** Minimal trace data kept for retry — not full GPS points array */
export interface TraceSnapshot {
  pointCount: number;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number;
  mode: RunMode;
  /** Every 3rd point for backend storage — same as initial submit */
  sampledPoints: { lat: number; lng: number; alt: number | null; ts: number }[];
}

export interface FinalizedRun {
  sessionId: string;
  trailId: string;
  trailName: string;
  mode: RunMode;
  durationMs: number;
  startedAt: number;
  verification: VerificationResult | null;
  saveStatus: SaveStatus;
  backendResult: SubmitRunResult | null;
  /** Snapshot of trace for retry — created at finalization time */
  traceSnapshot: TraceSnapshot | null;
  updatedAt: number;
}

// ── Module-level store ──

const MAX_STORED_RUNS = 10;
const _store = new Map<string, FinalizedRun>();
const _listeners = new Set<() => void>();

/** Generate a unique session ID for each run attempt */
export function createRunSessionId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Evict oldest runs if store exceeds limit */
function evictOldest(): void {
  if (_store.size <= MAX_STORED_RUNS) return;
  const sorted = Array.from(_store.entries())
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  while (_store.size > MAX_STORED_RUNS && sorted.length > 0) {
    const oldest = sorted.shift();
    if (oldest) _store.delete(oldest[0]);
  }
}

/** Write or update a finalized run */
export function setFinalizedRun(run: FinalizedRun): void {
  _store.set(run.sessionId, { ...run, updatedAt: Date.now() });
  evictOldest();
  _listeners.forEach((fn) => fn());
}

/** Update specific fields on an existing finalized run */
export function updateFinalizedRun(
  sessionId: string,
  patch: Partial<Pick<FinalizedRun, 'saveStatus' | 'backendResult'>>,
): boolean {
  const existing = _store.get(sessionId);
  if (!existing) {
    console.warn('[NWD] updateFinalizedRun: session not found:', sessionId);
    return false;
  }
  _store.set(sessionId, { ...existing, ...patch, updatedAt: Date.now() });
  _listeners.forEach((fn) => fn());
  return true;
}

/** Read a finalized run by session ID */
export function getFinalizedRun(sessionId: string): FinalizedRun | undefined {
  return _store.get(sessionId);
}

/** Subscribe to changes — returns unsubscribe function */
export function subscribeFinalizedRun(callback: () => void): () => void {
  _listeners.add(callback);
  return () => { _listeners.delete(callback); };
}
