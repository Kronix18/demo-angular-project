import { test, expect, openChart, addIndicator, collectErrors } from './helpers';

test.describe('navigation + loading/error states (6.1, 6.3)', () => {
  test('navbar Charts link, active styling, deep link, last-symbol memory', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('.nav-links a.active')).toHaveText('Home');
    await page.click('.nav-links a:has-text("Charts")');
    await expect(page).toHaveURL(/\/charts\/msft$/);
    await expect(page.locator('.nav-links a.active')).toHaveText('Charts');
    await openChart(page, 'qqq');
    await page.click('.nav-links a:has-text("Pricing")');
    await page.click('.nav-links a:has-text("Charts")');
    await expect(page).toHaveURL(/\/charts\/qqq$/);
  });

  test('unknown symbol: card lists symbols, picker recovers, toolbar follows the route', async ({ page }) => {
    await page.goto('/charts/aapl');
    const card = page.locator('.error-card');
    await expect(card).toContainText('AAPL');
    for (const s of ['msft', 'nvda', 'qqq']) await expect(card).toContainText(s);
    await expect(page.locator('#symbol')).toHaveValue('aapl');
    await expect(page.locator('canvas')).toBeHidden();
    await page.click('[data-symbol="nvda"]');
    await expect(card).toHaveCount(0);
    await page.waitForFunction(() => (window as any).__charts?.chart?.options.scales.y.paneLabel.startsWith('NVDA'));
  });

  test('network failure → skeleton → error card → Retry recovers', async ({ page }) => {
    const errors = collectErrors(page, /Failed to load|404|ERR_FAILED/);
    await page.route('**/test-data/msft.us.txt', async (r) => { await new Promise((res) => setTimeout(res, 800)); await r.abort(); });
    await page.goto('/charts/msft');
    await expect(page.locator('.skeleton')).toBeVisible();
    await expect(page.locator('.error-card')).toBeVisible();
    await expect(page.locator('.skeleton')).toHaveCount(0);
    await page.unroute('**/test-data/msft.us.txt');
    await page.click('[data-retry]');
    await expect(page.locator('.error-card')).toHaveCount(0);
    await page.waitForFunction(() => (window as any).__charts?.chart);
    expect(errors).toEqual([]);
  });
});

test.describe('theme tokens (6.2)', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: chart colours come from the theme tokens`, async ({ page }) => {
      if (theme === 'dark') await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', 'dark')));
      await openChart(page);
      await addIndicator(page, 'rsi', 14);
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const c = (window as any).__charts.chart;
        const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
        return {
          up: c.data.datasets[0].color.up, cssUp: css('--c-up'), grid: c.options.scales.x.grid.color, cssGrid: css('--c-grid'),
          rsi: c.data.datasets.find((d: any) => d.label === 'RSI').borderColor, cssViolet: css('--c-ind-violet'),
          bg: getComputedStyle(document.body).backgroundColor,
        };
      });
      expect(m.up).toBe(m.cssUp);
      expect(m.up).not.toBe('');
      expect(m.grid).toBe(m.cssGrid);
      expect(m.rsi).toBe(m.cssViolet);
      expect(m.bg).toBe(theme === 'dark' ? 'rgb(15, 23, 42)' : 'rgb(248, 249, 250)');
    });
  }
});
