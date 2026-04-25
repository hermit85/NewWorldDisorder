// ═══════════════════════════════════════════════════════════
// runIntent — pure intent parsing + guard logic for /run/active
//
// Extracted from the route component so the "when do we redirect
// back to trail detail" decision can be unit-tested without a hook
// harness. Every call site that routes into /run/active now carries
// an `intent` param; this helper is the single source of truth for
// how that string is validated and how the guard fires.
//
// DESIGN: intent is immutable once /run/active mounts. The guard
// never tries to mutate it in-place — its only output is the
// *decision* (pass / redirect) and the resolved value for the hook
// mount window. See useRealRun.ts header for why immutability is
// the B29 product-owner contract.
// ═══════════════════════════════════════════════════════════

import type { RunMode } from '@/data/verificationTypes';

export type RunIntent = RunMode;

/**
 * Parse a route param (or any untrusted string) into a valid
 * RunIntent, or `null` if the input isn't one of the two accepted
 * values. Returns `null` for undefined / empty / typos so the
 * caller's guard can redirect instead of silently picking a default.
 */
export function parseRunIntent(raw: unknown): RunIntent | null {
  return raw === 'ranked' || raw === 'practice' ? raw : null;
}

export interface IntentGuardInput {
  /** Result of parseRunIntent — null means "route param was missing or typo'd". */
  intent: RunIntent | null;
  /** True when the trail's venue has `rankingEnabled=false` — always-training. */
  isTrainingOnly: boolean;
}

export type IntentGuardDecision =
  | { action: 'pass'; intent: RunIntent }
  | { action: 'redirect'; reason: 'missing' | 'training_only' };

/**
 * Decide whether the active-run screen can proceed with the rider's
 * declared intent, or whether it must bounce back to trail detail
 * with an explanation. The rules:
 *
 *   - `intent === null` → redirect (rider landed here without picking
 *     a mode, e.g. an old deep-link, a broken CTA, or a stale tab).
 *   - `intent === 'ranked'` on a training-only venue → redirect
 *     (the trail has no ranking config; honest UX is to explain and
 *     let rider pick Trening on the detail screen).
 *   - anything else → pass with the intent.
 *
 * Deliberately returns a decision object rather than firing the
 * redirect itself. The caller owns side-effects (Alert, router) so
 * this function stays pure and testable.
 */
export function decideIntentGuard(input: IntentGuardInput): IntentGuardDecision {
  if (input.intent === null) {
    return { action: 'redirect', reason: 'missing' };
  }
  if (input.intent === 'ranked' && input.isTrainingOnly) {
    return { action: 'redirect', reason: 'training_only' };
  }
  return { action: 'pass', intent: input.intent };
}

/**
 * Polish-language copy for the Alert the guard triggers. Kept here
 * next to the decision so tests catch a desync if the reasons list
 * ever grows.
 */
export function getIntentGuardMessage(reason: 'missing' | 'training_only'): {
  title: string;
  body: string;
} {
  if (reason === 'missing') {
    return {
      title: 'Wybierz tryb',
      body: 'Wybierz tryb zjazdu — Ranking albo Trening.',
    };
  }
  return {
    title: 'Wybierz tryb',
    body: 'Ta trasa jest treningowa. Ranking niedostępny.',
  };
}

/**
 * Resolve the intent value that `useRealRun` should mount with,
 * given the parsed intent. When the parse failed (intent=null) we
 * still need *some* RunMode to keep the hook mounting cleanly for
 * the one render cycle before the redirect effect replaces the
 * route — practice is the safe default there because the hook's
 * idle phase never fires ranked side-effects by itself. The arm
 * paths in active.tsx then do nothing because the Alert is modal.
 */
export function resolveHookIntent(intent: RunIntent | null): RunIntent {
  return intent === 'ranked' ? 'ranked' : 'practice';
}
