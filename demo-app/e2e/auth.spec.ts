import { test, expect, collectErrors } from './helpers';

const ADMIN = { user: 'admin@demo.angular-project.local', pass: 'changeme' };

test.describe('auth + navbar (1.x)', () => {
  test('logged out: Login/Register shown, protected routes redirect to login with returnUrl', async ({ page }) => {
    await page.goto('/home');
    await expect(page.locator('.nav-actions a', { hasText: 'Login' })).toBeVisible();
    await expect(page.locator('.nav-actions a', { hasText: 'Register' })).toBeVisible();
    await expect(page.locator('button.logout-btn')).toHaveCount(0);
    await page.goto('/profile');
    await expect(page).toHaveURL(/\/auth\/login\?returnUrl=%2Fprofile/);
  });

  test('wrong password shows an inline error and stays logged out', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('#email', ADMIN.user);
    await page.fill('#password', 'nope');
    await page.click('button[type=submit]');
    await expect(page.locator('.login-error')).toBeVisible();
    await expect(page.locator('.nav-actions a', { hasText: 'Login' })).toBeVisible();
  });

  test('login → navbar switches, session survives a refresh, returnUrl honoured, logout works', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/profile');
    await page.fill('#email', ADMIN.user);
    await page.fill('#password', ADMIN.pass);
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator('a.account-link')).toHaveAttribute('title', ADMIN.user);
    await page.reload();
    await expect(page.locator('a.account-link')).toBeVisible();
    await page.click('button.logout-btn');
    await expect(page.locator('.nav-actions a', { hasText: 'Login' })).toBeVisible();
    expect(errors).toEqual([]);
  });
});
