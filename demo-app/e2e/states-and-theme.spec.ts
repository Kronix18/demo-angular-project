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

test.describe('theme tokens + dark mode', () => {
  const tokens = (page: import('@playwright/test').Page) => page.evaluate(() => {
    const c = (window as any).__charts.chart;
    const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return {
      up: c.data.datasets[0].backgroundColors.up, border: c.data.datasets[0].borderColors.down, cssDown: css('--c-down'), cssUp: css('--c-up'), grid: c.options.scales.x.grid.color, cssGrid: css('--c-grid'),
      rsi: c.data.datasets.find((d: any) => d.label === 'RSI').borderColor, cssViolet: css('--c-ind-violet'),
      bg: getComputedStyle(document.body).backgroundColor, panel: getComputedStyle(document.querySelector('.chart-panel')!).backgroundColor,
      theme: document.documentElement.getAttribute('data-theme'),
    };
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme}: chart colours come from the theme tokens`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await openChart(page);
      await addIndicator(page, 'rsi', 14);
      await page.waitForTimeout(300);
      const m = await tokens(page);
      expect(m.theme).toBe(theme);
      expect(m.up).toBe(m.cssUp);
      expect(m.up).not.toBe('');
      expect(m.border).toBe(m.cssDown); // candle colours really come from the tokens
      expect(m.grid).toBe(m.cssGrid);
      expect(m.rsi).toBe(m.cssViolet);
      expect(m.bg).toBe(theme === 'dark' ? 'rgb(19, 23, 34)' : 'rgb(248, 249, 250)');
      expect(m.panel).toBe(theme === 'dark' ? 'rgb(19, 23, 34)' : 'rgb(255, 255, 255)'); // TradingView #131722
    });
  }

  test('system mode follows the OS colour scheme (emulated) and live changes', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/home');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('navbar toggle cycles system → light → dark, persists across reload, and re-themes every page', async ({ page }) => {
    await page.goto('/pricing');
    const toggle = page.locator('.theme-toggle');
    await expect(toggle).toHaveAttribute('aria-label', /system/);
    await toggle.click();
    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    for (const url of ['/pricing', '/auth/login', '/home']) {
      await page.goto(url);
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(19, 23, 34)');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark'); // persisted, no flash back to light
    }
    // the pricing cards actually use dark surfaces (not hardcoded white)
    await page.goto('/pricing');
    await page.waitForSelector('[class*="plan"], [class*="card"]');
    const card = await page.evaluate(() => {
      const el = document.querySelector('[class*="plan"], [class*="card"]') as HTMLElement;
      return getComputedStyle(el).backgroundColor;
    });
    expect(card).not.toBe('rgb(255, 255, 255)');
  });
});
