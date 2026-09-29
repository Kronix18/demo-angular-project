import { expect, Page } from '@playwright/test';

/** Opens a chart and waits until the panel chart exists and loading is over. */
export async function openChart(page: Page, symbol = 'msft'): Promise<void> {
  await page.goto(`/charts/${symbol}`);
  await page.waitForFunction(() => !document.querySelector('.loading-overlay') && (window as any).__charts?.chart);
}

/** Adds an indicator through the panel UI. */
export async function addIndicator(page: Page, type: string, period?: number): Promise<void> {
  await page.selectOption('select[name="indicatorType"]', type);
  if (period !== undefined) await page.fill('input[name="indicatorPeriod"]', String(period));
  await page.click('[data-add]');
}

/** Non-blank canvas proof: drawn pixel count + colour variance inside a pixel-space box. */
export async function canvasPixels(page: Page, box?: { top: number; height: number }): Promise<{ n: number; colors: number }> {
  return page.evaluate((b) => {
    const c = (window as any).__charts.chart.canvas as HTMLCanvasElement;
    const y = b ? Math.round(b.top * (c.width / c.clientWidth)) : 0;
    const h = b ? Math.round(b.height * (c.width / c.clientWidth)) : c.height;
    const d = c.getContext('2d')!.getImageData(0, y, c.width, h).data;
    const colors = new Set<string>();
    let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) { n++; if (colors.size < 50) colors.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
    }
    return { n, colors: colors.size };
  }, box);
}

export function collectErrors(page: Page, ignore: RegExp = /$^/): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !ignore.test(m.text())) errors.push(m.text()); });
  return errors;
}

export { expect, test } from '@playwright/test';
