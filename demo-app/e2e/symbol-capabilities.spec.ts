import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';
import chartMeta from '../docs/api/fixtures/chart-meta-msft.json';

/** Task 12.9 browser proof at SERVICE level (UI consumers arrive with 12.10 / 13.x): the probe reaches the real HttpClient stack. */
test('capabilities for MSFT, a fresh IPO and a delisted symbol; unknown symbol degrades silently', async ({ page }) => {
  await mockApi(page, {
    overrides: {
      '/api/chart/NEWCO/meta': { ...chartMeta, security_id: 9, bar_count: 3, datasets: { technicals: false, rs_line: false } },
      '/api/chart/OLDCO/meta': { ...chartMeta, security_id: 10, delisted: true, last_bar: '2020-01-31' },
    },
    errors: { '/api/chart/NOPE/meta': { status: 404, body: { error: 'symbol_not_found', message: 'x' } } },
  });
  await page.goto('/home');
  const probe = (s: string) => page.evaluate(async (sym) => {
    const c = (window as any).__symbolCaps;
    const sig = c.load(sym);
    for (let i = 0; i < 100 && sig().status === 'loading'; i++) await new Promise((r) => setTimeout(r, 50));
    return { status: sig().status, technicals: c.supports(sym, 'technicals'), delisted: c.get(sym)?.delisted ?? null, w: c.hasInterval(sym, '1w') };
  }, s);
  expect(await probe('MSFT')).toEqual({ status: 'ready', technicals: true, delisted: false, w: true });
  expect(await probe('NEWCO')).toMatchObject({ status: 'ready', technicals: false });
  expect(await probe('OLDCO')).toMatchObject({ status: 'ready', delisted: true });
  expect(await probe('NOPE')).toEqual({ status: 'unavailable', technicals: false, delisted: null, w: false });
  await expect(page.locator('[data-api-toast]')).toHaveCount(0);
});
