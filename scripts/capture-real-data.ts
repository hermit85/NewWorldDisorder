// Re-capture broken-ID shots with real prod IDs from Supabase.
// First-pass script used dev/mock IDs that don't exist on prod.

import { chromium } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8089';
const OUT_DIR = path.join(os.homedir(), 'Desktop', 'nwd-screens');

const REAL_SPOT_ID = 'submitted-80031df8';      // Slotwiny Arena
const REAL_TRAIL_ID = 'pioneer-3eca51ab43';     // Prezydencka lap
const REAL_TRAIL_NAME = 'Prezydencka lap';

const SHOTS = [
  // Replace mock-id versions with real-id versions.
  {
    name: '03-spot-detail-real',
    path: `/spot/${REAL_SPOT_ID}`,
    caption: 'Detal bike parku · Slotwiny Arena (real prod data)',
  },
  {
    name: '06-trail-detail-real',
    path: `/trail/${REAL_TRAIL_ID}`,
    caption: 'Detal trasy · Prezydencka lap (real prod data)',
  },
  {
    name: '07-trail-ranking-real',
    path: `/trail/${REAL_TRAIL_ID}/ranking`,
    caption: 'Ranking trasy · Prezydencka lap (real, prawdopodobnie pusty)',
  },
  {
    name: '09-run-active-readiness-real',
    path: `/run/active?trailId=${REAL_TRAIL_ID}&trailName=${encodeURIComponent(REAL_TRAIL_NAME)}&intent=ranked`,
    caption: 'Run · readiness check przy real trasie (web nie ma GPS)',
  },
  // Bonus: real /trail/new from real spot — will probably auth-redirect
  // since unauthenticated, but capture anyway for the record.
  {
    name: '05-trail-new-step0-real',
    path: `/trail/new?spotId=${REAL_SPOT_ID}`,
    caption: 'Dodaj trasę · z poziomu real spot (auth-required)',
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 },
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  page.on('console', () => undefined);
  page.on('pageerror', () => undefined);

  for (const shot of SHOTS) {
    process.stdout.write(`· ${shot.name} — ${shot.path} ... `);
    try {
      await page.goto(`${BASE}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
      await page.waitForTimeout(1500); // a bit more for real-data fetch
      await page.screenshot({ path: path.join(OUT_DIR, `${shot.name}.png`), fullPage: true });
      process.stdout.write('OK\n');
    } catch (err: any) {
      process.stdout.write(`FAIL (${err?.message?.split('\n')[0]})\n`);
    }
  }

  await browser.close();
  console.log(`\nDone. Output: ${OUT_DIR}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
