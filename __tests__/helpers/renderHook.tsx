// ═══════════════════════════════════════════════════════════
// renderHook — small react-test-renderer helper.
//
// @testing-library/react-hooks is deprecated in React 18+ and we
// use plain react-test-renderer instead. This is a 30-line clone
// that exposes the parts we actually need: result.current, rerender,
// unmount, plus an async waitFor that polls a predicate within an
// `act` boundary so effect-driven state lands cleanly.
// ═══════════════════════════════════════════════════════════

import { createElement, type FC } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

export interface RenderHookResult<T> {
  result: { current: T };
  rerender: () => void;
  unmount: () => void;
}

export function renderHook<T>(hookFn: () => T): RenderHookResult<T> {
  const result: { current: T } = { current: undefined as unknown as T };
  const TestComponent: FC = () => {
    result.current = hookFn();
    return null;
  };

  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(TestComponent));
  });

  return {
    result,
    rerender: () => act(() => renderer.update(createElement(TestComponent))),
    unmount: () => act(() => renderer.unmount()),
  };
}

/**
 * Poll the predicate until it returns true or the timeout elapses.
 * Re-renders happen inside an `act` boundary so React's effect chain
 * runs without warnings. Useful for hooks that fire async fetches in
 * useEffect — wait for `result.current.status` to flip to 'ok'.
 */
export async function waitForHook(
  predicate: () => boolean,
  options: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1000;
  const intervalMs = options.intervalMs ?? 10;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Flush any pending microtasks under act so promise resolutions
    // schedule their setState calls before we evaluate the predicate.
    await act(async () => {
      await Promise.resolve();
    });
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`waitForHook timed out after ${timeoutMs}ms`);
}
