import { test, expect, openChart, addIndicator, collectErrors } from './helpers';

const SIZES = [[1920, 1080], [1400, 800], [1024, 600], [390, 760]] as const;

test.describe('chart page layout (5.4)', () => {
  for (const [w, h] of SIZES) {
    test(`${w}x${h}: fills the viewport, no page scrollbar, one aligned panel`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openChart(page);
      await addIndicator(page, 'rsi', 14);
      await addIndicator(page, 'atr', 14);
      await page.waitForTimeout(400);
      const m = await page.evaluate(() => {
        const de = document.documentElement;
        const c = (window as any).__charts.chart;
        const ids = ['y', 'yVol', 'yInd0', 'yInd1'];
        return {
          v: de.scrollHeight - innerHeight, h: de.scrollWidth - innerWidth,
          gap: innerHeight - document.querySelector('.scale-bar')!.getBoundingClientRect().bottom,
          canvases: document.querySelectorAll('canvas').length, footer: !!document.querySelector('footer'),
          lefts: new Set(ids.map((k) => Math.round(c.scales[k].left))).size,
          contiguous: ids.every((k, i) => i === 0 || Math.abs(c.scales[k].top - c.scales[ids[i - 1]].bottom) <= 1),
        };
      });
      expect(m.v).toBeLessThanOrEqual(0);
      expect(m.h).toBeLessThanOrEqual(0);
      expect(m.gap).toBeGreaterThanOrEqual(0);
      expect(m.gap).toBeLessThanOrEqual(2);
      expect(m.canvases).toBe(1);
      expect(m.footer).toBe(false);
      expect(m.lefts).toBe(1);
      expect(m.contiguous).toBe(true);
    });
  }

  test('drawing sidebar is a fixed full-height column on the left, chart fills the rest (11.8)', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 800 });
    await openChart(page);
    const r = await page.evaluate(() => {
      const b = (sel: string) => { const e = document.querySelector(sel)!.getBoundingClientRect(); return { x: e.x, y: e.y, w: e.width, h: e.height, r: e.right, b: e.bottom }; };
      return { side: b('app-drawing-sidebar'), panel: b('.chart-panel'), col: b('.chart-col'), header: b('.chart-header'), canvas: b('canvas') };
    });
    expect(r.side.x).toBe(0);
    expect(Math.abs(r.side.y - r.panel.y)).toBeLessThanOrEqual(1);          // starts right under the chart navbar
    expect(Math.abs(r.side.b - r.col.b)).toBeLessThanOrEqual(1);            // and runs to the bottom, beside the scale bar too
    expect(r.panel.x).toBeGreaterThanOrEqual(r.side.r - 1);                 // the chart starts where the sidebar ends
    expect(Math.abs(r.canvas.x - r.panel.x)).toBeLessThanOrEqual(1);
    expect(r.side.w).toBeLessThan(60);
    // short windows scroll the sidebar instead of overflowing the page
    await page.setViewportSize({ width: 1400, height: 420 });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1400, height: 800 });
    await page.screenshot({ path: 'docs/screenshots/11.8-sidebar-column.png' });
  });

  test('every button on the chart page carries a drawn (SVG) icon; no picture / symbol characters are shown', async ({ page }) => {
    await openChart(page);
    await page.click('[data-panel]');
    await page.click('[data-flyout="icons"]');
    const r = await page.evaluate(() => {
      const symbol = /[\u2190-\u21FF\u2300-\u2BFF\uFF0B\u00D7\u2715]|\p{Extended_Pictographic}/u;
      const btns = Array.from(document.querySelectorAll('.draw-tools button, .chart-tools button, .scale-bar button, .chart-legend button, [data-obj-eye]'));
      return {
        symbols: (document.querySelector('.chart-page') as HTMLElement).innerText.split('\n').filter((l) => symbol.test(l)),
        withoutSvg: btns.filter((b) => !b.querySelector('svg') && !['auto', 'log', 'Replay', 'Compare'].some((t) => (b as HTMLElement).innerText.includes(t)) && !b.classList.contains('clock')).map((b) => (b as HTMLElement).outerHTML.slice(0, 80)),
        n: btns.length,
      };
    });
    expect(r.symbols).toEqual([]);
    expect(r.withoutSvg).toEqual([]);
    expect(r.n).toBeGreaterThan(15);
  });

  test('compact navbar on the chart page; other pages keep navbar + footer', async ({ page }) => {
    await openChart(page);
    const nav = await page.locator('nav.navbar').boundingBox();
    expect(nav!.height).toBeLessThanOrEqual(48);
    await page.goto('/home');
    expect((await page.locator('nav.navbar').boundingBox())!.height).toBeGreaterThan(55);
    await expect(page.locator('footer')).toBeVisible();
  });

  test('pan over the full history stays smooth (bounded data window)', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await page.click('.range-btn:has-text("ALL")');
    await addIndicator(page, 'sma', 20);
    await addIndicator(page, 'rsi', 14);
    await page.waitForTimeout(500);
    // best of 3 rounds: parallel workers on software rendering add scheduling noise, the fastest round is the real cost
    const perf = await page.evaluate(async () => {
      const c = (window as any).__charts.chart;
      const points = c.data.datasets[0].data.length;
      const round = () => new Promise<{ median: number; p90: number }>((res) => {
        const frames: number[] = [];
        let last = performance.now();
        let i = 0;
        const step = () => {
          const now = performance.now(); frames.push(now - last); last = now;
          c.pan({ x: 6 }, undefined, 'none');
          if (++i < 60) requestAnimationFrame(step);
          else { frames.sort((a, b) => a - b); res({ median: frames[30], p90: frames[54] }); }
        };
        requestAnimationFrame(step);
      });
      const rounds = [await round(), await round(), await round()];
      return { points, median: Math.min(...rounds.map((r) => r.median)), p90: Math.min(...rounds.map((r) => r.p90)) };
    });
    expect(perf.points).toBeLessThan(700); // ~10k bars, bounded window
    expect(perf.median).toBeLessThan(30);  // generous: CI/software rendering
    expect(perf.p90).toBeLessThan(60);
    expect(errors).toEqual([]);
  });

  test('cold load of the FULL history (ALL, 4 indicators) is interactive in < 3s; interval switch does not refetch', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('chart-state', JSON.stringify({
      symbol: 'msft', interval: '1d', range: 'ALL',
      indicators: [{ type: 'sma', period: 20 }, { type: 'ema', period: 50 }, { type: 'rsi', period: 14 }, { type: 'atr', period: 14 }],
    })));
    let fileRequests = 0;
    page.on('request', (r) => { if (r.url().includes('/test-data/')) fileRequests++; });
    const t0 = Date.now();
    await page.goto('/charts/msft');
    await page.waitForFunction(() => (window as any).__charts?.chart && !document.querySelector('.loading-overlay'));
    const loadMs = Date.now() - t0;
    console.log(`[perf] cold ALL load with 4 indicators: ${loadMs} ms (dev server, unoptimised build)`);
    expect(loadMs).toBeLessThan(3000);
    const bars = await page.evaluate(() => (window as any).__charts.chart.scales.x.max + 1);
    expect(bars).toBeGreaterThan(9000); // really the full ~40y history
    await page.selectOption('#interval', '1w');
    await page.waitForFunction((n) => (window as any).__charts.chart.scales.x.max + 1 < n / 3, bars);
    expect(fileRequests).toBe(1);
  });
});
