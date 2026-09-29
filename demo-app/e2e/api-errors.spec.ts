import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.3 browser proof: the screener's POST /api/screener/run is forced to fail. */
test.describe('API error toast (12.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local'); });
  });

  test('a 500 shows exactly one toast, dismissible; console has no uncaught errors', async ({ page }) => {
    const uncaught: string[] = [];
    page.on('pageerror', (e) => uncaught.push(e.message));
    await mockApi(page, { errors: { '/api/screener/run': { status: 500, body: { error: 'server_error', message: 'Screener is down' } } } });
    await page.goto('/screener');
    await expect(page.locator('[data-api-toast]')).toHaveCount(1);
    await expect(page.locator('[data-api-toast]')).toContainText('Screener is down');
    await page.click('[data-api-toast-close]');
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
    expect(uncaught).toEqual([]);
  });

  test('a 402 never toasts (paywall is handled elsewhere)', async ({ page }) => {
    await mockApi(page, { errors: { '/api/screener/run': { status: 402, body: { error: 'upgrade_required', message: 'Needs pro', details: { required_tier: 'pro', feature: 'screener' } } } } });
    await page.goto('/screener');
    await page.waitForTimeout(800);
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
  });
});
