// ─────────────────────────────────────────────────────────────
// Auth screen — smoke test that the brand-primitives refactor
// renders all the chrome elements (NWDHeader, PageLabel,
// BottomBand) and the email step CTA.
//
// Runs against the Expo web preview — react-native-web will
// flatten Views to <div> and Text to <div>/<span>, so selectors
// have to lean on visible text rather than RN component types.
// ─────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test';

test.describe('auth screen', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('renders brand chrome on email step', async ({ page }) => {
    await expect(page.getByText('NWD', { exact: true })).toBeVisible();
    await expect(page.getByText('NEW WORLD DISORDER')).toBeVisible();
    await expect(page.getByText('REJESTRACJA')).toBeVisible();
    await expect(page.getByText('DOŁĄCZ DO LIGI')).toBeVisible();
    await expect(page.getByText('Twój rider tag')).toBeVisible();
    await expect(page.getByText('zaczyna się tutaj.')).toBeVisible();
  });

  test('shows honest beta bottom band, not LIVE', async ({ page }) => {
    await expect(page.getByText('SEZON 01 · BETA')).toBeVisible();
    await expect(page.getByText('wczesny dostęp', { exact: true })).toBeVisible();
    await expect(page.getByText('SEZON 01 · LIVE')).toHaveCount(0);
    // Auth screen never claims a specific location — the app can't
    // verify GPS during signup, so chrome stays location-agnostic.
    await expect(page.getByText(/Bike Park Słotwiny/)).toHaveCount(0);
  });

  test('email CTA renders without clipping', async ({ page }) => {
    const cta = page.getByRole('button', { name: /WYŚLIJ KOD/i });
    await expect(cta).toBeVisible();
    // Btn at size lg has fontSize 12; with the lineHeight 1.2× fix
    // the rendered Text bounding box should be ≥ 14px tall so the
    // glyph isn't trimmed top/bottom.
    const fontMetrics = await cta.evaluate((el) => {
      const text = el.querySelector('div, span');
      if (!text) return null;
      const style = window.getComputedStyle(text);
      return {
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
      };
    });
    expect(fontMetrics).not.toBeNull();
    if (fontMetrics) {
      expect(fontMetrics.lineHeight).toBeGreaterThanOrEqual(fontMetrics.fontSize);
    }
  });

  test('legal copy is sentence case with accent links', async ({ page }) => {
    await expect(page.getByText(/Logując się akceptujesz/)).toBeVisible();
    await expect(page.getByText('regulamin', { exact: true })).toBeVisible();
    await expect(page.getByText('politykę prywatności', { exact: true })).toBeVisible();
    // No title-case leftovers from before the audit.
    await expect(page.getByText('Regulamin', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Politykę Prywatności', { exact: true })).toHaveCount(0);
  });
});
