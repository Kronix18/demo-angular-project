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

  test('indicators: picker dialog, overlay + stacked panes render, persist across refresh', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    // picker: search, category headers, add several in a row, Esc closes
    await page.click('[data-indicators]');
    await expect(page.locator('[data-category]')).toContainText(['Trend', 'Momentum', 'Volatility', 'IBD / CANSLIM']);
    await page.fill('input[type="search"]', 'moment');
    await expect(page.locator('[data-add-indicator]')).toHaveCount(1);
    await page.fill('input[type="search"]', '');
    await page.click('[data-add-indicator="sma"]');
    await page.click('[data-add-indicator="rsi"]');
    await page.click('[data-add-indicator="atr"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('app-indicators-dialog')).toHaveCount(0);
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
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-indicator-row]').first().hover();
      await page.locator('[data-indicator-row]').first().locator('[data-remove]').click();
    }
    await expect(page.locator('[data-indicator-row]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('indicator settings: inputs (validated), colour/width/line style, per-output + per-timeframe visibility', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await addIndicator(page, 'sma');
    await addIndicator(page, 'rsi');
    const ds = (label: string) => page.evaluate((l) => {
      const d = (window as any).__charts.chart.data.datasets.find((x: any) => x.label === l);
      return d ? { color: d.borderColor, width: d.borderWidth, dash: d.borderDash, hidden: !!d.hidden } : null;
    }, label);
    const openSettings = async (n: number) => {
      const row = page.locator('[data-indicator-row]').nth(n);
      await row.hover();
      await row.locator('[data-settings]').click();
    };

    // Inputs: validation blocks OK, a valid length relabels the series
    await openSettings(0);
    await page.fill('[data-param="length"]', '0');
    await expect(page.locator('[data-error="length"]')).toBeVisible();
    await expect(page.locator('[data-ok]')).toBeDisabled();
    await page.fill('[data-param="length"]', '50');
    await page.selectOption('[data-param="method"]', 'EMA');
    // Style: colour, width, line style
    await page.click('[data-tab="style"]');
    await page.fill('[data-style-color="ma"]', '#ff0000');
    await page.selectOption('[data-style-width="ma"]', '3');
    await page.selectOption('[data-style-dash="ma"]', 'dash');
    await page.click('[data-ok]');
    await expect(page.locator('app-indicator-settings-dialog')).toHaveCount(0);
    await expect.poll(() => ds('EMA 50')).toMatchObject({ color: '#ff0000', width: 3, dash: [6, 4] });
    await expect(page.locator('[data-indicator-row]').first()).toContainText('EMA 50');
    expect(await ds('SMA 20')).toBeNull();

    // per-output visibility: hide the RSI overbought guide line only
    await openSettings(1);
    await page.click('[data-tab="style"]');
    await page.click('[data-style-visible="overbought"]');
    await page.click('[data-ok]');
    await expect.poll(() => ds('Overbought')).toMatchObject({ hidden: true });
    expect(await ds('RSI')).toMatchObject({ hidden: false });

    // settings persist across refresh
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    expect(await ds('EMA 50')).toMatchObject({ color: '#ff0000', width: 3 });
    expect(await ds('Overbought')).toMatchObject({ hidden: true });

    // per-timeframe visibility: EMA only on weekly -> hidden on daily, shown after switching
    await openSettings(0);
    await page.click('[data-tab="visibility"]');
    await page.click('[data-interval="1d"]');
    await page.click('[data-ok]');
    await expect.poll(() => ds('EMA 50')).toMatchObject({ hidden: true });
    await page.selectOption('#interval', '1w');
    await expect.poll(() => ds('EMA 50')).toMatchObject({ hidden: false });
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
        return tt === 'candles' ? d0.type === 'candlestick' : tt === 'ohlc' ? d0.type === 'tvbar' : d0.type === 'line';
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

  test('all 18 chart styles render real pixels, keep volume, and survive a reload (11.2)', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await page.click('.range-btn:has-text("1Y")');
    const styles = ['candles', 'hollow', 'ohlc', 'hlc', 'highlow', 'columns', 'line', 'markers', 'step', 'area', 'hlcarea', 'baseline',
      'heikin', 'renko', 'linebreak', 'kagi', 'pnf', 'range'];
    const sigs = new Set<number>();
    for (const t of styles) {
      await page.selectOption('select[name="chartType"]', t);
      await page.waitForTimeout(250);
      const info = await page.evaluate(() => {
        const c = (window as any).__charts.chart;
        const y = c.scales.y;
        return { n: c.data.datasets[0].data.length, top: y.top, height: y.height, finite: Number.isFinite(y.min) && Number.isFinite(y.max), vol: c.data.datasets.some((d: any) => d.label === 'Volume') };
      });
      expect(info.n, t).toBeGreaterThan(3);
      expect(info.finite, t).toBe(true);
      expect(info.vol, t).toBe(true);
      const px = await canvasPixels(page, { top: info.top, height: info.height });
      expect(px.n, `${t} price pane pixels`).toBeGreaterThan(400);
      sigs.add(px.n);
    }
    expect(sigs.size).toBeGreaterThan(14); // styles are visibly different renderings
    await page.selectOption('select[name="chartType"]', 'pnf');
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await expect(page.locator('select[name="chartType"]')).toHaveValue('pnf');
    expect(errors).toEqual([]);
  });

  test('type-to-search (11.3): typing anywhere opens symbol search; filter, pick, unknown symbol, Esc', async ({ page }) => {
    const errors = collectErrors(page, /Failed to load|404/);
    await openChart(page, 'msft');
    // start typing with focus on the page (not in a field)
    await page.keyboard.press('n');
    const box = page.locator('input[type="search"]');
    await expect(box).toBeVisible();
    await expect(box).toHaveValue('n');
    await expect(page.locator('[data-symbol-option]')).toHaveText([/NVDA/]);
    // keep typing in the box, arrow/Enter picks
    await page.keyboard.type('v');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/charts\/nvda$/);
    await expect(page.locator('app-symbol-search-dialog')).toHaveCount(0);
    await page.waitForFunction(() => (window as any).__charts?.chart?.options.scales.y.paneLabel.startsWith('NVDA'));
    // header symbol button opens it empty; Esc closes without switching
    await page.click('[data-symbol-btn]');
    await expect(page.locator('[data-symbol-option]')).toHaveCount(8);
    await page.keyboard.press('Escape');
    await expect(page.locator('app-symbol-search-dialog')).toHaveCount(0);
    await expect(page).toHaveURL(/\/charts\/nvda$/);
    // an unknown symbol can be entered: the chart shows the unknown-symbol card
    await page.keyboard.press('a');
    await page.keyboard.type('apl');
    await expect(page.locator('[data-go]')).toContainText('AAPL');
    await page.keyboard.press('Enter');
    await expect(page.locator('.error-card')).toContainText('AAPL');
    // typing in a normal field never opens the dialog
    await page.fill('#symbol', 'q');
    await expect(page.locator('app-symbol-search-dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('price scale (11.4): auto by default, vertical drag pans price + turns auto off, axis drag scales, Auto restores, log includes volume', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await page.click('.range-btn:has-text("1Y")');
    const yr = () => page.evaluate(() => { const y = (window as any).__charts.chart.scales.y; return { min: y.min, max: y.max, top: y.top, bottom: y.bottom }; });
    const box = (await page.locator('canvas').boundingBox())!;
    const right = await page.evaluate(() => (window as any).__charts.chart.chartArea.right);
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'true');
    const start = await yr();
    const my = box.y + start.top + (start.bottom - start.top) * 0.4;

    // a horizontal pan keeps auto on
    await page.mouse.move(box.x + 500, my);
    await page.mouse.down();
    await page.mouse.move(box.x + 560, my + 2, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'true');

    // drag the chart DOWN: auto turns off and higher prices come into view
    const before = await yr();
    await page.mouse.move(box.x + 500, my);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, my + 60, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'false');
    const panned = await yr();
    expect(panned.min).toBeGreaterThan(before.min);
    expect(panned.max - panned.min).toBeCloseTo(before.max - before.min, 0);

    // drag UP by a lot: you can pan the price below the data (this is what auto used to forbid)
    await page.mouse.move(box.x + 500, my + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 500, my - 120, { steps: 10 });
    await page.mouse.up();
    expect((await yr()).max).toBeLessThan(before.max);

    // horizontal pan / zoom keep the manual range
    const manual = await yr();
    await page.mouse.move(box.x + 500, my);
    await page.mouse.down();
    await page.mouse.move(box.x + 560, my, { steps: 4 });
    await page.mouse.up();
    expect((await yr()).min).toBeCloseTo(manual.min, 4);

    // drag on the price axis scales around the centre
    const span = manual.max - manual.min;
    await page.mouse.move(box.x + right + 30, box.y + manual.top + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + right + 30, box.y + manual.top + 160, { steps: 8 });
    await page.mouse.up();
    const scaled = await yr();
    expect(scaled.max - scaled.min).toBeGreaterThan(span);
    expect((scaled.min + scaled.max) / 2).toBeCloseTo((manual.min + manual.max) / 2, 3);

    // Auto restores the fit
    await page.click('[data-auto]');
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'true');
    const fit = await yr();
    expect(Math.abs(fit.max - fit.min - (start.max - start.min))).toBeLessThan((start.max - start.min) * 0.35);

    // log: price AND volume scales go logarithmic, survive reload; volume bars stay visible
    await page.click('[data-log]');
    await expect(page.locator('[data-log]')).toHaveAttribute('aria-pressed', 'true');
    const types = await page.evaluate(() => { const o = (window as any).__charts.chart.options.scales; return [o.y.type, o.yVol.type]; });
    expect(types).toEqual(['logarithmic', 'logarithmic']);
    const px = await canvasPixels(page, await page.evaluate(() => { const s = (window as any).__charts.chart.scales.yVol; return { top: s.top, height: s.height }; }));
    expect(px.n).toBeGreaterThan(1500);
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await expect(page.locator('[data-log]')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (window as any).__charts.chart.options.scales.y.type)).toBe('logarithmic');
    // ALL history in log: the 1986 prices are readable (linear would flatten them)
    await page.click('.range-btn:has-text("ALL")');
    await page.waitForTimeout(300);
    const all = await yr();
    expect(all.min).toBeGreaterThan(0);
    expect(all.max / all.min).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  });

  test('indicator lines run edge to edge while panning (no cut-off at either side)', async ({ page }) => {
    await openChart(page);
    await addIndicator(page, 'sma', 10);
    await addIndicator(page, 'sma', 50);
    const box = (await page.locator('canvas').boundingBox())!;
    for (const dx of [300, -500, 200]) {
      await page.mouse.move(box.x + box.width / 2, box.y + 200);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + 200, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const c = (window as any).__charts.chart;
        return c.data.datasets.map((d: any, i: number) => ({ label: d.label, m: c.getDatasetMeta(i) })).filter((x: any) => /^SMA/.test(x.label)).map((x: any) => {
          const pts = x.m.dataset.points;
          const bars = c.getDatasetMeta(0).data;
          return { first: pts[0].x, last: pts[pts.length - 1].x, left: bars[0].x, right: bars[bars.length - 1].x, all: pts.every((p: any) => !p.skip) };
        });
      });
      for (const l of r) {
        expect(l.all).toBe(true);
        expect(l.first).toBeLessThanOrEqual(l.left + 1);
        expect(l.last).toBeGreaterThanOrEqual(l.right - 1);
      }
    }
  });

  test('symbol + volume settings from the legend (11.6): colours, previous-close colouring, hide', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    const ds = (label: string) => page.evaluate((l) => {
      const d = (window as any).__charts.chart.data.datasets.find((x: any) => x.label === l);
      return { hidden: !!d.hidden, colors: d.backgroundColors && typeof d.backgroundColors !== 'function' ? d.backgroundColors : null, dir: d.data[0]?.dir ?? null };
    }, label);
    await page.locator('[data-legend-header]').hover();
    await page.click('[data-price-settings]');
    await page.locator('[data-set="up"]').fill('#ff8800');
    await page.locator('[data-set="prev"]').check();
    await page.click('[data-ok]');
    await expect(page.locator('app-symbol-settings-dialog')).toHaveCount(0);
    const price = await ds('Price');
    expect(['up', 'down']).toContain(price.dir);
    await page.locator('[data-legend-header]').hover();
    await page.click('[data-price-eye]');
    expect((await ds('Price')).hidden).toBe(true);
    await page.click('[data-price-eye]');
    expect((await ds('Price')).hidden).toBe(false);
    await page.locator('[data-volume-row]').hover();
    await page.click('[data-volume-eye]');
    expect((await ds('Volume')).hidden).toBe(true);
    await page.click('[data-volume-eye]');
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    expect((await ds('Price')).dir).not.toBeNull(); // settings survive a refresh
    expect(errors).toEqual([]);
  });
});
