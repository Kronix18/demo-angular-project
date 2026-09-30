import { test, expect } from '@playwright/test';

/**
 * Talks to the REAL backend on http://localhost:3000 (no mock). Opt-in: `LOCAL_BACKEND=1 npx playwright test e2e/local-backend.spec.ts`.
 * Needs at least GET /api/meta; everything else degrades silently by design.
 */
test.skip(!process.env['LOCAL_BACKEND'], 'set LOCAL_BACKEND=1 with a backend running on localhost:3000');

test('the app connects to the local backend: /api/meta reaches the app, /diagnostics reflects it, no error toast', async ({ page }) => {
  const seen: string[] = [];
  page.on('request', (r) => { if (r.url().startsWith('http://localhost:3000/')) seen.push(new URL(r.url()).pathname); });
  await page.goto('/diagnostics');
  await expect.poll(() => page.evaluate(() => (window as any).__meta.loaded())).toBe(true);
  expect(seen).toContain('/api/meta');
  const datasets: string[] = await page.evaluate(() => (window as any).__meta.datasets());
  expect(datasets.length).toBeGreaterThan(0);
  for (const d of datasets.filter((x) => ['prices', 'technicals'].includes(x))) await expect(page.locator(`[data-ds="${d}"] .on`)).toBeVisible();
  await expect(page.locator('[data-api-toast]')).toHaveCount(0);
});
