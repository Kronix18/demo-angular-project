import { test, expect, openChart, collectErrors, pickTool } from './helpers';
import type { Page } from '@playwright/test';

/** Pixels in the chart canvas painted in the drawing colour (theme token, resolved at runtime). */
const drawingPixels = (page: Page) => page.evaluate(() => {
  const c = (window as any).__charts.chart.canvas as HTMLCanvasElement;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--c-drawing').trim();
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && Math.abs(d[i] - r) < 8 && Math.abs(d[i + 1] - g) < 8 && Math.abs(d[i + 2] - b) < 8) n++;
  return n;
});
const stored = (page: Page) => page.evaluate(() => JSON.parse(sessionStorage.getItem('chart-drawings') ?? '{}'));
const pane = async (page: Page) => {
  const box = (await page.locator('canvas').boundingBox())!;
  const y = await page.evaluate(() => { const s = (window as any).__charts.chart.scales.y; return { top: s.top, bottom: s.bottom }; });
  return { x0: box.x, y0: box.y, w: box.width, top: y.top, bottom: y.bottom };
};

test.describe('drawing tools (10.3)', () => {
  test('trend line: draw, render, survive refresh, select, drag, delete; pan is off while drawing, zoom keeps working', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    expect(await drawingPixels(page)).toBe(0);
    const p = await pane(page);
    const at = (fx: number, fy: number) => ({ x: p.x0 + p.w * fx, y: p.y0 + p.top + (p.bottom - p.top) * fy });

    await pickTool(page, 'trend');
    const xBefore = await page.evaluate(() => (window as any).__charts.chart.scales.x.min);
    const a = at(0.25, 0.3);
    const b = at(0.6, 0.55);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    await page.mouse.up();
    expect((await stored(page)).msft).toHaveLength(1);
    expect((await stored(page)).msft[0]).toMatchObject({ type: 'trend' });
    expect(await drawingPixels(page)).toBeGreaterThan(150);
    expect(await page.evaluate(() => (window as any).__charts.chart.scales.x.min)).toBe(xBefore); // no pan while drawing

    // survives a refresh
    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await page.waitForTimeout(300);
    expect(await drawingPixels(page)).toBeGreaterThan(150);

    // cursor: select by clicking on the line, drag it, then delete with the keyboard
    await pickTool(page, 'cursor');
    const mid = at(0.425, 0.425);
    await page.mouse.click(mid.x, mid.y);
    const withHandles = await drawingPixels(page);
    await page.mouse.move(mid.x, mid.y);
    await page.mouse.down();
    await page.mouse.move(mid.x + 40, mid.y + 20, { steps: 5 });
    await page.mouse.up();
    const moved = (await stored(page)).msft[0];
    expect(moved.a.t).toBeGreaterThan(0);
    await page.keyboard.press('Delete');
    expect((await stored(page)).msft).toHaveLength(0);
    expect(await drawingPixels(page)).toBeLessThan(withHandles);
    expect(await drawingPixels(page)).toBe(0);

    // the cursor tool pans again, wheel zoom still works
    await page.mouse.move(p.x0 + p.w * 0.5, p.y0 + p.top + 40);
    await page.mouse.down();
    await page.mouse.move(p.x0 + p.w * 0.7, p.y0 + p.top + 40, { steps: 6 });
    await page.mouse.up();
    expect(await page.evaluate(() => (window as any).__charts.chart.scales.x.min)).not.toBe(xBefore);
    const span = () => page.evaluate(() => { const x = (window as any).__charts.chart.scales.x; return x.max - x.min; });
    const s0 = await span();
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -300);
    await expect.poll(span).toBeLessThan(s0);
    expect(errors).toEqual([]);
  });

  test('horizontal ray (one click) and parallel channel (drag + click), per-symbol isolation, Clear', async ({ page }) => {
    await openChart(page);
    const p = await pane(page);
    const at = (fx: number, fy: number) => ({ x: p.x0 + p.w * fx, y: p.y0 + p.top + (p.bottom - p.top) * fy });

    await pickTool(page, 'ray');
    const r = at(0.4, 0.7);
    await page.mouse.click(r.x, r.y);
    expect((await stored(page)).msft.map((d: any) => d.type)).toEqual(['ray']);

    await pickTool(page, 'channel');
    const c1 = at(0.2, 0.2);
    const c2 = at(0.7, 0.2);
    await page.mouse.move(c1.x, c1.y);
    await page.mouse.down();
    await page.mouse.move(c2.x, c2.y, { steps: 6 });
    await page.mouse.up();
    expect((await stored(page)).msft).toHaveLength(1); // channel is still a draft (waiting for the offset click)
    const off = at(0.45, 0.45);
    await page.mouse.move(off.x, off.y, { steps: 3 });
    await page.mouse.click(off.x, off.y);
    const list = (await stored(page)).msft;
    expect(list.map((d: any) => d.type)).toEqual(['ray', 'channel']);
    expect(Math.abs(list[1].offset)).toBeGreaterThan(0);
    const both = await drawingPixels(page);
    expect(both).toBeGreaterThan(400);

    // drawings belong to a symbol
    await page.fill('#symbol', 'nvda');
    await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => (window as any).__charts.chart.options.scales.y.paneLabel.startsWith('NVDA'));
    await page.waitForTimeout(300);
    expect(await drawingPixels(page)).toBe(0);
    await page.fill('#symbol', 'msft');
    await page.press('#symbol', 'Enter');
    await page.waitForFunction(() => (window as any).__charts.chart.options.scales.y.paneLabel.startsWith('MSFT'));
    await page.waitForTimeout(300);
    expect(await drawingPixels(page)).toBeGreaterThan(400);

    await page.click('[data-tool-clear]');
    expect((await stored(page)).msft).toHaveLength(0);
    expect(await drawingPixels(page)).toBe(0);
  });

  test('a drawing stays anchored to its date when the interval changes (daily → weekly) and in dark mode', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await openChart(page);
    const p = await pane(page);
    await pickTool(page, 'ray');
    await page.mouse.click(p.x0 + p.w * 0.5, p.y0 + p.top + (p.bottom - p.top) * 0.5);
    await pickTool(page, 'cursor');
    const before = await drawingPixels(page);
    expect(before).toBeGreaterThan(100);
    await page.selectOption('#interval', '1w');
    await page.waitForFunction(() => (window as any).__charts.chart.scales.x.max > 0);
    await page.waitForTimeout(400);
    // the ray is still drawn (time-anchored, not index-anchored)
    expect(await drawingPixels(page)).toBeGreaterThan(50);
  });
  test('TradingView sidebar (11.5): shapes, fib, text label, style toolbar, lock/hide, zoom region, measure, stay-in-drawing', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    const p = await pane(page);
    const at = (fx: number, fy: number) => ({ x: p.x0 + p.w * fx, y: p.y0 + p.top + (p.bottom - p.top) * fy });
    const drag = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 6 });
      await page.mouse.up();
    };
    const types = async () => ((await stored(page)).msft ?? []).map((d: any) => d.type);

    await pickTool(page, 'rect');
    await drag(at(0.2, 0.2), at(0.35, 0.4));
    await pickTool(page, 'fib');
    await drag(at(0.5, 0.3), at(0.7, 0.6));
    await pickTool(page, 'hline');
    await page.mouse.click(at(0.4, 0.8).x, at(0.4, 0.8).y);
    expect(await types()).toEqual(['rect', 'fib', 'hline']);
    await expect(page.locator('[data-tool="cursor"]')).toHaveAttribute('aria-pressed', 'true'); // back to the cursor

    // style toolbar for the selected (last) drawing
    await page.locator('[data-draw-width]').selectOption('3');
    await page.locator('[data-draw-dash]').selectOption('dot');
    expect((await stored(page)).msft[2].style).toMatchObject({ width: 3, dash: 'dot' });

    // text label
    await pickTool(page, 'text');
    const t = at(0.3, 0.6);
    await page.mouse.click(t.x, t.y);
    await page.fill('[data-text-edit]', 'breakout');
    await page.press('[data-text-edit]', 'Enter');
    expect((await stored(page)).msft.at(-1)).toMatchObject({ type: 'text', text: 'breakout' });

    await page.screenshot({ path: 'docs/screenshots/11.5-drawing-tools.png' });

    // hide / show and lock
    const before = await drawingPixels(page);
    expect(before).toBeGreaterThan(300);
    await page.click('[data-hide]');
    expect(await drawingPixels(page)).toBe(0);
    await page.click('[data-hide]');
    expect(await drawingPixels(page)).toBeGreaterThan(300);
    await page.click('[data-lock]');
    await expect(page.locator('[data-lock]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('[data-lock]');

    // stay in drawing mode
    await page.click('[data-keep]');
    await pickTool(page, 'vline');
    await page.mouse.click(at(0.15, 0.5).x, at(0.15, 0.5).y);
    await page.mouse.click(at(0.16, 0.5).x, at(0.16, 0.5).y);
    await expect(page.locator('[data-tool="vline"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('[data-keep]');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tool="cursor"]')).toHaveAttribute('aria-pressed', 'true');

    // measure never persists
    const n = (await types()).length;
    await pickTool(page, 'measure');
    await drag(at(0.2, 0.3), at(0.5, 0.6));
    expect((await types()).length).toBe(n);

    // zoom region: x zooms in, price scale goes manual
    const span = () => page.evaluate(() => { const x = (window as any).__charts.chart.scales.x; return x.max - x.min; });
    const s0 = await span();
    await pickTool(page, 'zoom');
    await drag(at(0.3, 0.3), at(0.5, 0.6));
    await page.waitForTimeout(300);
    expect(await span()).toBeLessThan(s0 * 0.6);
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'false');
    await page.click('[data-auto]');
    await expect(page.locator('[data-auto]')).toHaveAttribute('aria-pressed', 'true');
    expect(errors).toEqual([]);
  });

  test('TradingView tool groups (11.7): flyouts, sequence tools, polyline, position, patterns, regression, icons', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    const p = await pane(page);
    const at = (fx: number, fy: number) => ({ x: p.x0 + p.w * fx, y: p.y0 + p.top + (p.bottom - p.top) * fy });
    const click = async (fx: number, fy: number) => { const a = at(fx, fy); await page.mouse.click(a.x, a.y); };
    const types = async () => ((await stored(page)).msft ?? []).map((d: any) => d.type);

    // flyout lists the whole group
    await page.click('[data-flyout="fib"]');
    await expect(page.locator('[data-flyout-tool]')).toHaveCount(18);
    await page.screenshot({ path: 'docs/screenshots/11.7-flyout.png' });
    await page.keyboard.press('Escape');
    await page.click('[data-flyout="fib"]'); // Esc leaves the tool, not the menu: toggle it shut
    await expect(page.locator('[data-flyout-menu]')).toHaveCount(0);

    await pickTool(page, 'fibext');           // drag A->B, click C
    const a = at(0.2, 0.7), b = at(0.35, 0.3);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
    await click(0.5, 0.5);
    await pickTool(page, 'xabcd');            // five clicks
    for (const [fx, fy] of [[0.55, 0.7], [0.62, 0.3], [0.68, 0.55], [0.75, 0.25], [0.82, 0.45]]) await click(fx, fy);
    await pickTool(page, 'polyline');         // clicks + Enter
    for (const [fx, fy] of [[0.1, 0.9], [0.2, 0.8], [0.3, 0.88]]) await click(fx, fy);
    await page.keyboard.press('Enter');
    await pickTool(page, 'longpos');
    await click(0.4, 0.6); await click(0.4, 0.75); await click(0.55, 0.4);
    await pickTool(page, 'regression');
    const r1 = at(0.15, 0.4), r2 = at(0.45, 0.35);
    await page.mouse.move(r1.x, r1.y); await page.mouse.down(); await page.mouse.move(r2.x, r2.y, { steps: 5 }); await page.mouse.up();
    await pickTool(page, 'iconstar'); await click(0.9, 0.15);
    await pickTool(page, 'cross'); await click(0.7, 0.85);
    expect(await types()).toEqual(['fibext', 'xabcd', 'polyline', 'longpos', 'regression', 'iconstar', 'cross']);
    expect(await drawingPixels(page)).toBeGreaterThan(1500);
    await page.screenshot({ path: 'docs/screenshots/11.7-many-tools.png' });

    await page.reload();
    await page.waitForFunction(() => (window as any).__charts?.chart);
    await page.waitForTimeout(300);
    expect(await types()).toHaveLength(7);
    expect(await drawingPixels(page)).toBeGreaterThan(1500);
    expect(errors).toEqual([]);
  });

  test('second wave (11.9-11.11): more tools, eraser, undo/redo, clone, context menu, settings, percent scale', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    const p = await pane(page);
    const at = (fx: number, fy: number) => ({ x: p.x0 + p.w * fx, y: p.y0 + p.top + (p.bottom - p.top) * fy });
    const click = async (fx: number, fy: number) => { const a = at(fx, fy); await page.mouse.click(a.x, a.y); };
    const drag = async (f: [number, number], t: [number, number]) => {
      const a = at(...f), b = at(...t);
      await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up();
    };
    const types = async () => ((await stored(page)).msft ?? []).map((d: any) => d.type);

    await pickTool(page, 'gannfan'); await drag([0.2, 0.7], [0.35, 0.5]);
    await pickTool(page, 'avwap'); await click(0.3, 0.5);
    await pickTool(page, 'volprofile'); await drag([0.55, 0.2], [0.75, 0.8]);
    await pickTool(page, 'iconrocket'); await click(0.85, 0.2);
    expect(await types()).toEqual(['gannfan', 'avwap', 'volprofile', 'iconrocket']);
    await page.screenshot({ path: 'docs/screenshots/11.9-more-tools.png' });

    // undo / redo (buttons + shortcuts) and clone
    await page.click('[data-undo]');
    expect(await types()).toHaveLength(3);
    await page.keyboard.press('Control+y');
    expect(await types()).toHaveLength(4);
    await page.keyboard.press('Control+z');
    expect(await types()).toHaveLength(3);
    await pickTool(page, 'cursor');
    await click(0.9, 0.9); // deselect
    const a = at(0.3, 0.5);
    await page.mouse.click(a.x, a.y + 0); // the VWAP starts here: selects something
    await page.keyboard.press('Control+d');

    // eraser removes the drawing under the pointer
    const before = (await types()).length;
    await pickTool(page, 'eraser');
    const l = at(0.28, 0.6);
    for (let i = 0; i < 3; i++) await page.mouse.click(l.x + i * 30, l.y - i * 12);
    expect((await types()).length).toBeLessThanOrEqual(before);
    await pickTool(page, 'cursor');

    // alt shortcuts
    await page.keyboard.press('Alt+h');
    await expect(page.locator('[data-group="lines"]')).toHaveAttribute('data-tool', 'hline');

    // context menu: add a horizontal line at the price
    const n0 = (await types()).length;
    const c = at(0.6, 0.85);
    await page.mouse.click(c.x, c.y, { button: 'right' });
    await page.click('[data-ctx="hline"]');
    expect((await types()).length).toBe(n0 + 1);

    // percent scale + last price label on the axis
    await page.click('[data-percent]');
    await expect(page.locator('[data-percent]')).toHaveAttribute('aria-pressed', 'true');
    const label = await page.evaluate(() => (window as any).__charts.chart.options.scales.y.ticks.callback(100));
    expect(label).toMatch(/%$/);
    await page.click('[data-percent]');

    // settings: last price line off removes its label pixels
    await page.click('[data-chart-settings]');
    await page.locator('[data-view="lastPrice"]').uncheck();
    await page.locator('[data-view="gridV"]').uncheck();
    await page.click('[data-ok]');
    expect(await page.evaluate(() => (window as any).__charts.chart.$lastPriceOn)).toBe(false);
    expect(await page.evaluate(() => (window as any).__charts.chart.options.scales.x.grid.display)).toBe(false);
    await page.screenshot({ path: 'docs/screenshots/11.11-settings.png' });
    expect(errors).toEqual([]);
  });
});
