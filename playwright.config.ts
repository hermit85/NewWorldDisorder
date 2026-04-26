// ─────────────────────────────────────────────────────────────
// Playwright config — E2E against the Expo web preview.
//
// The Expo dev server is started separately (npm run web, port
// 8089). Playwright assumes it's already running so iteration
// loops stay fast — no per-test cold start.
//
// Reusable run modes:
//   npm run test:e2e       headless, CI-shaped
//   npm run test:e2e:ui    interactive UI mode (Playwright Inspector)
//   npm run test:e2e:codegen   record clicks → generate spec
// ─────────────────────────────────────────────────────────────

import { defineConfig, devices } from '@playwright/test';

const PREVIEW_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8089';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: PREVIEW_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
