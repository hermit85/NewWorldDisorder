// ═══════════════════════════════════════════════════════════
// Run Store — persisted source of truth for finalized runs
// Written by useRealRun. Read by result screen.
//
// v2: AsyncStorage persistence — survives app restart.
// In-memory Map is the hot cache. AsyncStorage is the cold store.
// Writes go to both. Reads from memory first, cold on miss.
// ═══════════════════════════════════════════════════════════

import AsyncStorage from '@react-native-async-storage/async-storage';
import { VerificationResult, RunMode } from '@/data/verificationTypes';
import { SubmitRunResult } from '@/lib/api';

export type SaveStatus = 'pending' | 'saving' | 'saved' | 'failed' | 'offline' | 'queued';

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
  /** User ID for offline retry — needed to resubmit to backend */
  userId: string | null;
  verification: VerificationResult | null;
  saveStatus: SaveStatus;
  backendResult: SubmitRunResult | null;
  /** Snapshot of trace for retry — created at finalization time */
  traceSnapshot: TraceSnapshot | null;
  /** Quality tier from gate engine */
  qualityTier: 'perfect' | 'valid' | 'rough' | null;
  updatedAt: number;
}

// ── Storage keys ──

const STORAGE_KEY = '@nwd:finalized_runs';
const MAX_STORED_RUNS = 15;

// ── In-memory hot cache ──
// _runCache: primary data store, keyed by sessionId. Writes go here + AsyncStorage.
// _changeListeners: UI subscribers notified on any write. Result screen & history use this.
// _hydrationComplete: prevents double-hydration from AsyncStorage on app start.

const _runCache = new Map<string, FinalizedRun>();
const _changeListeners = new Set<() => void>();
let _hydrationComplete = false;

// ── Persistence helpers ──

async function persistToStorage(): Promise<void> {
  try {
    const entries = Array.from(_runCache.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_STORED_RUNS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[NWD] runStore persist failed:', e);
  }
}

/** Hydrate in-memory store from AsyncStorage. Call once at app start. */
export async function hydrateRunStore(): Promise<void> {
  if (_hydrationComplete) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const runs: FinalizedRun[] = JSON.parse(raw);
      for (const run of runs) {
        _runCache.set(run.sessionId, run);
      }
    }
    _hydrationComplete = true;
  } catch (e) {
    console.warn('[NWD] runStore hydrate failed:', e);
    _hydrationComplete = true; // don't retry forever
  }
}

/** Check if store has been hydrated */
export function isRunStoreHydrated(): boolean {
  return _hydrationComplete;
}

// ── Public API (same interface as before + persistence) ──

/** Generate a unique session ID for each run attempt */
export function createRunSessionId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Evict oldest runs if store exceeds limit */
function evictOldest(): void {
  if (_runCache.size <= MAX_STORED_RUNS) return;
  const sorted = Array.from(_runCache.entries())
    .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  while (_runCache.size > MAX_STORED_RUNS && sorted.length > 0) {
    const oldest = sorted.shift();
    if (oldest) _runCache.delete(oldest[0]);
  }
}

/** Write or update a finalized run (persists to AsyncStorage) */
export function setFinalizedRun(run: FinalizedRun): void {
  _runCache.set(run.sessionId, { ...run, updatedAt: Date.now() });
  evictOldest();
  _changeListeners.forEach((fn) => fn());
  // Persist async — if app crashes before this completes, in-memory state
  // is lost but AsyncStorage has the previous version. Acceptable trade-off
  // for not blocking the UI thread on every run save.
  persistToStorage();
}

/** Update specific fields on an existing finalized run */
export function updateFinalizedRun(
  sessionId: string,
  patch: Partial<Pick<FinalizedRun, 'saveStatus' | 'backendResult' | 'qualityTier'>>,
): boolean {
  const existing = _runCache.get(sessionId);
  if (!existing) {
    console.warn('[NWD] updateFinalizedRun: session not found:', sessionId);
    return false;
  }
  _runCache.set(sessionId, { ...existing, ...patch, updatedAt: Date.now() });
  _changeListeners.forEach((fn) => fn());
  persistToStorage(); // async, non-blocking
  return true;
}

/** Read a finalized run by session ID */
export function getFinalizedRun(sessionId: string): FinalizedRun | undefined {
  return _runCache.get(sessionId);
}

/** Get all runs with a given save status */
export function getRunsByStatus(status: SaveStatus): FinalizedRun[] {
  return Array.from(_runCache.values()).filter((r) => r.saveStatus === status);
}

/** Get all finalized runs, newest first */
export function getAllFinalizedRuns(): FinalizedRun[] {
  return Array.from(_runCache.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Get count of runs pending save (queued + failed) */
export function getPendingSaveCount(): number {
  return Array.from(_runCache.values()).filter(
    (r) => r.saveStatus === 'queued' || r.saveStatus === 'failed'
  ).length;
}

/** Subscribe to changes — returns unsubscribe function */
export function subscribeFinalizedRun(callback: () => void): () => void {
  _changeListeners.add(callback);
  return () => { _changeListeners.delete(callback); };
}
