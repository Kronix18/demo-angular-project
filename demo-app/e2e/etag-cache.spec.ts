import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.5 browser proof: revisiting a page revalidates with If-None-Match and renders the same data from the 304. */
test('second load of a stock page sends If-None-Match and gets 304; page renders identically', async ({ page }) => {
  const stock = { company: { ticker: 'MSFT', name: 'Microsoft Corp Mock', sector: 'Technology', industry: 'Software', market_cap: 3e12, pe_ratio: 30, eps: 12, dividend_yield: 0.7, description: null, website: null }, prices: [{ date: '2026-09-22', open: 1, high: 2, low: 1, close: 1.5, volume: 10, adjusted_close: null }] };
  const calls: { inm: string | null }[] = [];
  const statuses: number[] = [];
  await page.addInitScript(() => { sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local'); });
  await mockApi(page, { etag: true, overrides: { '/api/stocks/MSFT': stock } });
  page.on('request', (r) => { if (new URL(r.url()).pathname === '/api/stocks/MSFT') calls.push({ inm: r.headers()['if-none-match'] ?? null }); });
  page.on('response', (r) => { if (new URL(r.url()).pathname === '/api/stocks/MSFT') statuses.push(r.status()); });

  await page.goto('/stock/MSFT');
  await expect(page.locator('body')).toContainText('Microsoft Corp Mock');
  await page.click('.nav-links a >> text=Home');
  await expect(page).toHaveURL(/\/home$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/stock\/MSFT$/);
  await expect(page.locator('body')).toContainText('Microsoft Corp Mock');
  expect(calls.length).toBeGreaterThanOrEqual(2);
  expect(calls[0].inm).toBeNull();
  expect(calls[1].inm).toMatch(/^"[0-9a-f]{32}"$/);
  expect(statuses).toContain(304);
});
