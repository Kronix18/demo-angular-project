import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';
import bars from '../docs/api/fixtures/ohlcv-msft.json';
import columnar from '../docs/api/fixtures/ohlcv-msft.columnar.json';

/** Task 13.1 browser proof at SERVICE level (wiring into the chart is 13.2): the client decodes both wire formats through the real HttpClient stack. */
test.describe('OhlcvApiClient (13.1)', () => {
  const run = (page: import('@playwright/test').Page, opts: object) =>
    page.evaluate((o) => new Promise<any>((res, rej) => (window as any).__ohlcvApi.get('msft', o).subscribe({ next: res, error: (e: any) => rej(e.status) })), opts);

  test('json and columnar responses give identical bars and the right query', async ({ page }) => {
    const urls: string[] = [];
    await mockApi(page, { onRequest: (p) => urls.push(p) });
    await page.goto('/home');
    const a = await run(page, { interval: '1w', limit: 500 });
    expect(a).toEqual(bars);
    expect(urls.find((u) => u.includes('/ohlcv'))).toBe('/api/chart/MSFT/ohlcv?interval=1w&limit=500');
    await page.unrouteAll();
    await mockApi(page, { overrides: { '/api/chart/MSFT/ohlcv': columnar }, onRequest: (p) => urls.push(p) });
    const b = await run(page, { format: 'columnar' });
    expect(b).toEqual(bars);
    expect(urls.at(-1)).toBe('/api/chart/MSFT/ohlcv?interval=1d&format=columnar');
  });

  test('empty history is [], 404 rejects with the status (no toast for 404)', async ({ page }) => {
    await mockApi(page, { overrides: { '/api/chart/MSFT/ohlcv': [] }, errors: { '/api/chart/NOPE/ohlcv': { status: 404, body: { error: 'symbol_not_found', message: 'x' } } } });
    await page.goto('/home');
    expect(await run(page, {})).toEqual([]);
    expect(await page.evaluate(() => new Promise((res) => (window as any).__ohlcvApi.get('nope').subscribe({ error: (e: any) => res(e.status) })))).toBe(404);
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
  });
});
