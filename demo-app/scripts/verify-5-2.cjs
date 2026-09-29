// Task 5.2 browser verification (updated for the single-panel layout): indicators render as pixels (overlay + stacked oscillator panes), console clean.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const BASE = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const results = [];
  const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };

  await page.goto(BASE + '/charts/msft');
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.loading-overlay'), null, { timeout: 20000 });

  const pixels = (sel) => page.evaluate((s) => {
    const c = document.querySelector(s + ' canvas');
    if (!c || !c.width) return { n: 0, colors: 0 };
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const set = new Set(); let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; if (set.size < 50) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
    return { n, colors: set.size };
  }, sel);
  const addInd = async (type, period) => {
    await page.selectOption('select[name="indicatorType"]', type);
    if (period) await page.fill('input[name="indicatorPeriod"]', String(period));
    await page.click('[data-add]');
    await page.waitForTimeout(600);
  };
  const datasetLabels = () => page.evaluate(() => window.__charts.chart.data.datasets.map((d) => d.label));
  const paneIds = () => page.evaluate(() => Object.keys(window.__charts.chart.scales).filter((k) => /^yInd/.test(k)));

  check('baseline: no indicator rows', (await page.$$('[data-indicator-row]')).length === 0);
  check('baseline: no oscillator panes', (await paneIds()).length === 0);

  await addInd('sma', 20);
  const labels = await datasetLabels();
  check('SMA 20 dataset on price chart', labels.includes('SMA 20'), JSON.stringify(labels));
  await page.screenshot({ path: path.join(OUT, '5.2-sma-overlay.png') });

  await addInd('rsi', 14);
  check('RSI pane present (stacked scale in the same chart)', (await paneIds()).length === 1);
  const rsi = await page.evaluate(() => {
    const ch = window.__charts.chart;
    const vals = ch.data.datasets.find((d) => d.label === 'RSI').data.filter((p) => p.y !== null).map((p) => p.y);
    return { n: vals.length, min: Math.min(...vals), max: Math.max(...vals), ymin: ch.scales.yInd0.min, ymax: ch.scales.yInd0.max, h: ch.scales.yInd0.height };
  });
  check('RSI values in 0-100, axis fixed 0-100, pane has height', rsi.n > 0 && rsi.min >= 0 && rsi.max <= 100 && rsi.ymin === 0 && rsi.ymax === 100 && rsi.h > 40, JSON.stringify(rsi));
  const px = await page.evaluate(() => {
    const ch = window.__charts.chart; const s = ch.scales.yInd0; const c = ch.canvas; const r = c.width / c.clientWidth;
    const d = c.getContext('2d').getImageData(0, Math.round(s.top * r), c.width, Math.round(s.height * r)).data;
    const set = new Set(); let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { n++; if (set.size < 50) set.add(d[i] + ',' + d[i + 1] + ',' + d[i + 2]); }
    return { n, colors: set.size };
  });
  check('RSI pane pixels drawn (count + colour variance)', px.n > 2000 && px.colors >= 2, JSON.stringify(px));

  await addInd('atr', 14);
  check('two oscillator panes (RSI + ATR)', (await paneIds()).length === 2);
  await page.screenshot({ path: path.join(OUT, '5.2-sma-rsi-atr.png'), fullPage: true });

  // persist across reload (sessionStorage state)
  await page.reload();
  await page.waitForSelector('[data-indicator-row]', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('.loading-overlay'), null, { timeout: 20000 });
  check('indicators rehydrate after refresh', (await page.$$('[data-indicator-row]')).length === 3);
  check('panes re-render after refresh', (await paneIds()).length === 2);

  // remove all
  for (let i = 0; i < 3; i++) { await page.click('[data-remove]'); await page.waitForTimeout(300); }
  check('all removed: no panes, only price + volume', (await paneIds()).length === 0 && (await datasetLabels()).join() === 'Price,Volume');

  check('console clean', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
