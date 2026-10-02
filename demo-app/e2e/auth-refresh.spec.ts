import { test, expect } from '@playwright/test';
import { mockApi } from './mock-api';

/** Task 12.4 browser proof: an expired access token is refreshed transparently and the request replayed. */
test('expired token: 401 -> POST /api/auth/refresh -> replay with the new token; no toast, user stays logged in', async ({ page }) => {
  const seen: { path: string; auth: string | null }[] = [];
  await page.addInitScript(() => {
    sessionStorage.setItem('isLoggedIn', 'true'); sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local');
    localStorage.setItem('auth_token', 'old-token'); localStorage.setItem('auth_refresh_token', 'r1');
  });
  page.on('request', (r) => { if (r.url().includes('/api/')) seen.push({ path: new URL(r.url()).pathname, auth: r.headers()['authorization'] ?? null }); });
  await mockApi(page, { expiredTokens: ['old-token'] });
  await page.goto('/screener');
  await expect.poll(() => seen.filter((s) => s.path === '/api/screener/run' && s.auth === 'Bearer new-token').length).toBeGreaterThanOrEqual(1);
  // whichever request (meta or screener) hit the expired token first, exactly ONE refresh served them all
  expect(seen.some((s) => s.auth === 'Bearer old-token')).toBe(true);
  expect(seen.filter((s) => s.path === '/api/auth/refresh')).toHaveLength(1);
  await expect(page.locator('[data-api-toast]')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('auth_token'))).toBe('new-token');
  await expect(page.locator('a.account-link')).toBeVisible();
});
