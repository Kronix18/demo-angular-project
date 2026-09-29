import { test, expect, openChart, addIndicator, canvasPixels, collectErrors } from './helpers';

test.describe('chart panel (2.x–5.x)', () => {
  test('renders real pixels: one canvas, price + volume in one panel, candles + volume bars', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await expect(page.locator('canvas')).toHaveCount(1);
    const px = await canvasPixels(page);
    expect(px.n).toBeGreaterThan(20_000);
    expect(px.colors).toBeGreaterThanOrEqual(3);
    const s = await page.evaluate(() => {
      const c = (window as any).__charts.chart;
      return { yBottom: c.scales.y.bottom, volTop: c.scales.yVol.top, kinds: c.data.datasets.map((d: any) => d.type) };
    });
    expect(Math.abs(s.yBottom - s.volTop)).toBeLessThanOrEqual(1); // panes touch: one panel
    expect(s.kinds).toEqual(['candlestick', 'bar']);
    expect(errors).toEqual([]);
  });

  test('symbol change updates URL + chart; range buttons reframe the view', async ({ page }) => {
    await openChart(page, 'msft');
    await page.fill('#symbol', 'nvda');
    await page.press('#symbol', 'Enter');
    await expect(page).toHaveURL(/\/charts\/nvda$/);
    await page.waitForFunction(() => (window as any).__charts.chart.options.scales.y.paneLabel.startsWith('NVDA'));
    const span = () => page.evaluate(() => { const x = (window as any).__charts.chart.scales.x; return x.max - x.min; });
    await page.click('.range-btn:has-text("1M")');
    await expect.poll(span).toBeLessThan(40);
    await page.click('.range-btn:has-text("1Y")');
    await expect.poll(span).toBeGreaterThan(200);
  });

  test('weekly interval aggregates bars', async ({ page }) => {
    await openChart(page);
    const daily = await page.evaluate(() => (window as any).__charts.chart.scales.x.max);
    await page.selectOption('#interval', '1w');
    await page.waitForFunction((d) => (window as any).__charts.chart.scales.x.max < d / 3, daily);
  });

  test('indicators: overlay + stacked panes render, persist across refresh, validate input', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    // validation (5.3)
    await page.selectOption('select[name="indicatorType"]', 'sma');
    await page.fill('input[name="indicatorPeriod"]', '1');
    await page.click('[data-add]');
    await expect(page.locator('[data-error]')).toContainText(/2.*500/);
    await addIndicator(page, 'sma', 20);
    await page.click('[data-add]');
    await expect(page.locator('[data-error]')).toContainText(/already/i);
    await addIndicator(page, 'rsi', 14);
    await addIndicator(page, 'atr', 14);
    await expect(page.locator('[data-indicator-row]')).toHaveCount(3);
    const info = await page.evaluate(() => {
      const c = (window as any).__charts.chart;
      const rsi = c.data.datasets.filter((d: any) => d.yAxisID === 'yInd0');
      const vals = c.data.datasets.find((d: any) => d.label === 'RSI').data.filter((p: any) => p.y !== null).map((p: any) => p.y);
      return { labels: c.data.datasets.map((d: any) => d.label), rsiMin: Math.min(...vals), rsiMax: Math.max(...vals),
        top: c.scales.yInd0.top, height: c.scales.yInd0.height, guide: rsi.length };
    });
    expect(info.labels).toContain('SMA 20');
    expect(info.rsiMin).toBeGreaterThanOrEqual(0);
    expect(info.rsiMax).toBeLessThanOrEqual(100);
    expect(info.guide).toBe(3);
    const px = await canvasPixels(page, { top: info.top, height: info.height });
    expect(px.n).toBeGreaterThan(2000);
    await page.reload();
    await expect(page.locator('[data-indicator-row]')).toHaveCount(3);
    await page.waitForFunction(() => Object.keys((window as any).__charts.chart.scales).includes('yInd1'));
    for (let i = 0; i < 3; i++) await page.click('[data-remove]');
    await expect(page.locator('[data-indicator-row]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('zoom keeps working and y-axes refit to the visible bars', async ({ page }) => {
    await openChart(page);
    const before = await page.evaluate(() => { const y = (window as any).__charts.chart.scales.y; return y.max - y.min; });
    await page.click('.range-btn:has-text("ALL")');
    await page.waitForFunction((b) => { const y = (window as any).__charts.chart.scales.y; return y.max - y.min > b * 2; }, before);
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.9, box.y + box.height * 0.3);
    for (let i = 0; i < 25; i++) await page.mouse.wheel(0, -300);
    await page.waitForFunction(() => { const x = (window as any).__charts.chart.scales.x; return x.max - x.min < 800; });
  });
});
