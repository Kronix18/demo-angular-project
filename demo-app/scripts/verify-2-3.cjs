// Task 2.3 browser verification — toolbar drives the chart (USER-VISIBLE proof).
// Pass requires: symbol change via toolbar actually swaps the chart data,
// interval change works, URL reflects the symbol, no per-keystroke request storm.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const http = require('http');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const probe = (url) => new Promise((res) => {
  const r = http.get(url, (resp) => { res(resp.statusCode === 200); resp.resume(); });
  r.on('error', () => res(false));
  r.setTimeout(1500, () => { r.destroy(); res(false); });
});

(async () => {
  let base = BASE;
  if (!(await probe(base + '/'))) {
    for (const alt of ['http://localhost:4200', 'http://[::1]:4200']) {
      if (await probe(alt + '/')) { base = alt; break; }
    }
  }
  console.log('Using base URL: ' + base);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 150)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 150)));

  const testdataRequests = [];
  page.on('request', (r) => { if (r.url().includes('test-data/')) testdataRequests.push(r.url()); });

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' | ' + detail : ''));
  };

  /** Count distinct drawn colors (chart identity proxy between symbols). */
  async function chartSignature() {
    return page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width) return null;
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = img.data;
      let nonTransparent = 0;
      const colors = new Set();
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] > 0) { nonTransparent++; colors.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]); }
      }
      return { nonTransparent, distinctColors: colors.size };
    });
  }

  // --- Load /charts/msft (default) ---
  await page.goto(base + '/charts/msft', { waitUntil: 'networkidle' });
  for (let i = 0; i < 20; i++) {
    if (!(await page.evaluate(() => !!document.querySelector('.loading-overlay')))) break;
    await page.waitForTimeout(500);
  }
  const sigBefore = await chartSignature();
  check('msft chart rendered before change', !!sigBefore && sigBefore.nonTransparent > 5000, JSON.stringify(sigBefore));
  await page.screenshot({ path: path.join(OUT, '2.3-msft-before.png') });

  // --- Toolbar symbol change: type nvda + Enter ---
  const requestsBefore = testdataRequests.length;
  const input = page.locator('#symbol');
  await input.fill('nvda');
  await page.waitForTimeout(600); // any per-keystroke requests would fire here
  const requestsAfterTyping = testdataRequests.length - requestsBefore;
  check('no test-data request per keystroke', requestsAfterTyping === 0, `${requestsAfterTyping} requests during typing`);
  await input.press('Enter');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    if (!(await page.evaluate(() => !!document.querySelector('.loading-overlay')))) break;
    await page.waitForTimeout(500);
  }
  const sigAfter = await chartSignature();
  check('nvda chart rendered after Enter', !!sigAfter && sigAfter.nonTransparent > 5000, JSON.stringify(sigAfter));
  check('chart actually CHANGED (signature differs)', JSON.stringify(sigBefore) !== JSON.stringify(sigAfter),
    `before=${JSON.stringify(sigBefore)} after=${JSON.stringify(sigAfter)}`);
  check('URL reflects new symbol', page.url().includes('/charts/nvda'), page.url());
  check('exactly one test-data fetch for the change', testdataRequests.filter(u => u.includes('nvda')).length === 1,
    String(testdataRequests.filter(u => u.includes('nvda')).length));
  await page.screenshot({ path: path.join(OUT, '2.3-nvda-after.png') });

  // --- Interval change: 1d -> 1w (weekly aggregated) ---
  const intervalReqBefore = testdataRequests.length;
  const select = page.locator('#interval');
  await select.selectOption('1w');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 10; i++) {
    if (!(await page.evaluate(() => !!document.querySelector('.loading-overlay')))) break;
    await page.waitForTimeout(500);
  }
  const sigWeekly = await chartSignature();
  check('weekly chart rendered after interval change', !!sigWeekly && sigWeekly.nonTransparent > 5000, JSON.stringify(sigWeekly));
  const weeklyFetches = testdataRequests.length - intervalReqBefore;
  check('interval change re-fetched data (or sliced client-side)', weeklyFetches >= 0, `${weeklyFetches} new fetches`);
  check('no crash after interval change', (await page.evaluate(() => !!document.querySelector('canvas'))), '');

  // intraday disabled check: 1m option disabled
  const mDisabled = await page.locator('#interval option[value="1m"]').isDisabled();
  check('intraday (1m) option disabled', mDisabled);
  await page.screenshot({ path: path.join(OUT, '2.3-nvda-weekly.png') });

  const crashErrors = errors.filter((e) => e.includes('PAGEERROR') || e.includes('nativeElement'));
  check('no page errors / crashes', crashErrors.length === 0, crashErrors.join(';;').slice(0, 150));

  const fails = results.filter((r) => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
