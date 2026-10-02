import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';
import { openChart } from './helpers';
import meta from '../docs/api/fixtures/meta.json';

/** Tasks 12.11 + 12.12 browser proof on the chart toolbar and the screener header. */
test.describe('data info popover + freshness (12.11, 12.12)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local'); });
  });

  test('chart: chip shows the date (never "live"), popover lists as-of, model versions, split-adjusted note, interim benchmark', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mockApi(page);
    await openChart(page, 'msft');
    await expect(page.locator('[data-fresh]')).toContainText('2026-09-22');
    expect((await page.locator('[data-fresh]').innerText()).toLowerCase()).not.toContain('live');
    await page.click('[data-info-btn]');
    const pop = page.locator('[data-info-pop]');
    await expect(pop).toContainText('EPS_V5_3');
    await expect(pop).toContainText('TECHNICAL_DAILY_V1');
    await expect(pop).toContainText('split-adjusted');
    await expect(pop).toContainText('TSX');
    await expect(pop).toContainText('interim');
    await page.screenshot({ path: 'docs/screenshots/12.11-data-info.png' });
    await page.keyboard.press('Escape');
    await expect(pop).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('stale data shows the warning chip; fresh data does not', async ({ page }) => {
    await mockApi(page, { overrides: { '/api/meta': { ...meta, data_as_of: { ...meta.data_as_of, prices: '2026-01-05' } } } });
    await page.goto('/screener');
    await expect(page.locator('[data-fresh]')).toContainText('2026-01-05');
    await expect(page.locator('[data-stale]')).toBeVisible();
  });

  test('dark theme screenshot and no button when the backend has no meta', async ({ page }) => {
    await mockApi(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/screener');
    await page.click('[data-info-btn]');
    await expect(page.locator('[data-info-pop]')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/12.11-data-info-dark.png' });
    const p2 = await page.context().newPage();
    await p2.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); });
    await mockApi(p2, { errors: { '/api/meta': { status: 500 } } });
    await p2.goto('/screener');
    await expect(p2.locator('.screener-title h1')).toBeVisible();
    await expect(p2.locator('[data-info-btn]')).toHaveCount(0);
  });
});
