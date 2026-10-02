import { test, expect, Page } from '@playwright/test';

// The production bundle has no dev-only `window.__charts` handle: everything is asserted through DOM + pixels.
const errors = (page: Page) => {
  const e: string[] = [];
  page.on('pageerror', (x) => e.push(x.message));
  page.on('console', (m) => { if (m.type() === 'error') e.push(m.text()); });
  return e;
};

const pixels = (page: Page) => page.evaluate(() => {
  const c = document.querySelector('canvas') as HTMLCanvasElement;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  const colors = new Set<string>();
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; if (colors.size < 50) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
  return { n, colors: colors.size, w: c.clientWidth, h: c.clientHeight };
});

test('production bundle: login → navbar → chart → toolbar → indicators, console clean', async ({ page }) => {
  const errs = errors(page);
  await page.goto('/auth/login');
  await page.fill('#email', 'admin@demo.angular-project.local');
  await page.fill('#password', 'changeme');
  await page.click('button[type=submit]');
  await expect(page.locator('a.account-link')).toBeVisible();
  await page.screenshot({ path: 'docs/screenshots/8.3-prod-loggedin.png' });

  await page.click('.nav-links a:has-text("Charts")');
  await expect(page).toHaveURL(/\/charts\/msft$/);
  await expect(page.locator('.loading-overlay')).toHaveCount(0);
  const px = await pixels(page);
  expect(px.n).toBeGreaterThan(20_000);
  expect(px.colors).toBeGreaterThanOrEqual(3);
  const d = await page.evaluate(() => ({ v: document.documentElement.scrollHeight - innerHeight, h: document.documentElement.scrollWidth - innerWidth }));
  expect(d.v).toBeLessThanOrEqual(0);
  expect(d.h).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'docs/screenshots/8.3-prod-chart.png' });

  await page.fill('#symbol', 'nvda');
  await page.press('#symbol', 'Enter');
  await expect(page).toHaveURL(/\/charts\/nvda$/);
  await page.click('.range-btn:has-text("1Y")');

  await page.click('[data-indicators]');
  for (const t of ['sma', 'rsi']) await page.click(`[data-add-indicator="${t}"]`);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-indicator-row]')).toHaveCount(2);
  await page.waitForTimeout(500);
  const withInd = await pixels(page);
  expect(withInd.n).toBeGreaterThan(px.n * 0.5);
  await page.screenshot({ path: 'docs/screenshots/8.3-prod-indicators.png' });

  await page.goto('/charts/aapl'); // deep link + unknown symbol served via the SPA fallback
  await expect(page.locator('.error-card')).toContainText('AAPL');
  expect(errs.filter((e) => !/404|Failed to load resource/.test(e))).toEqual([]);
});

test('production bundle: other routes render (home, pricing, unknown → home)', async ({ page }) => {
  await page.goto('/pricing');
  await expect(page.locator('nav.navbar')).toBeVisible();
  await page.goto('/definitely-not-a-route');
  await expect(page).toHaveURL(/\/home$/);
});
