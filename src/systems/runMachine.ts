import { RunPhase } from '@/data/types';
import { RunMode, RunPhaseV2, VerificationResult } from '@/data/verificationTypes';
import { useState, useCallback, useRef, useEffect } from 'react';

// ── State ──

export interface RunStateV2 {
  phase: RunPhaseV2;
  mode: RunMode;
  trailId: string;
  trailName: string;
  startedAt: number | null;
  elapsedMs: number;
  verification: VerificationResult | null;
  error: string | null;
}

// Keep old RunState for backward compat
export type RunState = RunStateV2;

// ── Transitions ──

const VALID_TRANSITIONS: Partial<Record<RunPhaseV2, RunPhaseV2[]>> = {
  idle: ['readiness_check'],
  readiness_check: ['armed_ranked', 'armed_practice', 'idle'],
  armed_ranked: ['countdown', 'running_ranked', 'idle'],
  armed_practice: ['countdown', 'running_practice', 'idle'],
  countdown: ['running_ranked', 'running_practice', 'idle'],
  running_ranked: ['finishing', 'error'],
  running_practice: ['finishing', 'error'],
  finishing: ['verifying'],
  verifying: ['completed_verified', 'completed_unverified', 'invalidated'],
  completed_verified: ['idle'],
  completed_unverified: ['idle'],
  invalidated: ['idle'],
  error: ['idle'],
};

export function createInitialRunState(trailId: string, trailName: string): RunStateV2 {
  return {
    phase: 'idle',
    mode: 'practice',
    trailId,
    trailName,
    startedAt: null,
    elapsedMs: 0,
    verification: null,
    error: null,
  };
}

export function canTransition(current: RunPhaseV2, next: RunPhaseV2): boolean {
  return VALID_TRANSITIONS[current]?.includes(next) ?? false;
}

export function transition(state: RunStateV2, next: RunPhaseV2, payload?: Partial<RunStateV2>): RunStateV2 {
  if (!canTransition(state.phase, next)) {
    return {
      ...state,
      phase: 'error',
      error: `Invalid transition: ${state.phase} → ${next}`,
    };
  }

  const base = { ...state, ...payload };

  switch (next) {
    case 'readiness_check':
      return { ...base, phase: 'readiness_check', error: null };

    case 'armed_ranked':
      return { ...base, phase: 'armed_ranked', mode: 'ranked', error: null };

    case 'armed_practice':
      return { ...base, phase: 'armed_practice', mode: 'practice', error: null };

    case 'countdown':
      return { ...base, phase: 'countdown' };

    case 'running_ranked':
      return { ...base, phase: 'running_ranked', mode: 'ranked', startedAt: Date.now(), elapsedMs: 0 };

    case 'running_practice':
      return { ...base, phase: 'running_practice', mode: 'practice', startedAt: Date.now(), elapsedMs: 0 };

    case 'finishing':
      return { ...base, phase: 'finishing', elapsedMs: base.startedAt ? Date.now() - base.startedAt : 0 };

    case 'verifying':
      return { ...base, phase: 'verifying', elapsedMs: base.startedAt ? Date.now() - base.startedAt : base.elapsedMs };

    case 'completed_verified':
      return { ...base, phase: 'completed_verified' };

    case 'completed_unverified':
      return { ...base, phase: 'completed_unverified' };

    case 'invalidated':
      return { ...base, phase: 'invalidated' };

    case 'idle':
      return createInitialRunState(state.trailId, state.trailName);

    case 'error':
      return { ...base, phase: 'error' };

    default:
      return state;
  }
}

// ── Helpers ──

export function isRunning(phase: RunPhaseV2): boolean {
  return phase === 'running_ranked' || phase === 'running_practice';
}

export function isArmed(phase: RunPhaseV2): boolean {
  return phase === 'armed_ranked' || phase === 'armed_practice';
}

export function isCompleted(phase: RunPhaseV2): boolean {
  return phase === 'completed_verified' || phase === 'completed_unverified' || phase === 'invalidated';
}

// ── Hook ──

export function useRunMachine(trailId: string, trailName: string) {
  const [state, setState] = useState<RunStateV2>(
    createInitialRunState(trailId, trailName)
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(
    (next: RunPhaseV2, payload?: Partial<RunStateV2>) => {
      setState((prev) => transition(prev, next, payload));
    },
    []
  );

  const reset = useCallback(() => {
    setState(createInitialRunState(trailId, trailName));
  }, [trailId, trailName]);

  // Timer tick while running
  useEffect(() => {
    if (isRunning(state.phase) && state.startedAt) {
      timerRef.current = setInterval(() => {
        setState((prev) => ({
          ...prev,
          elapsedMs: prev.startedAt ? Date.now() - prev.startedAt : 0,
        }));
      }, 50);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.phase, state.startedAt]);

  return { state, advance, reset };
}
