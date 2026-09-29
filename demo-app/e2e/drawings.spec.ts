import { test, expect, openChart, collectErrors } from './helpers';
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

    await page.click('[data-tool="trend"]');
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
    await page.click('[data-tool="cursor"]');
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

    await page.click('[data-tool="ray"]');
    const r = at(0.4, 0.7);
    await page.mouse.click(r.x, r.y);
    expect((await stored(page)).msft.map((d: any) => d.type)).toEqual(['ray']);

    await page.click('[data-tool="channel"]');
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
    await page.click('[data-tool="ray"]');
    await page.mouse.click(p.x0 + p.w * 0.5, p.y0 + p.top + (p.bottom - p.top) * 0.5);
    await page.click('[data-tool="cursor"]');
    const before = await drawingPixels(page);
    expect(before).toBeGreaterThan(100);
    await page.selectOption('#interval', '1w');
    await page.waitForFunction(() => (window as any).__charts.chart.scales.x.max > 0);
    await page.waitForTimeout(400);
    // the ray is still drawn (time-anchored, not index-anchored)
    expect(await drawingPixels(page)).toBeGreaterThan(50);
  });
});
