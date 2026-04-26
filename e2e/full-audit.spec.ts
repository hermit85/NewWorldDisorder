// ─────────────────────────────────────────────────────────────
// Full app audit — sweeps every reachable route on the Expo
// web preview, capturing console errors, network failures, and
// full-page screenshots. Used as a final pass before each build
// to surface regressions, hardcoded "live state" lies, and
// obvious layout problems.
//
// Generated artifacts:
//   audit-screenshots/<route>.png    full-page screenshot
//   test-results/                     traces + console for failures
//
// Each test is an independent route load; a failure on one
// doesn't abort the rest, so a single run produces a complete
// punch list rather than stopping at the first bug.
// ─────────────────────────────────────────────────────────────

import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'audit-screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

interface RouteSpec {
  path: string;
  name: string;
  /** Skip console-error assertion (route legitimately logs warnings). */
  allowConsoleErrors?: RegExp[];
}

const ROUTES: RouteSpec[] = [
  { path: '/', name: 'root' },
  { path: '/onboarding', name: 'onboarding' },
  { path: '/auth', name: 'auth' },
  { path: '/help', name: 'help' },
  { path: '/spots', name: 'tab-spots' },
  { path: '/leaderboard', name: 'tab-leaderboard' },
  { path: '/profile', name: 'tab-profile' },
  { path: '/settings/delete-account', name: 'settings-delete-account' },
  { path: '/spot/new', name: 'spot-new' },
  { path: '/spot/pending', name: 'spot-pending' },
  { path: '/spot/non-existent', name: 'spot-error-state' },
  { path: '/trail/new', name: 'trail-new' },
  { path: '/trail/non-existent', name: 'trail-error-state' },
  { path: '/run/active', name: 'run-active' },
  { path: '/run/recording', name: 'run-recording' },
  { path: '/run/rejected', name: 'run-rejected' },
  { path: '/run/result', name: 'run-result' },
  { path: '/run/review', name: 'run-review' },
  { path: '/admin/queue', name: 'admin-queue' },
];

// Strings that should never appear in chrome — pre-BETA-audit
// copy or hardcoded "live state" claims the app can't verify.
const FORBIDDEN_COPY: { pattern: RegExp; label: string }[] = [
  { pattern: /SEZON 01 · LIVE/, label: '"SEZON 01 · LIVE" — replace with BETA' },
  { pattern: /\b142 riderów\b/, label: 'hardcoded "142 riderów"' },
  { pattern: /Sezon 1 · Słotwiny/, label: 'old "Sezon 1 · Słotwiny" home pill' },
];

// Console noise that's expected on Expo web — filter from failures.
const CONSOLE_NOISE = [
  /Sentry.*DSN/i,
  /reanimated.*web/i,
  /Download the React DevTools/i,
  /useNativeDriver/i,
  /shadow.*not supported/i,
  /pointerEvents.*deprecated/i,
  /Image.*resizeMode.*style/i,
  // expo-router dev-only nav warning when deep-linking with no history.
  /GO_BACK.*was not handled/i,
];

// Page errors that are web-runtime-specific and don't affect native.
// Wake Lock is no longer here — we now Platform.OS-guard it in
// run/recording.tsx, so any future appearance is a real regression.
const PAGE_ERROR_NOISE: RegExp[] = [];

function setupCapture(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: { url: string; status: number }[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!CONSOLE_NOISE.some((rx) => rx.test(text))) {
        consoleErrors.push(text);
      }
    }
  });

  page.on('pageerror', (err) => {
    if (!PAGE_ERROR_NOISE.some((rx) => rx.test(err.message))) {
      pageErrors.push(err.message);
    }
  });

  page.on('response', (resp) => {
    if (resp.status() >= 400 && !resp.url().includes('favicon')) {
      failedRequests.push({ url: resp.url(), status: resp.status() });
    }
  });

  return { consoleErrors, pageErrors, failedRequests };
}

// Run serially — Expo dev server occasionally races on parallel
// route loads (HMR holds the worker thread, second request times
// out and the test sees a partial render). 19 routes × ~1.5s
// stays well under a minute, so the parallelism trade-off is worth
// the reliability for a pre-build smoke gate.
test.describe.configure({ mode: 'serial' });

for (const route of ROUTES) {
  test(`audit ${route.name} (${route.path})`, async ({ page }) => {
    const capture = setupCapture(page);

    let loadError: Error | null = null;
    try {
      await page.goto(route.path, { timeout: 15000 });
      // Wait for either networkidle or a generous fallback so
      // long-running animations don't trip the audit on routes
      // that are functionally rendered.
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } catch (err) {
      loadError = err as Error;
    }

    // Always attempt a screenshot, even on failure — useful for
    // diagnosing what the user actually sees.
    try {
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `${route.name}.png`),
        fullPage: true,
      });
    } catch {
      // Page might be in a state that can't screenshot; ignore.
    }

    // Body text snapshot for copy assertions.
    let bodyText = '';
    try {
      bodyText = await page.locator('body').innerText({ timeout: 3000 });
    } catch {
      // body never rendered.
    }

    const findings: string[] = [];

    if (loadError) {
      findings.push(`LOAD FAILED: ${loadError.message}`);
    }
    if (capture.pageErrors.length) {
      findings.push(`Page errors: ${capture.pageErrors.join(' | ')}`);
    }
    if (capture.consoleErrors.length) {
      findings.push(`Console errors: ${capture.consoleErrors.join(' | ')}`);
    }
    if (capture.failedRequests.length) {
      const summary = capture.failedRequests
        .map((r) => `${r.status} ${r.url}`)
        .join(' | ');
      findings.push(`Failed requests: ${summary}`);
    }
    for (const { pattern, label } of FORBIDDEN_COPY) {
      if (pattern.test(bodyText)) {
        findings.push(`Forbidden copy: ${label}`);
      }
    }
    if (!loadError && bodyText.trim().length === 0) {
      findings.push('Blank page (body has no rendered text)');
    }

    expect(findings, `\n${route.name} (${route.path}):\n  - ${findings.join('\n  - ')}`).toHaveLength(0);
  });
}
