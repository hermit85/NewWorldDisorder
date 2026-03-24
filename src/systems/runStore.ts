// ═══════════════════════════════════════════════════════════
// Run Store — single source of truth for finalized runs
// Written by useRealRun. Read by result screen.
// Lives in memory — survives navigation, not app restart.
// ═══════════════════════════════════════════════════════════

import { VerificationResult, RunMode } from '@/data/verificationTypes';
import { SubmitRunResult } from '@/lib/api';

export type SaveStatus = 'pending' | 'saving' | 'saved' | 'failed' | 'offline';

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
  updatedAt: number; // timestamp of last mutation
}

// ── Module-level store ──

const _store = new Map<string, FinalizedRun>();
const _listeners = new Set<() => void>();

/** Generate a unique session ID for each run attempt */
export function createRunSessionId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Write or update a finalized run */
export function setFinalizedRun(run: FinalizedRun): void {
  _store.set(run.sessionId, { ...run, updatedAt: Date.now() });
  _listeners.forEach((fn) => fn());
}

/** Update specific fields on an existing finalized run */
export function updateFinalizedRun(
  sessionId: string,
  patch: Partial<Pick<FinalizedRun, 'saveStatus' | 'backendResult'>>,
): void {
  const existing = _store.get(sessionId);
  if (!existing) return;
  _store.set(sessionId, { ...existing, ...patch, updatedAt: Date.now() });
  _listeners.forEach((fn) => fn());
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
