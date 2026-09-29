import { toolDef } from '../src/app/charts/drawings/drawing-tools';
import { expect, Page } from '@playwright/test';

/** Opens a chart and waits until the panel chart exists and loading is over. */
export async function openChart(page: Page, symbol = 'msft'): Promise<void> {
  await page.goto(`/charts/${symbol}`);
  await page.waitForFunction(() => !document.querySelector('.loading-overlay') && (window as any).__charts?.chart);
}

const DEFAULT_PERIOD: Record<string, number> = { sma: 20, ema: 21, wma: 10, rma: 14, rsi: 14, atr: 14 };

/** Adds an indicator through the Indicators dialog (and edits its length via the settings dialog when it differs from the default). */
export async function addIndicator(page: Page, type: string, period?: number): Promise<void> {
  await page.click('[data-indicators]');
  await page.click(`[data-add-indicator="${type}"]`);
  await page.keyboard.press('Escape');
  await expect(page.locator('app-indicators-dialog')).toHaveCount(0);
  if (period !== undefined && period !== DEFAULT_PERIOD[type]) {
    const row = page.locator('[data-indicator-row]').last();
    await row.hover();
    await row.locator('[data-settings]').click();
    await page.fill('[data-param="length"]', String(period));
    await page.click('[data-ok]');
    await expect(page.locator('app-indicator-settings-dialog')).toHaveCount(0);
  }
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

/** Picks a drawing tool: measure / zoom / cursor and a group's current tool are on the sidebar, everything else via its group's flyout. */
export async function pickTool(page: Page, id: string): Promise<void> {
  const def = toolDef(id);
  if (!def) { await page.locator(`.draw-tools [data-tool="${id}"]`).click(); return; }
  const direct = page.locator(`.draw-tools [data-group="${def.group}"][data-tool="${id}"]`);
  if (await direct.count()) { await direct.click(); return; }
  await page.locator(`[data-flyout="${def.group}"]`).click();
  await page.locator(`[data-flyout-tool="${id}"]`).click(); // auto-waits for the menu to render
}
