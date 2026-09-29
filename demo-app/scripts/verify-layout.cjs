// Chart layout redesign verification: ONE panel, page never scrolls, compact navbar,
// aligned axes, smooth pan on the full history, console clean.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const results = [];
  const check = (name, ok, extra = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? ' — ' + extra : '')); };
  const errors = [];

  for (const [w, h] of [[1920, 1080], [1400, 800], [1024, 600], [390, 760]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${w}x${h}: ` + m.text()); });
    page.on('pageerror', (e) => errors.push(`${w}x${h}: ` + e.message));
    await page.goto(BASE + '/charts/msft');
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
    for (const [t, per] of [['sma', 20], ['rsi', 14], ['atr', 14]]) {
      await page.selectOption('select[name="indicatorType"]', t);
      await page.fill('input[name="indicatorPeriod"]', String(per));
      await page.click('[data-add]');
    }
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const de = document.documentElement; const c = window.__charts.chart;
      const nav = document.querySelector('nav.navbar').getBoundingClientRect();
      const cv = c.canvas.getBoundingClientRect();
      return {
        vScroll: de.scrollHeight - innerHeight, hScroll: de.scrollWidth - innerWidth, navH: nav.height,
        canvases: document.querySelectorAll('canvas').length, footer: !!document.querySelector('footer'),
        bottomGap: innerHeight - cv.bottom, cw: cv.width, ch: cv.height,
        left: ['y', 'yVol', 'yInd0', 'yInd1'].map((k) => Math.round(c.scales[k].left)),
        right: ['y', 'yVol', 'yInd0', 'yInd1'].map((k) => Math.round(c.scales[k].right)),
        tops: ['y', 'yVol', 'yInd0', 'yInd1'].map((k) => [Math.round(c.scales[k].top), Math.round(c.scales[k].bottom)]),
      };
    });
    const tag = `${w}x${h}`;
    check(`${tag}: page has NO scrollbar (v=${m.vScroll}, h=${m.hScroll})`, m.vScroll <= 0 && m.hScroll <= 0);
    check(`${tag}: chart fills to the bottom of the viewport (gap ${m.bottomGap}px)`, m.bottomGap >= 0 && m.bottomGap <= 2);
    check(`${tag}: single canvas, no footer`, m.canvases === 1 && !m.footer);
    check(`${tag}: axes aligned in one column`, new Set(m.left).size === 1 && new Set(m.right).size === 1, JSON.stringify(m.left));
    const contiguous = m.tops.every((t, i) => i === 0 || Math.abs(t[0] - m.tops[i - 1][1]) <= 1);
    check(`${tag}: panes are contiguous (no gaps between price/volume/indicators)`, contiguous, JSON.stringify(m.tops));
    if (w === 1400) {
      check(`navbar compact (${m.navH}px)`, m.navH <= 48);
      await page.screenshot({ path: path.join(OUT, 'layout-1400x800.png') });
    }
    if (w === 390) await page.screenshot({ path: path.join(OUT, 'layout-390x760.png') });
    await page.close();
  }

  // other pages keep their normal (scrollable, footer) layout + regular navbar
  const home = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  await home.goto(BASE + '/home');
  await home.waitForSelector('nav.navbar');
  const hm = await home.evaluate(() => ({ nav: document.querySelector('nav.navbar').getBoundingClientRect().height, footer: !!document.querySelector('footer') }));
  check(`home page: full navbar (${hm.nav}px) + footer kept`, hm.nav > 55 && hm.footer);
  await home.close();

  // performance: ALL history (10k bars) + 4 indicators, pan frames
  const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
  page.on('pageerror', (e) => errors.push('perf: ' + e.message));
  await page.goto(BASE + '/charts/msft');
  await page.waitForSelector('canvas');
  await page.waitForFunction(() => !document.querySelector('.loading-overlay'));
  await page.click('.range-btn:has-text("ALL")');
  for (const [t, per] of [['sma', 20], ['ema', 50], ['rsi', 14], ['atr', 14]]) {
    await page.selectOption('select[name="indicatorType"]', t);
    await page.fill('input[name="indicatorPeriod"]', String(per));
    await page.click('[data-add]');
  }
  await page.waitForTimeout(600);
  const perf = await page.evaluate(async () => {
    const c = window.__charts.chart;
    const total = c.data.datasets[0].data.length;
    const frames = []; let last = performance.now();
    await new Promise((res) => { let i = 0; const step = () => { const now = performance.now(); frames.push(now - last); last = now; c.pan({ x: 6 }, undefined, 'none'); if (++i < 60) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
    frames.sort((a, b) => a - b);
    return { pointsInChart: total, median: frames[30], p90: frames[54] };
  });
  check(`ALL history: chart holds a bounded window (${perf.pointsInChart} points, not 10k)`, perf.pointsInChart < 700);
  check(`pan is smooth: median frame ${perf.median.toFixed(1)}ms, p90 ${perf.p90.toFixed(1)}ms (software-rendered headless)`, perf.median < 25 && perf.p90 < 40);
  await page.close();

  check('console clean', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
