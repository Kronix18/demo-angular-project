// Task 1.3 browser verification — real authGuard wiring + login page fixes.
// Modeled on scripts/verify-1-2.cjs. Run from demo-app/ with `ng serve` on :4200:
//   node scripts/verify-1-3.cjs
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const PORT = process.env.VERIFY_PORT || '4200';
// ng serve may bind IPv4 loopback (127.0.0.1), IPv6 loopback ([::1]), or both
// depending on host/flags — probe each and use whichever answers (env override wins).
const CANDIDATES = (process.env.BASE_URL)
  ? [process.env.BASE_URL]
  : [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, `http://[::1]:${PORT}`];

const probe = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });

const EMAIL = 'admin@demo.angular-project.local';
const PASSWORD = 'changeme';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  let BASE = null;
  for (const candidate of CANDIDATES) {
    if (await probe(candidate)) { BASE = candidate; break; }
  }
  if (!BASE) {
    console.error('FAIL - dev server not reachable on any of: ' + CANDIDATES.join(', '));
    console.error('       start it first:  npx ng serve --port ' + PORT);
    process.exit(1);
  }
  console.log('Using base URL: ' + BASE);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok, detail });
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' | ' + detail : ''));
  };

  // Fresh page => sessionStorage empty => logged out.

  // --- Scenario 1: logged out, /profile redirects to /auth/login?returnUrl=%2Fprofile ---
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
  check('logged-out /profile redirects to /auth/login',
    page.url().includes('/auth/login'), page.url());
  check('redirect carries returnUrl=%2Fprofile',
    page.url().includes('returnUrl=%2Fprofile'), page.url());
  await page.screenshot({ path: path.join(OUT, '1.3-profile-redirect-login.png'), fullPage: true });

  // Login form is actually rendered on the redirected page.
  const loginFormVisible = await page.locator('form').count();
  check('login form rendered after redirect', loginFormVisible > 0);

  // --- Scenario 2: login page nav links point at real routes and navigate ---
  const homeHref = await page.locator('header nav a', { hasText: 'Home' }).first()
    .getAttribute('href').catch(() => null);
  check('login page Home link -> /home', homeHref === '/home', String(homeHref));
  const signUpHref = await page.locator('header nav a', { hasText: 'Sign Up' }).first()
    .getAttribute('href').catch(() => null);
  check('login page Sign Up link -> /auth/register', signUpHref === '/auth/register', String(signUpHref));

  // Click Home, expect /home; then come back to the login page with returnUrl intact.
  await page.locator('header nav a', { hasText: 'Home' }).first().click();
  await page.waitForURL('**/home', { timeout: 5000 }).catch(() => {});
  check('Home link click navigates to /home', page.url().endsWith('/home'), page.url());

  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' }); // re-trigger redirect

  // Sign Up link click should reach the register page.
  await page.locator('header nav a', { hasText: 'Sign Up' }).first().click();
  await page.waitForURL('**/auth/register', { timeout: 5000 }).catch(() => {});
  check('Sign Up link click navigates to /auth/register',
    page.url().includes('/auth/register'), page.url());
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' }); // back once more

  // --- Scenario 3: login with correct creds returns to the guarded route (/profile) ---
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/profile', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500); // let profile page settle
  check('login honors returnUrl: lands back on /profile',
    page.url().includes('/profile') && !page.url().includes('auth'), page.url());
  await page.screenshot({ path: path.join(OUT, '1.3-login-returns-profile.png'), fullPage: true });

  // --- Scenario 4: /screener is protected too ---
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(BASE + '/home', { waitUntil: 'networkidle' }); // logged out now
  await page.goto(BASE + '/screener', { waitUntil: 'networkidle' });
  check('logged-out /screener redirects to /auth/login',
    page.url().includes('/auth/login'), page.url());
  check('/screener redirect carries returnUrl=%2Fscreener',
    page.url().includes('returnUrl=%2Fscreener'), page.url());
  await page.screenshot({ path: path.join(OUT, '1.3-screener-redirect-login.png'), fullPage: true });

  // --- Scenario 5: logged-in user passes the guard on /profile ---
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/', { timeout: 5000 }).catch(() => {});
  await page.goto(BASE + '/profile', { waitUntil: 'networkidle' });
  check('logged-in /profile loads directly (no redirect)',
    page.url().includes('/profile') && !page.url().includes('auth'), page.url());
  await page.screenshot({ path: path.join(OUT, '1.3-loggedin-profile.png'), fullPage: true });

  // Console: no routerLink binding errors or other runtime errors
  // (backend resource failures without a backend are environmental).
  const routerLinkErrors = consoleErrors.filter(e => /routerLink|routerlink/i.test(e));
  check('console: no routerLink binding errors', routerLinkErrors.length === 0,
    routerLinkErrors.join(' ;; ').slice(0, 300));
  const criticalErrors = consoleErrors.filter(
    e => !/Failed to load resource/.test(e) && !/routerLink|routerlink/i.test(e)
  );
  check('console clean (excl. expected backend resource errors)', criticalErrors.length === 0,
    criticalErrors.join(' ;; ').slice(0, 300));

  const fails = results.filter(r => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  console.log('Screenshots: ' + OUT + ' (1.3-*.png)');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
