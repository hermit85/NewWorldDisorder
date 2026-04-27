// ─────────────────────────────────────────────────────────────
// Tablica Phase 1 walk-test — 5 dev-mock screenshot scenarios.
// Run: npx playwright test e2e/tablica-walktest.spec.ts
// Output: walktest-screenshots/*.png
// ─────────────────────────────────────────────────────────────

import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.join(process.cwd(), 'walktest-screenshots');

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

const SCENARIOS = [
  { name: '01-tablica-stanA', path: '/leaderboard?dev=mockA' },
  { name: '02-tablica-stanB', path: '/leaderboard?dev=mockB' },
  { name: '03-ranking-user-5', path: '/trail/mock-tr-dzida/ranking?dev=mock5' },
  { name: '04-ranking-user-1', path: '/trail/mock-tr-dzida/ranking?dev=mock1' },
  { name: '05-ranking-user-14', path: '/trail/mock-tr-dzida/ranking?dev=mock14' },
];

test.describe.configure({ mode: 'serial' });

for (const scenario of SCENARIOS) {
  test(`walk-test ${scenario.name}`, async ({ page }) => {
    await page.goto(scenario.path);
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // Settle animations
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, `${scenario.name}.png`),
      fullPage: true,
    });
  });
}
