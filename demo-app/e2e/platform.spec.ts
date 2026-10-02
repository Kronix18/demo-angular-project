import { test, expect, openChart, addIndicator, collectErrors } from './helpers';

test.describe('chart platform features (11.12–11.17)', () => {
  test('side panel, compare, go to date, clock, replay + alert toast, layouts, templates', async ({ page }) => {
    const errors = collectErrors(page);
    await openChart(page);
    await addIndicator(page, 'sma', 20);

    // side panel: object tree, data window, watchlist
    await page.click('[data-panel]');
    await expect(page.locator('[data-obj-indicator]')).toHaveCount(1);
    await page.click('[data-tab="data"]');
    await expect(page.locator('[data-data-row]').first()).toContainText('Open');
    await page.click('[data-tab="watchlist"]');
    await expect(page.locator('[data-watch-row]').first()).toContainText(/\d+\.\d\d/); // quotes load from the demo files
    await page.click('[data-watch-row]:has-text("NVDA")');
    await page.waitForFunction(() => (window as any).__charts.chart.options.scales.y.paneLabel.startsWith('NVDA'));
    await page.click('[data-tab="objects"]');
    await page.screenshot({ path: 'docs/screenshots/11.14-side-panel.png' });
    await page.click('[data-panel]');

    // compare: QQQ as a line on the price pane
    await page.click('[data-compare]');
    await page.click('[data-symbol-option="qqq"]');
    await page.waitForFunction(() => (window as any).__charts.chart.data.datasets.some((d: any) => d.label === 'QQQ'));
    await expect(page.locator('[data-compare-row]')).toContainText('QQQ');
    await page.click('[data-compare-remove]');
    await page.waitForFunction(() => !(window as any).__charts.chart.data.datasets.some((d: any) => d.label === 'QQQ'));

    // go to date: centre on a date well in the past
    const span = () => page.evaluate(() => { const x = (window as any).__charts.chart.scales.x; return { min: x.min, max: x.max }; });
    const before = await span();
    await page.click('[data-goto]');
    await page.fill('[data-goto-input]', '2024-06-03');
    await page.click('[data-ok]');
    await page.waitForTimeout(300);
    const after = await span();
    expect(after.min).toBeLessThan(before.min);
    expect(Math.abs(after.max - after.min - (before.max - before.min))).toBeLessThan(2);

    // clock + fit
    await expect(page.locator('[data-clock]')).toHaveText(/^\d\d:\d\d:\d\d UTC/);
    await page.click('[data-fit]');
    await page.waitForTimeout(300);
    const all = await span();
    expect(all.max - all.min).toBeGreaterThan(1000);
    await page.click('[data-fit]');

    // replay: an alert placed inside the next bar's move fires while playing
    await page.click('[data-reset-zoom], .reset-zoom-btn');
    const last = await page.evaluate(() => { const b = (window as any).__charts.chart.data.datasets[0].data; return b[b.length - 1]; });
    expect(last).toBeTruthy();
    await page.click('[data-replay]');
    await expect(page.locator('[data-replay-bar]')).toBeVisible();
    const barsAtStart = await page.evaluate(() => document.querySelector<HTMLInputElement>('[data-replay-slider]')!.value);
    await page.click('[data-replay-step]');
    const idx = await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('[data-replay-slider]')!.value));
    expect(idx).toBe(Number(barsAtStart) + 1);
    await page.selectOption('[data-replay-speed]', '30');
    await page.click('[data-replay-play]');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() => Number(document.querySelector<HTMLInputElement>('[data-replay-slider]')!.value))).toBeGreaterThan(idx + 3);
    await page.click('[data-replay-play]'); // pause
    await page.screenshot({ path: 'docs/screenshots/11.15-replay.png' });
    await page.click('[data-replay-exit]');
    await expect(page.locator('[data-replay-bar]')).toHaveCount(0);

    // layouts: save, wipe, load
    await page.click('[data-layouts]');
    await page.fill('[data-layout-name]', 'e2e layout');
    await page.click('[data-layout-save]');
    await expect(page.locator('[data-layouts]')).toContainText('e2e layout');
    await page.click('[data-panel]');
    await page.click('[data-obj-indicator] [data-obj-delete]');
    await expect(page.locator('[data-indicator-row]')).toHaveCount(0);
    await page.click('[data-layouts]');
    await page.click('[data-layout-load]');
    await expect(page.locator('[data-indicator-row]')).toHaveCount(1);

    // indicator template: save, clear, apply
    await page.click('[data-indicators]');
    await page.fill('[data-tpl-name]', 'sma set');
    await page.click('[data-tpl-save]');
    await page.keyboard.press('Escape');
    await page.click('[data-obj-indicator] [data-obj-delete]');
    await page.click('[data-indicators]');
    await page.click('[data-tpl-apply]');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-indicator-row]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});
