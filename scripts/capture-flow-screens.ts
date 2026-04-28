// ─────────────────────────────────────────────────────────────
// capture-flow-screens — full-page screenshots of the core flow
// to ~/Desktop/nwd-screens/.
//
// Drives Expo web preview via Playwright. Web preview lacks native
// GPS / CoreLocation, so the run/active screen will mount in its
// readiness-check phase rather than progressing through a real
// ride — but you still get the chrome / readiness card / arming
// CTA in the screenshot.
//
// Usage:
//   1. npm run web -- --port 8089   (separate terminal, leave running)
//   2. npx ts-node scripts/capture-flow-screens.ts
// ─────────────────────────────────────────────────────────────

import { chromium, type Page, type Browser } from '@playwright/test';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:8089';
const OUT_DIR = path.join(os.homedir(), 'Desktop', 'nwd-screens');

interface Shot {
  /** File-friendly base name — number prefix for sort order. */
  name: string;
  /** Route path or full URL fragment. */
  path: string;
  /** Optional Polish-language description in caption file. */
  caption: string;
  /** Optional click sequence after page loads — for multi-step screens. */
  steps?: Array<{
    label: string;
    do: (page: Page) => Promise<void>;
    captureName: string;
  }>;
  /** Don't fail the whole run if this one errors. */
  optional?: boolean;
}

// Order matches the user's mental model: park lifecycle → trail lifecycle → run lifecycle.
const SHOTS: Shot[] = [
  // ── Bike park ────────────────────────────────────────────
  {
    name: '01-spots-list',
    path: '/spots',
    caption: 'Lista bike parków (zakładka SPOTY)',
  },
  {
    name: '02-spot-new-step1',
    path: '/spot/new',
    caption: 'Dodaj bike park · krok 1: nazwa + województwo',
  },
  {
    name: '03-spot-detail-active',
    path: '/spot/slotwiny-arena',
    caption: 'Detal bike parku · Słotwiny Arena (4 trasy)',
  },
  {
    name: '04-spot-pending-state',
    path: '/spot/pending',
    caption: 'Spot w stanie pending (po submit, przed approve)',
    optional: true,
  },

  // ── Trail ────────────────────────────────────────────────
  {
    name: '05-trail-new-step0',
    path: '/trail/new?spotId=slotwiny-arena',
    caption: 'Dodaj trasę · krok 0: lista istniejących tras + CTA',
  },
  {
    name: '06-trail-detail-mock',
    path: '/trail/mock-tr-dzida',
    caption: 'Detal trasy · Dzida (mock data — Slotwiny)',
    optional: true,
  },
  {
    name: '07-trail-ranking-mock5',
    path: '/trail/mock-tr-dzida/ranking?dev=mock5',
    caption: 'Ranking trasy · user na 5. miejscu (mock)',
    optional: true,
  },
  {
    name: '08-trail-ranking-mock1',
    path: '/trail/mock-tr-dzida/ranking?dev=mock1',
    caption: 'Ranking trasy · user na 1. miejscu (mock)',
    optional: true,
  },

  // ── Run flow ─────────────────────────────────────────────
  {
    name: '09-run-active-readiness',
    path: '/run/active?trailId=mock-tr-dzida&trailName=Dzida&intent=ranked',
    caption: 'Run · readiness check (przed startem; web nie ma GPS)',
    optional: true,
  },
  {
    name: '10-run-recording',
    path: '/run/recording',
    caption: 'Run · ekran nagrywania (placeholder bez GPS)',
    optional: true,
  },
  {
    name: '11-run-result',
    path: '/run/result',
    caption: 'Run · result screen (bez session id — empty state)',
    optional: true,
  },
  {
    name: '12-run-rejected',
    path: '/run/rejected',
    caption: 'Run · rejected screen',
    optional: true,
  },

  // ── Leaderboard / profile chrome ─────────────────────────
  {
    name: '13-tablica-mockA',
    path: '/leaderboard?dev=mockA',
    caption: 'Tablica · stan A (mock liga z danymi)',
  },
  {
    name: '14-tablica-mockB',
    path: '/leaderboard?dev=mockB',
    caption: 'Tablica · stan B (alternatywny mock)',
  },
  {
    name: '15-profile',
    path: '/profile',
    caption: 'JA · paszport ridera',
    optional: true,
  },
  {
    name: '16-settings',
    path: '/settings',
    caption: 'Ustawienia · pełny ekran',
    optional: true,
  },
  {
    name: '17-home-start',
    path: '/',
    caption: 'START · home screen (mission card + dziś na górze)',
    optional: true,
  },
  {
    name: '18-onboarding',
    path: '/onboarding',
    caption: 'Onboarding · 3 slajdy',
    optional: true,
  },
  {
    name: '19-auth',
    path: '/auth',
    caption: 'Auth · sign-in z email',
    optional: true,
  },
];

async function captureOne(page: Page, shot: Shot): Promise<{ ok: boolean; reason?: string }> {
  const url = `${BASE}${shot.path}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    // Settle: networkidle is unreliable on Expo dev; instead fixed
    // wait + best-effort wait for any text node.
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined);
    await page.waitForTimeout(700);

    const file = path.join(OUT_DIR, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, reason: err?.message ?? String(err) };
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser: Browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 896 }, // iPhone-ish portrait
    deviceScaleFactor: 2,
    isMobile: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();

  // Suppress noisy expo warnings on console — we just want screens.
  page.on('console', () => undefined);
  page.on('pageerror', () => undefined);

  const results: Array<{ name: string; ok: boolean; reason?: string }> = [];

  for (const shot of SHOTS) {
    process.stdout.write(`· ${shot.name} — ${shot.path} ... `);
    const res = await captureOne(page, shot);
    if (res.ok) {
      process.stdout.write('OK\n');
    } else if (shot.optional) {
      process.stdout.write(`SKIP (${res.reason?.split('\n')[0]})\n`);
    } else {
      process.stdout.write(`FAIL (${res.reason?.split('\n')[0]})\n`);
    }
    results.push({ name: shot.name, ok: res.ok, reason: res.reason });
  }

  // Caption manifest — drops a CSV next to the screenshots so you
  // can grep the human-readable label later.
  const captions = SHOTS
    .map((s) => `${s.name}.png\t${s.caption}\t${s.path}`)
    .join('\n');
  fs.writeFileSync(path.join(OUT_DIR, '00-captions.tsv'), `file\tcaption\tpath\n${captions}\n`, 'utf8');

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(`\nDone — ${ok}/${results.length} captured, ${fail} failed/skipped`);
  console.log(`Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
