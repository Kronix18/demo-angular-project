// Task 2.2 browser verification — PIXEL-LEVEL rendering proof (Kevin's tightened standard).
// A pass REQUIRES: canvas in DOM + nonzero size + drawn chart pixels (count AND color
// variance) + loading gone + no nativeElement crash + checked on TWO symbols.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4200';
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  // probe host reachability (dev server may bind IPv6 on this host)
  const http = require('http');
  const probe = (url) => new Promise((res) => {
    const r = http.get(url, (resp) => { res(resp.statusCode === 200); resp.resume(); });
    r.on('error', () => res(false));
    r.setTimeout(1500, () => { r.destroy(); res(false); });
  });
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
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message.slice(0, 200)));

  const results = [];
  const check = (name, ok, detail) => {
    results.push({ name, ok });
    console.log((ok ? 'PASS' : 'FAIL') + ' - ' + name + (detail ? ' | ' + detail : ''));
  };

  /** Pixel-level chart proof: canvas present, nonzero, non-trivial drawn content. */
  async function assertRenderedPixels(symbol) {
    await page.goto(base + '/charts/' + symbol, { waitUntil: 'networkidle' });
    // bounded wait for data + render (loading overlay must disappear)
    for (let i = 0; i < 20; i++) {
      const loading = await page.evaluate(() => !!document.querySelector('.loading-overlay'));
      if (!loading) break;
      await page.waitForTimeout(500);
    }
    const state = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { canvasPresent: false };
      const w = canvas.clientWidth, h = canvas.clientHeight;
      const loading = !!document.querySelector('.loading-overlay');
      const error = document.querySelector('.error-message')?.textContent || null;
      // pixel proof: sample the full backing store
      let ctx;
      try { ctx = canvas.getContext('2d'); } catch { return { canvasPresent: true, ctxFail: true }; }
      if (!ctx) return { canvasPresent: true, noCtx: true };
      const bw = canvas.width, bh = canvas.height;
      if (!bw || !bh) return { canvasPresent: true, zeroBacking: true, w, h };
      let img;
      try { img = ctx.getImageData(0, 0, bw, bh); } catch { return { canvasPresent: true, imgFail: true, bw, bh }; }
      const d = img.data;
      let nonTransparent = 0;
      const colors = new Set();
      for (let i = 0; i < d.length; i += 16) { // sample every 4th pixel
        if (d[i + 3] > 0) {
          nonTransparent++;
          colors.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
        }
      }
      return {
        canvasPresent: true, w, h, bw, bh, loading, error,
        nonTransparent, distinctColors: colors.size,
      };
    });

    check(symbol + ': canvas in DOM', !!state.canvasPresent);
    if (!state.canvasPresent) return;
    check(symbol + ': canvas nonzero size', (state.w > 50 && state.h > 50), state.w + 'x' + state.h);
    check(symbol + ': loading overlay GONE after data', state.loading === false, state.loading ? 'STUCK' : 'gone');
    check(symbol + ': no error banner', !state.error, state.error || 'clean');
    check(symbol + ': drawn pixels > 5000', state.nonTransparent > 5000, String(state.nonTransparent));
    check(symbol + ': color variance > 8 distinct', state.distinctColors > 8, String(state.distinctColors) + ' colors');
    await page.screenshot({ path: path.join(OUT, '2.2-candles-' + symbol + '.png'), fullPage: true });
  }

  await assertRenderedPixels('msft');
  await assertRenderedPixels('qqq');

  const crashErrors = errors.filter((e) => e.includes('nativeElement') || e.includes('PAGEERROR'));
  check('no nativeElement crash / page errors', crashErrors.length === 0, crashErrors.join(' ;; ').slice(0, 200));
  const otherErrors = errors.filter((e) => !e.includes('nativeElement') && !e.includes('Failed to load resource'));
  check('console clean (excl. expected backend 404s)', otherErrors.length === 0, otherErrors.join(' ;; ').slice(0, 200));

  const fails = results.filter((r) => !r.ok).length;
  console.log('\n=== SUMMARY: ' + (results.length - fails) + '/' + results.length + ' passed ===');
  await browser.close();
  process.exit(fails ? 1 : 0);
})();
