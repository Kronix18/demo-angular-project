// Task 1.1 browser verification — drives real Chromium against localhost:4200
const { chromium } = require('playwright');
const path = require('path');

const BASE = 'http://127.0.0.1:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  const results = [];
  const check = (name, ok, detail) => { results.push({ name, ok, detail }); console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' | ' + detail : '')); };

  // Scenario 1: logged-out navbar on login page
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  await page.screenshot({ path: path.join(OUT, '1.1-loggedout-login.png') });
  check('login page renders', (await page.locator('h2').count()) > 0, await page.locator('h2').first().textContent().catch(() => ''));
  const loginLinkVisible = await page.locator('a.login-link, .nav-actions a:has-text("Login")').first().isVisible().catch(() => false);
  check('logged-out: Login link visible', loginLinkVisible);

  // Scenario 2: wrong password -> inline error, no navigation
  await page.fill('#email', 'admin@demo.angular-project.local');
  await page.fill('#password', 'wrongpass');
  await page.click('button[type=submit]');
  await page.waitForTimeout(500);
  const errEl = await page.locator('.login-error').count();
  const errText = errEl ? await page.locator('.login-error').textContent() : '';
  const stillOnLogin = page.url().includes('/auth/login');
  await page.screenshot({ path: path.join(OUT, '1.1-wrong-password-error.png') });
  check('wrong password: inline error shown', errEl > 0, String(errText).trim());
  check('wrong password: stays on login page', stillOnLogin, page.url());

  // Scenario 3: correct creds -> navigate home, navbar flips
  await page.fill('#email', 'admin@demo.angular-project.local');
  await page.fill('#password', 'changeme');
  await page.click('button[type=submit]');
  await page.waitForURL('**/', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);
  const logoutVisible = await page.locator('button.logout-btn').isVisible().catch(() => false);
  const badgeVisible = await page.locator('.auth-status').isVisible().catch(() => false);
  const loginGone = (await page.locator('.nav-actions a:has-text("Login")').count()) === 0;
  await page.screenshot({ path: path.join(OUT, '1.1-loggedin-navbar.png'), fullPage: true });
  check('correct creds: Logout button visible', logoutVisible);
  check('correct creds: auth badge visible', badgeVisible);
  check('correct creds: Login link gone', loginGone);

  // Scenario 4: refresh keeps logged-in state (rehydration)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const logoutAfterRefresh = await page.locator('button.logout-btn').isVisible().catch(() => false);
  await page.screenshot({ path: path.join(OUT, '1.1-refresh-rehydrated.png') });
  check('refresh: still logged in (rehydration)', logoutAfterRefresh);

  // Scenario 5: logout returns to logged-out navbar
  await page.click('button.logout-btn').catch(() => {});
  await page.waitForTimeout(700);
  const loginBack = await page.locator('.nav-actions a:has-text("Login")').first().isVisible().catch(() => false);
  const logoutGone = (await page.locator('button.logout-btn').count()) === 0;
  await page.screenshot({ path: path.join(OUT, '1.1-loggedout-again.png') });
  check('logout: Login link back', loginBack);
  check('logout: Logout button gone', logoutGone);

  check('console clean', consoleErrors.length === 0, consoleErrors.join(' ;; ').slice(0, 300));

  const fails = results.filter(r => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
