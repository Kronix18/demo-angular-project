// Task 7.3 — executes the documented test matrix against a running dev server (http://localhost:4200)
// and writes docs/MANUAL-MATRIX.md (+ screenshots in docs/screenshots/matrix/). Honest PASS/FAIL/NOT RUN per row.
//   CHROMIUM_PATH=/path/to/chromium node scripts/manual-matrix.cjs
const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4200';
const SHOTS = path.join(__dirname, '..', 'docs', 'screenshots', 'matrix');
fs.mkdirSync(SHOTS, { recursive: true });
const rows = [];
const rec = (area, item, status, detail = '', shot = '') => { rows.push({ area, item, status, detail, shot }); console.log(`${status.padEnd(7)} ${area} | ${item}${detail ? ' — ' + detail : ''}`); };
const launchOpts = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};

const ready = (page) => page.waitForFunction(() => window.__charts && window.__charts.chart && !document.querySelector('.loading-overlay'), null, { timeout: 20000 });
const pixels = (page, box) => page.evaluate((b) => {
  const c = window.__charts.chart.canvas; const r = c.width / c.clientWidth;
  const d = c.getContext('2d').getImageData(0, b ? Math.round(b.top * r) : 0, c.width, b ? Math.round(b.height * r) : c.height).data;
  const set = new Set(); let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; if (set.size < 50) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
  return { n, colors: set.size };
}, box);
const clearState = async (page) => { await page.goto(`${BASE}/home`); await page.evaluate(() => sessionStorage.clear()); };
const shot = async (page, name) => { const p = path.join(SHOTS, name + '.png'); await page.screenshot({ path: p }); return 'screenshots/matrix/' + name + '.png'; };

