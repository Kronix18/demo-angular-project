// Task 1.2 browser verification — navbar composition in both auth states.
// Modeled on scripts/verify-1-1.cjs. Run from demo-app/ with `ng serve` on :4200:
//   node scripts/verify-1-2.cjs
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
  const navLinkTexts = async () =>
    (await page.locator('nav.navbar .nav-links a').allTextContents()).map(t => t.trim());
  const actionTexts = async () =>
    (await page.locator('nav.navbar .nav-actions a, nav.navbar .nav-actions button').allTextContents())
      .map(t => t.trim());

  // --- Scenario 1: logged-out navbar shows the full nav + Login/Register ---
  await page.goto(BASE + '/home', { waitUntil: 'networkidle' });
  const linksLoggedOut = await navLinkTexts();
  check('logged-out: Home link visible', linksLoggedOut.includes('Home'), JSON.stringify(linksLoggedOut));
  check('logged-out: Screener link visible', linksLoggedOut.includes('Screener'));
  check('logged-out: Pricing link visible', linksLoggedOut.includes('Pricing'));

  const actionsLoggedOut = await actionTexts();
  check('logged-out: Login visible', actionsLoggedOut.includes('Login'), JSON.stringify(actionsLoggedOut));
  check('logged-out: Register visible', actionsLoggedOut.includes('Register'));
  check('logged-out: My Account hidden', !actionsLoggedOut.includes('My Account'));
  check('logged-out: Logout hidden', !actionsLoggedOut.includes('Logout'));
  const badgeCountLoggedOut = await page.locator('nav.navbar .auth-status').count();
  check('logged-out: no "Logged In" badge', badgeCountLoggedOut === 0);
  await page.screenshot({ path: path.join(OUT, '1.2-loggedout-navbar.png') });

  // Screener route reachable via the (now ungated) nav link
  await page.locator('nav.navbar .nav-links a', { hasText: 'Screener' }).click();
  await page.waitForTimeout(500);
  check('logged-out: Screener link navigates to /screener', page.url().endsWith('/screener'), page.url());
  await page.goto(BASE + '/home', { waitUntil: 'networkidle' });

  // --- Scenario 2: log in -> My Account (title = email) + Logout, no Login/Register, no badge ---
  await page.goto(BASE + '/auth/login', { waitUntil: 'networkidle' });
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.click('button[type=submit]');
  await page.waitForURL('**/', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(700);

  const accountLink = page.locator('nav.navbar a.account-link');
  check('logged-in: My Account link visible', await accountLink.isVisible().catch(() => false));
  const title = await accountLink.getAttribute('title').catch(() => null);
  check('logged-in: My Account title = user email', title === EMAIL, String(title));
  const accountHref = await accountLink.getAttribute('href').catch(() => null);
  check('logged-in: My Account targets /profile', accountHref === '/profile', String(accountHref));

  const actionsLoggedIn = await actionTexts();
  check('logged-in: Logout button visible', actionsLoggedIn.includes('Logout'), JSON.stringify(actionsLoggedIn));
  check('logged-in: Login hidden', !actionsLoggedIn.includes('Login'));
  check('logged-in: Register hidden', !actionsLoggedIn.includes('Register'));

  const linksLoggedIn = await navLinkTexts();
  check('logged-in: Home/Screener/Pricing still visible',
    ['Home', 'Screener', 'Pricing'].every(l => linksLoggedIn.includes(l)), JSON.stringify(linksLoggedIn));

  const badgeCountLoggedIn = await page.locator('nav.navbar .auth-status').count();
  check('logged-in: "Logged In" badge removed', badgeCountLoggedIn === 0);
  await page.screenshot({ path: path.join(OUT, '1.2-loggedin-navbar.png'), fullPage: true });

  // --- Scenario 3: My Account navigates to /profile ---
  await accountLink.click();
  await page.waitForURL('**/profile', { timeout: 5000 }).catch(() => {});
  check('My Account click navigates to /profile', page.url().includes('/profile'), page.url());
  await page.screenshot({ path: path.join(OUT, '1.2-profile-via-account-link.png') });

  // --- Scenario 4: no inline style attributes in the navbar (design-token rule) ---
  const inlineStyleCount = await page.evaluate(
    () => document.querySelectorAll('nav.navbar [style]').length
  );
  check('navbar: no inline style attributes', inlineStyleCount === 0, 'count=' + inlineStyleCount);

  // --- Scenario 5: logout -> back to /auth/login + logged-out navbar ---
  await page.click('nav.navbar button.logout-btn').catch(() => {});
  await page.waitForURL('**/auth/login', { timeout: 5000 }).catch(() => {});
  check('logout: navigates to /auth/login', page.url().includes('/auth/login'), page.url());
  const actionsAfterLogout = await actionTexts();
  check('logout: Login visible again', actionsAfterLogout.includes('Login'), JSON.stringify(actionsAfterLogout));
  check('logout: My Account gone', !actionsAfterLogout.includes('My Account'));
  check('logout: Logout gone', !actionsAfterLogout.includes('Logout'));
  await page.screenshot({ path: path.join(OUT, '1.2-after-logout.png') });

  // Console: 1.2 scope is the navbar; backend resource failures on /profile
  // (no backend in this env) are environmental, everything else must be clean.
  const criticalErrors = consoleErrors.filter(e => !/Failed to load resource/.test(e));
  check('console clean (excl. expected backend resource errors)', criticalErrors.length === 0,
    criticalErrors.join(' ;; ').slice(0, 300));

  const fails = results.filter(r => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  console.log('Screenshots: ' + OUT + ' (1.2-*.png)');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
