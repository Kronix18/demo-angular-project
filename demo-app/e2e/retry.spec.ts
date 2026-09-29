import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

const stock = { company: { ticker: 'MSFT', name: 'Microsoft Corp Mock', sector: 'Technology', industry: 'Software', market_cap: 3e12, pe_ratio: 30, eps: 12, dividend_yield: 0.7, description: null, website: null }, prices: [{ date: '2026-09-22', open: 1, high: 2, low: 1, close: 1.5, volume: 10, adjusted_close: null }] };

/** Task 12.6 browser proof against GET /api/stocks/MSFT. */
test.describe('retry interceptor (12.6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local'); });
  });

  test('503 once then 200: page renders, no toast, exactly 2 requests', async ({ page }) => {
    let n = 0;
    await mockApi(page, { overrides: { '/api/stocks/MSFT': stock }, flaky: { '/api/stocks/MSFT': { status: 503, times: 1 } }, onRequest: (p) => { if (p.startsWith('/api/stocks/MSFT')) n++; } });
    await page.goto('/stock/MSFT');
    await expect(page.locator('body')).toContainText('Microsoft Corp Mock');
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
    expect(n).toBe(2);
  });

  test('429 with Retry-After: 3 attempts total, then exactly one toast', async ({ page }) => {
    let n = 0;
    await mockApi(page, { flaky: { '/api/stocks/MSFT': { status: 429, times: 99, headers: { 'Retry-After': '1' } } }, onRequest: (p) => { if (p.startsWith('/api/stocks/MSFT')) n++; } });
    await page.goto('/stock/MSFT');
    await expect(page.locator('[data-api-toast]')).toHaveCount(1, { timeout: 15_000 });
    expect(n).toBe(3);
  });
});
