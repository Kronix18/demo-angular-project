import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.10 browser proof: the directives follow /api/meta and /api/user/entitlements on the real /diagnostics page. */
test.describe('gating directives (12.10)', () => {
  test('datasets and features switch with the mock (pro tier)', async ({ page }) => {
    await mockApi(page, { datasets: ['prices', 'technicals'] });
    await page.goto('/diagnostics');
    await expect(page.locator('[data-ds="technicals"] .on')).toBeVisible();
    await expect(page.locator('[data-ds="patterns"] .off')).toHaveText('coming soon');
    await expect(page.locator('[data-ds="prices"] .on')).toContainText('2026-09-22');
    await expect(page.locator('[data-feat="patterns"] .on')).toHaveText('available');
    await expect(page.locator('[data-feat="backtest"] .off')).toHaveText('locked');
    await expect(page.locator('[data-tier]')).toHaveText('pro');
    await page.screenshot({ path: 'docs/screenshots/12.10-diagnostics.png' });
  });

  test('free tier locks every feature; empty datasets show coming soon everywhere', async ({ page }) => {
    await mockApi(page, { datasets: [], tier: 'free' });
    await page.goto('/diagnostics');
    await expect(page.locator('[data-tier]')).toHaveText('free');
    await expect(page.locator('[data-feat] .on')).toHaveCount(0);
    await expect(page.locator('[data-ds] .on')).toHaveCount(0);
    await expect(page.locator('[data-ds="prices"] .off')).toBeVisible();
  });

  test('backend down: everything locked / coming soon, no toast, page still renders', async ({ page }) => {
    await mockApi(page, { errors: { '/api/meta': { status: 500 }, '/api/user/entitlements': { status: 401, body: { error: 'unauthenticated', message: 'x' } } } });
    await page.goto('/diagnostics');
    await expect(page.locator('[data-ds="prices"] .off')).toBeVisible();
    await expect(page.locator('[data-feat="ratings"] .off')).toBeVisible();
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
  });
});
