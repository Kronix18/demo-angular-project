import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.7 browser proof: a 402 becomes an upgrade event, not an error toast. */
test('402 emits the upgrade event with feature + tier and shows no toast', async ({ page }) => {
  await page.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local'); });
  await mockApi(page, { errors: { '/api/screener/run': { status: 402, body: { error: 'upgrade_required', message: 'Needs pro', details: { required_tier: 'pro', feature: 'screener' } } } } });
  await page.goto('/screener');
  await expect.poll(() => page.evaluate(() => (window as any).__upgrade?.last()?.feature)).toBe('screener');
  expect(await page.evaluate(() => (window as any).__upgrade.last().requiredTier)).toBe('pro');
  await expect(page.locator('[data-api-toast]')).toHaveCount(0);
});
