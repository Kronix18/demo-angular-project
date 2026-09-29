// Tasks 6.1 (navbar Charts link + active state, deep links) and 6.3 (skeleton, error card, retry).
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource|Failed to load chart/.test(m.text())) errors.push(m.text()); });
  const results = [];
  const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
  const active = () => page.$$eval('.nav-links a.active', (as) => as.map((a) => a.textContent.trim()));
  const ready = () => page.waitForFunction(() => !document.querySelector('.loading-overlay') && (document.querySelector('.error-card') || (window.__charts && window.__charts.chart)));

  // 6.1
  await page.goto(BASE + '/home');
  check('home: Home link active', (await active()).join() === 'Home', (await active()).join());
  await page.click('.nav-links a:has-text("Charts")');
  await ready();
  check('click Charts -> /charts/msft, chart rendered', page.url().endsWith('/charts/msft') && (await page.$('canvas:not([hidden])')) !== null);
  check('Charts link active on the chart page', (await active()).join() === 'Charts');
  await page.goto(BASE + '/charts/qqq');
  await ready();
  check('deep link /charts/qqq renders qqq', (await page.$eval('.chart-panel', () => window.__charts.chart.options.scales.y.paneLabel)).startsWith('QQQ'));
  await page.click('.nav-links a:has-text("Pricing")');
  await page.waitForSelector('footer');
  await page.click('.nav-links a:has-text("Charts")');
  await ready();
  check('Charts link reopens the last symbol (qqq)', page.url().endsWith('/charts/qqq'), page.url());

  // 6.3 unknown symbol
  await page.goto(BASE + '/charts/aapl');
  await page.waitForSelector('.error-card');
  const card = await page.textContent('.error-card');
  check('unknown symbol: card names AAPL, lists symbols, has Retry', /AAPL/.test(card) && /msft/.test(card) && /nvda/.test(card) && !!(await page.$('[data-retry]')));
  check('unknown symbol: canvas hidden, no stale chart', (await page.$('canvas[hidden]')) !== null);
  check('toolbar symbol input follows the route (aapl)', (await page.inputValue('#symbol')) === 'aapl', await page.inputValue('#symbol'));
  await page.screenshot({ path: path.join(OUT, '6.3-unknown-symbol.png') });
  await page.click('[data-symbol="nvda"]');
  await ready();
  check('picking nvda from the card loads the chart', (await page.$('.error-card')) === null && page.url().endsWith('/charts/nvda'), page.url());

  // 6.3 skeleton + network failure + retry
  await page.route('**/test-data/msft.us.txt', async (r) => { await new Promise((res) => setTimeout(res, 1200)); r.abort(); });
  await page.goto(BASE + '/charts/msft');
  await page.waitForSelector('.skeleton', { timeout: 5000 });
  check('skeleton shown while loading', true);
  await page.screenshot({ path: path.join(OUT, '6.3-skeleton.png') });
  await page.waitForSelector('.error-card');
  check('network failure -> error card (no stuck loading)', (await page.$('.skeleton')) === null);
  await page.unroute('**/test-data/msft.us.txt');
  await page.click('[data-retry]');
  await ready();
  check('Retry after recovery renders the chart', (await page.$('.error-card')) === null && (await page.$('canvas:not([hidden])')) !== null);

  check('console clean (expected 404/abort noise excluded)', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
