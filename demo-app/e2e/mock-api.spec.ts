import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.2: the helper serves contract fixtures for /api/** with dataset and error toggles. */
test.describe('mockApi helper (12.2)', () => {
  const get = (page: import('@playwright/test').Page, path: string) =>
    page.evaluate(async (p) => {
      const r = await fetch(`http://192.168.1.111:3000${p}`);
      return { status: r.status, body: await r.json().catch(() => null) };
    }, path);

  test('serves /api/meta from the fixture and honours dataset toggles', async ({ page }) => {
    await mockApi(page, { datasets: ['prices'] });
    await page.goto('/');
    const r = await get(page, '/api/meta');
    expect(r.status).toBe(200);
    expect(r.body.datasets).toEqual(['prices']);
    expect(r.body.api_version).toBe(2);
  });

  test('serves chart meta, technicals, ratings, screener fields, entitlements', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    expect((await get(page, '/api/chart/MSFT/meta')).body.price_basis).toBe('split_adjusted');
    expect((await get(page, '/api/stocks/MSFT/technicals?format=columnar')).body.data.timestamp.length).toBeGreaterThan(3);
    expect((await get(page, '/api/stocks/MSFT/ratings')).body.rs_rating).toBeGreaterThan(0);
    expect((await get(page, '/api/screener/fields')).body.data.length).toBeGreaterThan(3);
    expect((await get(page, '/api/user/entitlements')).body.tier).toBe('pro');
  });

  test('error injection: 402, 429, 503 and unknown route 404', async ({ page }) => {
    await mockApi(page, { errors: { '/api/stocks/MSFT/patterns': { status: 402, body: { error: 'upgrade_required', message: 'x', details: { required_tier: 'pro', feature: 'patterns' } } }, '/api/quotes': { status: 429, headers: { 'Retry-After': '1' } }, '/api/market/state': { status: 503, body: { error: 'data_not_ready', message: 'x' } } } });
    await page.goto('/');
    expect((await get(page, '/api/stocks/MSFT/patterns')).status).toBe(402);
    expect((await get(page, '/api/quotes?symbols=MSFT')).status).toBe(429);
    expect((await get(page, '/api/market/state')).status).toBe(503);
    const unknown = await get(page, '/api/nope');
    expect(unknown.status).toBe(404);
    expect(unknown.body.error).toBe('not_found');
  });

  test('entitlement tier switch changes /api/user/entitlements', async ({ page }) => {
    await mockApi(page, { tier: 'free' });
    await page.goto('/');
    expect((await get(page, '/api/user/entitlements')).body.tier).toBe('free');
  });
});
