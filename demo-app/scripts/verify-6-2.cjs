// Task 6.2: theme tokens drive shell + chart (light default, opt-in dark), no visual regression.
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const results = [];
  const check = (n, ok, x = '') => { results.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + (x ? ' — ' + x : '')); };
  const errors = [];
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 800 } });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    if (theme === 'dark') await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => document.documentElement.setAttribute('data-theme', 'dark')));
    await page.goto(BASE + '/charts/msft');
    await page.waitForSelector('canvas');
    await page.waitForFunction(() => !document.querySelector('.loading-overlay') && window.__charts && window.__charts.chart);
    for (const [t, per] of [['sma', 20], ['rsi', 14]]) {
      await page.selectOption('select[name="indicatorType"]', t); await page.fill('input[name="indicatorPeriod"]', String(per)); await page.click('[data-add]');
    }
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => {
      const c = window.__charts.chart; const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor, panelBg: getComputedStyle(document.querySelector('.chart-panel')).backgroundColor,
        navBg: getComputedStyle(document.querySelector('nav.navbar')).backgroundImage.slice(0, 60),
        up: c.data.datasets[0].color.up, cssUp: css('--c-up'), grid: c.options.scales.x.grid.color, cssGrid: css('--c-grid'),
        rsiColor: c.data.datasets.find((d) => d.label === 'RSI').borderColor, cssViolet: css('--c-ind-violet'),
        tick: c.options.color, cssMuted: css('--c-text-muted'),
      };
    });
    console.log(theme, JSON.stringify(m));
    check(`${theme}: candle colour comes from --c-up`, m.up === m.cssUp && m.up !== '');
    check(`${theme}: grid + tick colours come from tokens`, m.grid === m.cssGrid && m.tick === m.cssMuted);
    check(`${theme}: RSI line colour resolves the indicator token`, m.rsiColor === m.cssViolet && m.rsiColor !== '');
    if (theme === 'dark') check('dark: page + chart panel backgrounds are dark', /rgb\((15|17), /.test(m.bodyBg) && /rgb\(17, /.test(m.panelBg), `${m.bodyBg} / ${m.panelBg}`);
    else check('light: page background is the light token', /rgb\(248, 249, 250\)/.test(m.bodyBg), m.bodyBg);
    await page.screenshot({ path: path.join(OUT, `6.2-${theme}.png`) });
    await page.close();
  }
  check('console clean', errors.length === 0, errors.slice(0, 2).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
})();
