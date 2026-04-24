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
  /** Parent spot id — threaded from the screen that starts the run so
   *  runSubmit does not need a DB lookup or stale DEFAULT_SPOT_ID fallback. */
  spotId: string;
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

function notifyChangeListeners(): void {
  _changeListeners.forEach((fn) => fn());
}

// ── Persistence helpers ──

/** Debounce window for persistToStorage. FAZA 2 #3: bursts of writes
 *  (e.g. final submit → update retryCount → update saveStatus, all
 *  within a few ms) used to each JSON-stringify up to 15 runs with
 *  their sampled GPS traces. Coalescing them into a single disk write
 *  cuts cold-storage work by ~3-5× on typical finalize/retry flows.
 *  Kept short (150ms) so a process crash still loses at most ~150ms of
 *  state — hydration already recovers stuck 'saving' runs anyway. */
const PERSIST_DEBOUNCE_MS = 150;
let _persistTimer: ReturnType<typeof setTimeout> | null = null;
let _persistInFlight: Promise<void> | null = null;

async function writeToStorage(): Promise<void> {
  try {
    const entries = Array.from(_runCache.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_STORED_RUNS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {
    console.warn('[NWD] runStore persist failed:', e);
  }
}

function persistToStorage(): void {
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    _persistTimer = null;
    _persistInFlight = writeToStorage().finally(() => {
      _persistInFlight = null;
    });
  }, PERSIST_DEBOUNCE_MS);
}

/** Force any pending debounced write to flush synchronously. Use before
 *  a hydration-style sequence where a prior write must be on disk before
 *  the next action (e.g. the 'saving' → 'queued' recovery path). */
export async function flushRunStorePersistence(): Promise<void> {
  if (_persistTimer) {
    clearTimeout(_persistTimer);
    _persistTimer = null;
    await writeToStorage();
  }
  if (_persistInFlight) await _persistInFlight;
}

/** Hydrate in-memory store from AsyncStorage. Call once at app start.
 *  Recovers runs stuck in 'saving' status (app was killed mid-save)
 *  by resetting them to 'queued' for automatic retry.
 */
export async function hydrateRunStore(): Promise<void> {
  if (_hydrationComplete) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const runs: FinalizedRun[] = JSON.parse(raw);
      let recoveredCount = 0;
      for (const run of runs) {
        // Recover stuck 'saving' runs — app was killed mid-submit
        if (run.saveStatus === 'saving' || run.saveStatus === 'pending') {
          run.saveStatus = 'queued';
          recoveredCount++;
        }
        _runCache.set(run.sessionId, run);
      }
      if (recoveredCount > 0) {
        console.log(`[NWD] Recovered ${recoveredCount} stuck runs → queued for retry`);
        persistToStorage(); // persist the status fix
      }
    }
    _hydrationComplete = true;
    notifyChangeListeners();
  } catch (e) {
    console.warn('[NWD] runStore hydrate failed:', e);
    _hydrationComplete = true; // don't retry forever
    notifyChangeListeners();
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
  notifyChangeListeners();
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
  notifyChangeListeners();
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

/**
 * Drop locally-cached runs whose DB row no longer exists (e.g. after
 * `delete_spot_cascade` purged the parent spot). Only considers runs
 * with `saveStatus === 'saved'` — anything still queued/failed/offline
 * is local-only and must survive because the server hasn't seen it yet.
 *
 * Caller is responsible for only invoking this with a trusted live-set
 * (i.e. the DB fetch that built it MUST have succeeded). Never purge on
 * a network error; an empty/stale set would wipe the user's history.
 */
export function purgeOrphanedRuns(liveDbRunIds: Set<string>): number {
  let removed = 0;
  for (const [sessionId, run] of _runCache.entries()) {
    if (run.saveStatus !== 'saved') continue;
    const dbId = run.backendResult?.run?.id;
    if (!dbId) continue;
    if (!liveDbRunIds.has(dbId)) {
      _runCache.delete(sessionId);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[NWD] purgeOrphanedRuns: removed ${removed} orphan run(s) from local cache`);
    notifyChangeListeners();
    persistToStorage();
  }
  return removed;
}

/** Drop a single run from the local cache after a successful
 *  server-side delete (see api.deleteRun). Identified by sessionId
 *  because that's how the UI tracks rows; the DB run id is stored
 *  on the backendResult and may or may not exist for local-only
 *  runs that never saved. Returns true if the entry existed. */
export function removeFinalizedRunBySession(sessionId: string): boolean {
  const existed = _runCache.delete(sessionId);
  if (existed) {
    notifyChangeListeners();
    persistToStorage();
  }
  return existed;
}

/** Drop the first local run whose backend id matches — used when
 *  delete_run was invoked from a surface that only has the DB run
 *  id (e.g. the result screen) and we want the activity list to
 *  refresh without a full cache purge. */
export function removeFinalizedRunByBackendId(backendRunId: string): boolean {
  for (const [sessionId, run] of _runCache.entries()) {
    if (run.backendResult?.run?.id === backendRunId) {
      _runCache.delete(sessionId);
      notifyChangeListeners();
      persistToStorage();
      return true;
    }
  }
  return false;
}

/** Subscribe to changes — returns unsubscribe function */
export function subscribeFinalizedRun(callback: () => void): () => void {
  _changeListeners.add(callback);
  return () => { _changeListeners.delete(callback); };
}
