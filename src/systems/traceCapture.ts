// ═══════════════════════════════════════════════════════════
// Trace Capture — records and stores GPS traces for runs
// Local-first persistence using AsyncStorage
// ═══════════════════════════════════════════════════════════

import { GpsPoint } from './gps';
import { RunMode, VerificationResult } from '@/data/verificationTypes';

export interface RunTrace {
  id: string;
  trailId: string;
  trailName: string;
  mode: RunMode;
  startedAt: number;
  finishedAt: number | null;
  durationMs: number;
  points: GpsPoint[];
  verification: VerificationResult | null;
  createdAt: number;
}

// ── In-memory trace buffer (active run) ──

let _activeTrace: RunTrace | null = null;

export function beginTrace(trailId: string, trailName: string, mode: RunMode): RunTrace {
  _activeTrace = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    trailId,
    trailName,
    mode,
    startedAt: Date.now(),
    finishedAt: null,
    durationMs: 0,
    points: [],
    verification: null,
    createdAt: Date.now(),
  };
  return _activeTrace;
}

export function addPoint(point: GpsPoint): void {
  if (_activeTrace) {
    _activeTrace.points.push(point);
  }
}

export function finishTrace(): RunTrace | null {
  if (!_activeTrace) return null;
  _activeTrace.finishedAt = Date.now();
  _activeTrace.durationMs = _activeTrace.finishedAt - _activeTrace.startedAt;
  const trace = { ..._activeTrace };
  return trace;
}

export function setTraceVerification(verification: VerificationResult): void {
  if (_activeTrace) {
    _activeTrace.verification = verification;
  }
}

export function getActiveTrace(): RunTrace | null {
  return _activeTrace;
}

export function clearActiveTrace(): void {
  _activeTrace = null;
}

// ── Local storage (completed runs) ──
// Using simple in-memory store for MVP — can swap to AsyncStorage later

const _completedRuns: RunTrace[] = [];

export function saveCompletedRun(trace: RunTrace): void {
  _completedRuns.unshift(trace); // newest first
  // Keep last 50 runs in memory
  if (_completedRuns.length > 50) _completedRuns.pop();
}

export function getCompletedRuns(): RunTrace[] {
  return _completedRuns;
}

export function getRunById(id: string): RunTrace | undefined {
  return _completedRuns.find((r) => r.id === id);
}
