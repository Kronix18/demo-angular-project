// Task 2.1 browser verification — Stooq test data actually served + fetched.
// Modeled on scripts/verify-1-2.cjs / verify-1-3.cjs. Run from demo-app/ with `ng serve` on :4200:
//   node scripts/verify-2-1.cjs
//
// Scope: DATA DELIVERY ONLY. Chart rendering is task 2.2 (Chart.js registration,
// canvas timing) — this script deliberately does NOT assert canvas rendering.
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const PORT = process.env.VERIFY_PORT || '4200';
// ng serve may bind IPv4 loopback (127.0.0.1), IPv6 loopback ([::1]), or both
// depending on host/flags — probe each and use whichever answers (env override wins).
const CANDIDATES = (process.env.BASE_URL)
  ? [process.env.BASE_URL]
  : [`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`, `http://[::1]:${PORT}`];

// Exactly the 8 available symbols (API-BACKEND-SPEC.md) — NO AAPL.
const SYMBOLS = ['ia', 'msft', 'mu', 'nvda', 'pltr', 'qqew', 'qqq', 'qqqe'];

const probe = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });

// GET a URL, resolve { status, body } — used for raw HTTP checks of the data files.
const httpGet = (url) =>
  new Promise((resolve) => {
    const req = http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ status: 0, body: String(e) }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
  });

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

  // --- Scenario 1: every one of the 8 data files is served (200 + real content) ---
  for (const sym of SYMBOLS) {
    const { status, body } = await httpGet(`${BASE}/test-data/${sym}.us.txt`);
    const hasHeader = body.startsWith('<TICKER>,<PER>,<DATE>,<TIME>');
    check(`GET /test-data/${sym}.us.txt -> 200 with Stooq content`,
      status === 200 && hasHeader && body.length > 100,
      `status=${status} bytes=${body.length} header=${hasHeader}`);
  }

  const msft = await httpGet(`${BASE}/test-data/msft.us.txt`);
  const msftRows = msft.body.trim().split(/\r?\n/).length - 1; // minus header
  check('msft.us.txt has thousands of daily rows (from 1986)',
    msftRows > 5000, 'rows=' + msftRows);

  // --- Scenario 2: /charts/msft fetches the data file successfully (200) ---
  const dataResponses = [];
  page.on('response', res => {
    if (res.url().includes('test-data/')) dataResponses.push({ url: res.url(), status: res.status() });
  });

  await page.goto(BASE + '/charts/msft', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500); // let ngOnInit's fetch land

  const msftFetch = dataResponses.filter(r => r.url.includes('msft.us.txt'));
  check('component fetches test-data/msft.us.txt', msftFetch.length > 0,
    JSON.stringify(dataResponses));
  check('data fetch returns 200 (no 404)', msftFetch.some(r => r.status === 200),
    JSON.stringify(msftFetch));

  // --- Scenario 3: in-page fetch('test-data/msft.us.txt') -> 200 (task-file check) ---
  const inPage = await page.evaluate(async () => {
    const res = await fetch('test-data/msft.us.txt');
    const text = await res.text();
    return { status: res.status, firstLine: text.split(/\r?\n/)[0] };
  });
  check("in-page fetch('test-data/msft.us.txt') -> 200",
    inPage.status === 200, `status=${inPage.status} firstLine=${inPage.firstLine}`);

  // Symbol normalization end-to-end: the page asked for the LOWERCASE file even
  // though the route param was 'msft' (guards the old MSFT.US.us.txt 404).
  const askedLowercase = dataResponses.some(r =>
    /\/test-data\/msft\.us\.txt$/.test(new URL(r.url).pathname));
  check('fetched URL is test-data/msft.us.txt (lowercase, no double suffix)',
    askedLowercase, JSON.stringify(dataResponses.map(r => r.url)));

  // --- Scenario 4: no 404s anywhere for test-data (console + network) ---
  const badDataResponses = dataResponses.filter(r => r.status !== 200);
  check('network: no non-200 responses for test-data/*', badDataResponses.length === 0,
    JSON.stringify(badDataResponses));
  const console404s = consoleErrors.filter(e => /test-data/.test(e) && /404|failed/i.test(e));
  check('console: no 404s for test data', console404s.length === 0,
    console404s.join(' ;; ').slice(0, 300));

  await page.screenshot({ path: path.join(OUT, '2.1-charts-msft-data.png'), fullPage: true });

  // Chart-rendering console errors are EXPECTED until task 2.2 lands
  // (Chart.register missing) — report them as info, do not fail on them.
  const chartErrors = consoleErrors.filter(e => !/Failed to load resource/.test(e));
  console.log('\nINFO - non-resource console errors on /charts/msft (2.2 scope, not asserted here):');
  console.log(chartErrors.length ? chartErrors.join('\n').slice(0, 500) : '  (none)');

  const fails = results.filter(r => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  console.log('Screenshots: ' + OUT + ' (2.1-*.png)');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
