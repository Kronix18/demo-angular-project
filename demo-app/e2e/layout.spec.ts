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
          gap: innerHeight - c.canvas.getBoundingClientRect().bottom,
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
    const perf = await page.evaluate(async () => {
      const c = (window as any).__charts.chart;
      const points = c.data.datasets[0].data.length;
      const frames: number[] = [];
      let last = performance.now();
      await new Promise<void>((res) => {
        let i = 0;
        const step = () => { const now = performance.now(); frames.push(now - last); last = now; c.pan({ x: 6 }, undefined, 'none'); if (++i < 60) requestAnimationFrame(step); else res(); };
        requestAnimationFrame(step);
      });
      frames.sort((a, b) => a - b);
      return { points, median: frames[30], p90: frames[54] };
    });
    expect(perf.points).toBeLessThan(700); // ~10k bars, bounded window
    expect(perf.median).toBeLessThan(30);  // generous: CI/software rendering
    expect(perf.p90).toBeLessThan(60);
    expect(errors).toEqual([]);
  });
});
