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

  test('legend (10.2): OHLC follows the hovered bar, indicator rows show live values, eye hides the series, ✕ removes', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await addIndicator(page, 'sma', 20);
    await addIndicator(page, 'rsi', 14);
    const header = page.locator('[data-legend-header]');
    await expect(header).toContainText('MSFT');
    const lastClose = await page.evaluate(() => (window as any).__charts.chart.data.datasets[0].data.at(-1).c.toFixed(2));
    await expect(header).toContainText(lastClose); // no hover: latest bar
    // hover a bar in the middle of the price pane -> the header changes to that bar's values
    const box = (await page.locator('canvas').boundingBox())!;
    const before = await header.textContent();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3);
    await expect.poll(async () => header.textContent()).not.toBe(before);
    const hovered = await page.evaluate(() => {
      const c = (window as any).__charts.chart;
      const v = Math.round(c.scales.x.getValueForPixel(c.canvas.getBoundingClientRect().width * 0.4));
      return v;
    });
    expect(hovered).toBeGreaterThan(0);
    // indicator rows: chip + value at that bar; RSI row sits inside its own pane
    const rows = page.locator('[data-indicator-row]');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('SMA 20');
    await expect(rows.nth(1)).toContainText(/RSI 14\s*\d/);
    const geo = await page.evaluate(() => {
      const c = (window as any).__charts.chart;
      const row = document.querySelectorAll('[data-indicator-row]')[1].getBoundingClientRect();
      const panel = document.querySelector('.chart-panel')!.getBoundingClientRect();
      return { rowTop: row.top - panel.top, paneTop: c.scales.yInd0.top, paneBottom: c.scales.yInd0.bottom };
    });
    expect(geo.rowTop).toBeGreaterThanOrEqual(geo.paneTop - 2);
    expect(geo.rowTop).toBeLessThan(geo.paneBottom);
    // eye: hide SMA -> dataset hidden, row dimmed, survives reload; show again
    await rows.nth(0).hover();
    await rows.nth(0).locator('[data-eye]').click();
    await expect(rows.nth(0)).toHaveClass(/hidden/);
    expect(await page.evaluate(() => (window as any).__charts.chart.data.datasets.find((d: any) => d.label === 'SMA 20').hidden)).toBe(true);
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await expect(page.locator('[data-indicator-row]').nth(0)).toHaveClass(/hidden/);
    await page.locator('[data-indicator-row]').nth(0).hover();
    await page.locator('[data-indicator-row]').nth(0).locator('[data-eye]').click();
    await expect(page.locator('[data-indicator-row]').nth(0)).not.toHaveClass(/hidden/);
    // ✕ removes
    await page.locator('[data-indicator-row]').nth(1).hover();
    await page.locator('[data-indicator-row]').nth(1).locator('[data-remove]').click();
    await expect(page.locator('[data-indicator-row]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('tools (10.5): chart types render different signatures, magnet, snapshot download, dblclick reset, fullscreen', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    const signature = async () => (await canvasPixels(page, { top: 0, height: 300 })).n;
    const sigs: Record<string, number> = {};
    for (const t of ['candles', 'ohlc', 'line', 'area']) {
      await page.selectOption('select[name="chartType"]', t);
      await page.waitForFunction((tt) => {
        const d0 = (window as any).__charts.chart.data.datasets[0];
        return tt === 'candles' ? d0.type === 'candlestick' : tt === 'ohlc' ? d0.type === 'ohlc' : d0.type === 'line';
      }, t);
      await page.waitForTimeout(200);
      sigs[t] = await signature();
      expect(sigs[t]).toBeGreaterThan(3000);
    }
    expect(new Set(Object.values(sigs)).size).toBe(4); // every type paints a different amount of pixels
    expect(sigs['area']).toBeGreaterThan(sigs['line']); // filled area paints more than the bare line
    // state persists across reload
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await expect(page.locator('select[name="chartType"]')).toHaveValue('area');

    // magnet: horizontal crosshair snaps to the bar's close instead of following the mouse
    await page.click('[data-magnet]');
    await expect(page.locator('[data-magnet]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__charts.chart.$magnet)).toBe(true);

    // snapshot -> a real PNG download
    const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-screenshot]')]);
    expect(download.suggestedFilename()).toBe('msft-1d.png');

    // double-click resets the zoom to the preset framing
    const span = () => page.evaluate(() => { const x = (window as any).__charts.chart.scales.x; return x.max - x.min; });
    const preset = await span();
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -300);
    await expect.poll(span).toBeLessThan(preset * 0.7);
    await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.3);
    await expect.poll(span).toBeGreaterThan(preset * 0.95);

    await page.click('[data-fullscreen]');
    await page.waitForTimeout(300);
    // headless chromium may deny fullscreen; the click must never throw either way
    expect(errors.filter((e) => !/fullscreen|Permissions check/i.test(e))).toEqual([]);
  });
});
