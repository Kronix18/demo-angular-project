import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.8 browser proof: the app reads /api/meta at start without blocking, and degrades silently. */
test.describe('MetaService (12.8)', () => {
  test('datasets from /api/meta reach the signals; toggling datasets in the mock changes them', async ({ page }) => {
    await mockApi(page, { datasets: ['prices', 'technicals'] });
    await page.goto('/home');
    await expect.poll(() => page.evaluate(() => (window as any).__meta.loaded())).toBe(true);
    expect(await page.evaluate(() => (window as any).__meta.datasets())).toEqual(['prices', 'technicals']);
    expect(await page.evaluate(() => (window as any).__meta.has('ratings'))).toBe(false);
    expect(await page.evaluate(() => (window as any).__meta.benchmarks().default)).toBe('TSX');
    expect(await page.evaluate(() => (window as any).__meta.dataAsOf().prices)).toBe('2026-09-22');
  });

  test('meta endpoint down: page renders, no toast, datasets empty', async ({ page }) => {
    await mockApi(page, { errors: { '/api/meta': { status: 500, body: { error: 'server_error', message: 'x' } } } });
    await page.goto('/home');
    await expect.poll(() => page.evaluate(() => (window as any).__meta.loaded())).toBe(true);
    expect(await page.evaluate(() => (window as any).__meta.datasets())).toEqual([]);
    await expect(page.locator('h1.logo')).toBeVisible();
    await expect(page.locator('[data-api-toast]')).toHaveCount(0);
  });
});