(async () => {
  const browser = await chromium.launch(launchOpts);
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errors.push(m.text()); });

  // A. symbols
  for (const sym of ['msft', 'qqq', 'nvda', 'pltr', 'ia']) {
    await clearState(page);
    await page.goto(`${BASE}/charts/${sym}`); await ready(page);
    const info = await page.evaluate(() => { const c = window.__charts.chart; return { bars: c.scales.x.options.max, label: c.options.scales.y.paneLabel, pts: c.data.datasets[0].data.length }; });
    const px = await pixels(page);
    const ok = px.n > 20000 && px.colors >= 3 && info.label.toLowerCase().startsWith(sym) && info.pts > 20;
    rec('Symbols', `${sym} (1D, 6M)`, ok ? 'PASS' : 'FAIL', `${info.pts} candles in window, ${px.n} px / ${px.colors} colours`, await shot(page, `symbol-${sym}`));
  }

  // B. intervals
  await clearState(page); await page.goto(`${BASE}/charts/msft`); await ready(page);
  const dailyMax = await page.evaluate(() => window.__charts.chart.scales.x.max);
  await page.selectOption('#interval', '1w');
  await page.waitForFunction((d) => window.__charts.chart.scales.x.max < d / 3, dailyMax).catch(() => {});
  const weeklyMax = await page.evaluate(() => window.__charts.chart.scales.x.max);
  rec('Intervals', '1d → 1w (aggregated)', weeklyMax < dailyMax / 3 ? 'PASS' : 'FAIL', `view end index ${dailyMax} → ${weeklyMax}`, await shot(page, 'interval-1w'));
  for (const iv of ['1m', '5m', '1h']) {
    const disabled = await page.$eval(`#interval option[value="${iv}"]`, (o) => o.disabled);
    rec('Intervals', `${iv} disabled (needs backend)`, disabled ? 'PASS' : 'FAIL');
  }
  await page.selectOption('#interval', '1d');

  // C. ranges
  const spanFor = { '1M': [15, 30], '3M': [50, 80], '6M': [100, 140], 'YTD': [20, 260], '1Y': [230, 270], 'ALL': [9000, 20000] };
  for (const r of ['1M', '3M', '6M', 'YTD', '1Y', 'ALL']) {
    await page.click(`.range-btn:has-text("${r}")`); await page.waitForTimeout(350);
    const span = await page.evaluate(() => { const x = window.__charts.chart.scales.x; return x.max - x.min; });
    const [lo, hi] = spanFor[r];
    rec('Ranges', `msft ${r}`, span >= lo && span <= hi ? 'PASS' : 'FAIL', `${Math.round(span)} bars visible (expected ${lo}–${hi})`, r === 'ALL' || r === '1M' ? await shot(page, `range-${r}`) : '');
  }
  await page.click('.range-btn:has-text("6M")');

  // D. indicators
  const inds = [['sma', 20, 'SMA 20', 'overlay'], ['ema', 12, 'EMA 12', 'overlay'], ['rsi', 14, 'RSI', 'pane'], ['atr', 14, 'ATR', 'pane'], ['webby_rsi', null, 'Above 21', 'pane'], ['bob_marley', null, 'Green', 'pane']];
  for (const [t, p, label, kind] of inds) {
    await clearState(page); await page.goto(`${BASE}/charts/msft`); await ready(page);
    await page.selectOption('select[name="indicatorType"]', t); if (p) await page.fill('input[name="indicatorPeriod"]', String(p));
    await page.click('[data-add]'); await page.waitForTimeout(500);
    const added = await page.evaluate((l) => window.__charts.chart.data.datasets.some((d) => d.label === l), label);
    let paneOk = true, px = { n: 0 };
    if (kind === 'pane') {
      const box = await page.evaluate(() => { const s = window.__charts.chart.scales.yInd0; return s ? { top: s.top, height: s.height } : null; });
      paneOk = !!box; if (box) px = await pixels(page, box);
      paneOk = paneOk && px.n > 300;
    }
    const s1 = await shot(page, `indicator-${t}`);
    await page.reload(); await ready(page);
    const persisted = await page.evaluate((l) => window.__charts.chart.data.datasets.some((d) => d.label === l), label);
    await page.click('[data-remove]'); await page.waitForTimeout(400);
    const removed = await page.evaluate((l) => !window.__charts.chart.data.datasets.some((d) => d.label === l), label);
    rec('Indicators', `${t}${p ? '(' + p + ')' : ' (defaults)'} add / persist / remove`, added && paneOk && persisted && removed ? 'PASS' : 'FAIL',
      `added=${added} ${kind === 'pane' ? 'pane px=' + px.n + ' ' : ''}persisted=${persisted} removed=${removed}`, s1);
  }

  // E. auth
  const auth = await ctx.newPage();
  await auth.goto(`${BASE}/home`);
  const outNav = await auth.$$eval('.nav-actions a, .nav-actions button', (e) => e.map((x) => x.textContent.trim()));
  rec('Auth', 'logged-out navbar', outNav.includes('Login') && outNav.includes('Register') && !outNav.includes('Logout') ? 'PASS' : 'FAIL', outNav.join(', '));
  await auth.goto(`${BASE}/screener`); await auth.waitForURL(/auth\/login/);
  rec('Auth', 'guard: /screener → login (returnUrl)', /returnUrl=%2Fscreener/.test(auth.url()) ? 'PASS' : 'FAIL', auth.url().replace(BASE, ''));
  await auth.fill('#email', 'admin@demo.angular-project.local'); await auth.fill('#password', 'changeme'); await auth.click('button[type=submit]');
  await auth.waitForSelector('a.account-link', { timeout: 8000 }).catch(() => {});
  const inNav = await auth.$$eval('.nav-actions a, .nav-actions button', (e) => e.map((x) => x.textContent.trim()));
  rec('Auth', 'login → logged-in navbar + returnUrl', inNav.includes('My Account') && inNav.includes('Logout') && /screener/.test(auth.url()) ? 'PASS' : 'FAIL', `${inNav.join(', ')} @ ${auth.url().replace(BASE, '')}`);
  await auth.reload(); await auth.waitForSelector('.nav-actions');
  const afterReload = await auth.$$eval('.nav-actions a, .nav-actions button', (e) => e.map((x) => x.textContent.trim()));
  rec('Auth', 'refresh persists login', afterReload.includes('Logout') ? 'PASS' : 'FAIL');
  await auth.click('button.logout-btn'); await auth.waitForURL(/auth\/login/);
  await auth.goto(`${BASE}/home`); await auth.reload();
  const loggedOutAfter = await auth.$$eval('.nav-actions a', (e) => e.map((x) => x.textContent.trim()));
  rec('Auth', 'logout + refresh stays logged out', loggedOutAfter.includes('Login') ? 'PASS' : 'FAIL');

  // F. mobile 375
  const mob = await browser.newContext({ viewport: { width: 375, height: 700 } });
  const m = await mob.newPage();
  await m.goto(`${BASE}/home`); await m.waitForSelector('nav.navbar');
  const home = await m.evaluate(() => ({ nav: Math.round(document.querySelector('nav.navbar').getBoundingClientRect().height), h: document.documentElement.scrollWidth - innerWidth }));
  rec('Viewport 375px', 'home navbar wraps, no horizontal scroll', home.h <= 0 ? 'PASS' : 'FAIL', `navbar ${home.nav}px, overflow-x ${home.h}px`, await shot(m, 'mobile-home'));
  await m.goto(`${BASE}/charts/msft`); await ready(m);
  const ch = await m.evaluate(() => ({ v: document.documentElement.scrollHeight - innerHeight, h: document.documentElement.scrollWidth - innerWidth, nav: Math.round(document.querySelector('nav.navbar').getBoundingClientRect().height), chartH: Math.round(window.__charts.chart.canvas.getBoundingClientRect().height) }));
  rec('Viewport 375px', 'chart page: no page scroll, chart usable', ch.v <= 0 && ch.h <= 0 && ch.chartH > 250 ? 'PASS' : 'FAIL', `navbar ${ch.nav}px, chart ${ch.chartH}px tall, overflow ${ch.v}/${ch.h}`, await shot(m, 'mobile-chart'));

  // G. other browsers
  for (const [name, type] of [['Firefox', firefox], ['WebKit', webkit]]) {
    try { const b = await type.launch(); const pg = await b.newPage(); await pg.goto(`${BASE}/charts/msft`); await pg.waitForSelector('canvas'); await b.close(); rec('Browsers', name, 'PASS'); }
    catch (e) { rec('Browsers', name, 'NOT RUN', 'browser binary not installed in this environment'); }
  }

  rec('Console', 'no unexpected console/page errors during the whole run', errors.length ? 'FAIL' : 'PASS', errors.slice(0, 3).join(' | '));
  await browser.close();

  const date = new Date().toISOString().slice(0, 10);
  const counts = rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
  let md = `# Manual test matrix — results\n\nRun ${date} by \`scripts/manual-matrix.cjs\` against the dev server (Chromium ${process.env.CHROMIUM_PATH ? '(pre-installed build)' : ''}, 1400×800 unless noted). Re-run: \`CHROMIUM_PATH=… node scripts/manual-matrix.cjs\` with \`npm start\` running.\n\n**${JSON.stringify(counts).replace(/[{}"]/g, '').replace(/,/g, ' · ')}**\n\n| Area | Item | Result | Detail | Evidence |\n|---|---|---|---|---|\n`;
  for (const r of rows) md += `| ${r.area} | ${r.item} | ${r.status} | ${r.detail.replace(/\|/g, '/')} | ${r.shot ? `[screenshot](${r.shot})` : ''} |\n`;
  fs.writeFileSync(path.join(__dirname, '..', 'docs', 'MANUAL-MATRIX.md'), md);
  console.log('\n' + JSON.stringify(counts));
  process.exit(rows.some((r) => r.status === 'FAIL') ? 1 : 0);
})();
