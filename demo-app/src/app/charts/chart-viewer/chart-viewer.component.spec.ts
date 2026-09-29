import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChartViewerComponent } from './chart-viewer.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Chart } from 'chart.js';
import { Subject, of, throwError } from 'rxjs';
import { ChartStateService } from '../../core/services/chart-state.service';
import '../chart-setup'; // registerables + adapter + zoom + financial controllers (correct order)

// jsdom has no ResizeObserver; Chart.js responsive mode requires one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

/** Proxy-based fake 2d context: absorbs every method call (jsdom has no canvas impl).
 *  Returns itself for chained calls and provides sane getters — mirrors what
 *  Chart.js needs from a real 2d context. */
function fakeCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { canvas };
  const proxy = new Proxy(target, {
    get(t, p) {
      if (p === 'canvas') return t['canvas'];
      // Chart.js may pass a CONTEXT (not a canvas) as the item; acquireContext
      // then calls item.getContext('2d') — return this proxy (idempotent).
      if (p === 'getContext') return () => proxy;
      if (p === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 5 });
      if (p === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern')
        return () => ({ addColorStop: () => {} });
      if (p === 'save' || p === 'restore' || p === 'translate' || p === 'scale') return () => {};
      return () => {};
    },
    set() { return true; },
  }) as unknown as CanvasRenderingContext2D;
  return proxy;
}

describe('ChartViewerComponent — chart.js registration & canvas timing (task 2.2)', () => {
  let fixture: ComponentFixture<ChartViewerComponent>;
  let component: ChartViewerComponent;
  let httpMock: HttpTestingController;

  // Real Stooq format: header line FIRST (the parser skips lines[0] as the
  // header) — without it the first DATA row is eaten as the header (caught
  // by 3.1's RED spec: 3 rows in, 2 points on the chart, oldest missing).
  const MSFT_ROWS = [
    '<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>',
    'MSFT.US,D,20240110,000000,100,110,95,105,1000,0',
    'MSFT.US,D,20240111,000000,105,115,100,112,1200,0',
    'MSFT.US,D,20240112,000000,112,120,108,118,900,0',
  ].join('\r\n');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartViewerComponent, FormsModule],
      providers: [
        // Fresh ActivatedRoute per test — params: of(...) completes after one
        // emission, so the component's ngOnInit subscription does NOT leak
        // across tests (a Subject would stay live and re-fire).
        { provide: ActivatedRoute, useValue: { params: of({ symbol: 'MSFT' }) } },
        { provide: Router, useValue: { navigate: vi.fn().mockResolvedValue(true) } },
        provideHttpClient(withFetch()),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChartViewerComponent);
    component = fixture.componentInstance;
  });

  /** Stub getContext on BOTH pane canvases AFTER first detectChanges so we
   *  stub the exact DOM nodes Angular's viewChildren bind to. Returns the
   *  price pane canvas (the first). */
  function stubCanvas(): HTMLCanvasElement {
    fixture.detectChanges(); // first render — canvases now in DOM (2.2 fix)
    const canvases = Array.from(
      fixture.nativeElement.querySelectorAll('canvas')
    ) as HTMLCanvasElement[];
    expect(canvases.length).toBeGreaterThanOrEqual(1);
    for (const c of canvases) {
      c.getContext = (() => fakeCtx(c)) as unknown as typeof c.getContext;
    }
    return canvases[0];
  }

  afterEach(() => {
    // Destroy the fixture FIRST (runs ngOnDestroy, tears down the chart),
    // then flush any request the http testing controller still holds, then
    // verify — order matters, verify() fails on open requests.
    fixture.destroy();
    try {
      httpMock.expectOne((r) => r.url.includes('test-data/')).flush([]);
    } catch {
      /* no open request — fine */
    }
    httpMock.verify();
  });

  it('has the canvas element in the DOM from first render (even while loading)', () => {
    expect(component.loading).toBe(true);
    fixture.detectChanges();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy(); // canvas NOT hidden behind *ngIf — 2.2 timing fix
    expect(component.loading).toBe(true); // still loading — data not yet flushed
  });

  it('registers financial + core controllers, scales, adapter, zoom at module scope', () => {
    const has = (fn: () => void) => { try { fn(); return true; } catch { return false; } };
    expect(has(() => Chart.registry.getController('candlestick'))).toBe(true);
    expect(has(() => Chart.registry.getScale('time'))).toBe(true);
    expect(has(() => Chart.registry.getScale('linear'))).toBe(true);
    expect(has(() => Chart.registry.getPlugin('zoom'))).toBe(true);
  });

  it('constructs a real Chart instance when data arrives (no nativeElement crash)', async () => {
    const canvasEl = stubCanvas();
    // sanity: my stub must be live on this exact node, and the price pane's
    // viewChild must be THIS node (pane[0] = price)
    expect(canvasEl.getContext('2d')).toBeTruthy();
    expect(component.chartCanvas?.nativeElement).toBe(canvasEl);
    // ngOnInit already auto-loaded on create; flush that request first.
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    await fixture.whenStable();
    const instance = Chart.getChart(canvasEl);
    expect(instance).toBeTruthy(); // chart actually constructed
    expect(Object.keys((instance as any).scales)).toContain('x');
    expect(Object.keys((instance as any).scales)).toContain('y');
  });

  /** Flushes the msft request and returns the single panel chart. */
  async function loaded(): Promise<any> {
    stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    fixture.detectChanges();
    return Chart.getChart(component.chartCanvas!.nativeElement) as any;
  }

  it('ONE PANEL: price, volume in a single canvas/chart with stacked y-scales (layout redesign)', async () => {
    const chart = await loaded();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('canvas').length).toBe(1);
    expect(chart).toBeTruthy();
    const kinds = chart.data.datasets.map((d: any) => d.type);
    expect(kinds).toEqual(['candlestick', 'bar']);
    // price + volume live on stacked y-scales of the same stack -> one panel
    const y = chart.options.scales.y;
    const yVol = chart.options.scales.yVol;
    expect(y.stack).toBe('panel');
    expect(yVol.stack).toBe('panel');
    expect(y.stackWeight).toBeGreaterThan(yVol.stackWeight);
    expect(y.position).toBe('right');
    expect(yVol.position).toBe('right');
    // a single x-axis (dates at the bottom of the whole panel)
    expect(Object.keys(chart.scales).filter((k) => k.startsWith('x'))).toEqual(['x']);
    expect(chart.options.scales.x.position).toBe('bottom');
  });

  it('volume: bar dataset on its own y-scale that begins at zero', async () => {
    const chart = await loaded();
    const vol = chart.data.datasets.find((d: any) => d.label === 'Volume');
    expect(vol.yAxisID).toBe('yVol');
    expect(chart.options.scales.yVol.min).toBe(0);
    expect(chart.options.scales.yVol.beginAtZero).toBe(true);
  });

  it('volume values map each bar (ASC), x = bar index, aligned with the candles', async () => {
    const chart = await loaded();
    const price = chart.data.datasets[0].data;
    const vol = chart.data.datasets[1].data;
    expect(vol.length).toBe(price.length);
    expect(vol.length).toBe(3);
    expect(vol[0]).toMatchObject({ x: 0, y: 1000 });
    expect(vol[2]).toMatchObject({ x: 2, y: 900 });
    expect(price.map((p: any) => p.x)).toEqual(vol.map((p: any) => p.x));
  });

  it('ZOOM: wheel + pan enabled on x with data limits (3.2)', async () => {
    const chart = await loaded();
    const zoomOpts = chart.options.plugins?.zoom;
    expect(zoomOpts.zoom?.wheel?.enabled).toBe(true);
    expect(zoomOpts.pan?.enabled).toBe(true);
    expect(zoomOpts.zoom.mode).toBe('x');
    const lim = zoomOpts.limits.x;
    expect(lim.min).toBeLessThanOrEqual(chart.scales.x.min);
    expect(lim.max).toBeGreaterThanOrEqual(chart.scales.x.max);
  });

  it('ZOOM: reset button calls resetZoom on the panel chart (3.2)', async () => {
    const chart = await loaded();
    const btn = fixture.nativeElement.querySelector('.reset-zoom-btn') as HTMLButtonElement;
    expect(btn).toBeTruthy();
    const spy = vi.spyOn(chart, 'resetZoom');
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('ZOOM: zooming moves the single x-range; y-axes refit to the visible bars', async () => {
    const chart = await loaded();
    const last = chart.data.datasets[0].data.length - 1;
    chart.zoomScale('x', { min: 2, max: last });
    expect(chart.scales.x.min).toBe(2);
    // only bar 2 (+1 bar of margin) is visible: y must fit its low/high, not bar 0's (95)
    expect(chart.scales.y.min).toBeGreaterThan(95);
    expect(chart.scales.y.max).toBeGreaterThanOrEqual(120);
  });

  it('CROSSHAIR: plugin registered and enabled on the panel chart (3.3)', async () => {
    const chart = await loaded();
    expect(Chart.registry.getPlugin('crosshair')).toBeTruthy();
    expect(chart.options.plugins?.crosshair).toBe(true);
  });

  it('TOOLTIP: one index tooltip renders O/H/L/C, Vol and indicator labels (3.3)', async () => {
    const chart = await loaded();
    const label = chart.options.plugins?.tooltip?.callbacks?.label;
    const [price, vol] = chart.data.datasets;
    const out = label({ dataset: price, raw: price.data[0] });
    expect(out).toContain('O 100.00');
    expect(out).toContain('H 110.00');
    expect(out).toContain('L 95.00');
    expect(out).toContain('C 105.00');
    expect(label({ dataset: vol, raw: vol.data[0] })).toContain('1K');
    expect(label({ dataset: { type: 'line', label: 'SMA 5' }, raw: { y: 1.234 } })).toBe('SMA 5 1.23');
    expect(chart.options.plugins.tooltip.mode).toBe('index');
  });

  it('LINEAR INDEX AXIS: evenly-spaced bars, no weekend slots (4.3+fix)', async () => {
    const chart = await loaded();
    expect(chart.scales['x'].type).toBe('linear');
    const first = chart.data.datasets[0].data[0];
    expect(first.x).toBe(0);
    expect(first.t).toBeTruthy();
    const ts = chart.data.datasets[0].data.map((p: any) => p.t);
    for (let i = 1; i < ts.length; i++) expect(ts[i]).toBeGreaterThan(ts[i - 1]);
  });

  it('VOLUME COLORS: up bars green, down bars red (per-bar scriptable colour, from theme tokens)', async () => {
    // jsdom loads no stylesheet: provide the theme tokens the chart reads at draw time
    document.documentElement.style.setProperty('--c-up', 'rgb(0, 200, 0)');
    document.documentElement.style.setProperty('--c-down', 'rgb(200, 0, 0)');
    const chart = await loaded();
    const ds = chart.data.datasets[1];
    expect(typeof ds.backgroundColor).toBe('function');
    const upC = ds.backgroundColor({ raw: { up: true } });
    const downC = ds.backgroundColor({ raw: { up: false } });
    expect(upC).toBe('rgb(0, 200, 0)');
    expect(downC).toBe('rgb(200, 0, 0)');
    document.documentElement.style.removeProperty('--c-up');
    document.documentElement.style.removeProperty('--c-down');
    // MSFT_ROWS bar 0: open 100 close 105 -> up
    expect(ds.data[0].up).toBe(true);
  });

  it('LOD: a long history is windowed/aggregated — the chart never holds every bar', async () => {
    stubCanvas();
    const rows = ['<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>'];
    for (let i = 0; i < 6000; i++) {
      const d = new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, '');
      const c = 100 + Math.sin(i / 20) * 10;
      rows.push(`MSFT.US,D,${d},000000,${c - 1},${c + 2},${c - 2},${c},${1000 + i},0`);
    }
    const st = TestBed.inject(ChartStateService);
    st.setRange('ALL');
    httpMock.expectOne('test-data/msft.us.txt').flush(rows.join('\r\n'));
    await fixture.whenStable();
    const chart: any = Chart.getChart(component.chartCanvas!.nativeElement);
    const pts = chart.data.datasets[0].data.length;
    expect(pts).toBeGreaterThan(50);
    expect(pts).toBeLessThan(700); // 6000 bars -> aggregated
    // zoomed in: full resolution (1 bar per point) within a small window
    chart.zoomScale('x', { min: 2000, max: 2100 });
    expect(chart.data.datasets[0].data.length).toBeLessThanOrEqual(300);
    expect(chart.data.datasets[0].data[1].x - chart.data.datasets[0].data[0].x).toBe(1);
    // and panning far away loads the new window
    chart.zoomScale('x', { min: 5000, max: 5100 });
    const xs = chart.data.datasets[0].data.map((p: any) => p.x);
    expect(Math.min(...xs)).toBeLessThanOrEqual(5000);
    expect(Math.max(...xs)).toBeGreaterThanOrEqual(5100);
  });

  it('createChart guards against a missing canvas reference (no crash)', () => {
    (component as any).chartCanvas = undefined;
    expect(() => (component as any).createChart([])).not.toThrow();
  });

  it('error path: 500 → service fallback → "No data available" (no stuck loading)', async () => {
    fixture.detectChanges();
    // ngOnInit already auto-loaded on create; fail that request.
    // NOTE: ChartDataService's design (2.1) catches HTTP errors and falls back
    // to [] — so a 500 yields the "No data available" error message, not the
    // catch-path message. Either way: loading must finalize, error must show.
    httpMock
      .expectOne('test-data/msft.us.txt')
      .flush('server exploded', { status: 500, statusText: 'Server Error' });
    expect(component.loading).toBe(false);
    expect(component.error).toBeTruthy();
    await fixture.whenStable(); // settle pending tasks first...
    fixture.detectChanges(); // ...then force the @if(error) re-render (no NG0100: state settled)
    const errEl = fixture.nativeElement.querySelector('.error-message');
    expect(errEl).toBeTruthy();
  });

  describe('plugins, weekly view and edge paths (coverage gate 7.1)', () => {
    const fakeChart = (extra: Record<string, unknown> = {}): any => {
      const calls: string[] = [];
      const ctx = new Proxy({}, { get: (_t, p) => (..._a: unknown[]) => { calls.push(String(p)); }, set: () => true });
      return { calls, ctx, chartArea: { left: 0, right: 100, top: 0, bottom: 50 }, tooltip: { getActiveElements: () => [] }, scales: {}, ...extra };
    };
    const plugin = (id: string) => Chart.registry.getPlugin(id) as any;

    it('crosshair: tracks mousemove/mouseout and draws only inside the chart area', () => {
      const p = plugin('crosshair');
      const c = fakeChart();
      p.afterEvent(c, { event: { type: 'mousemove', x: 40 } });
      expect(c.$crosshairX).toBe(40);
      p.afterDatasetsDraw(c);
      expect(c.calls).toContain('stroke');
      p.afterEvent(c, { event: { type: 'mouseout' } });
      expect(c.$crosshairX).toBeNull();
      const drawn = c.calls.length;
      p.afterDatasetsDraw(c); // nothing hovered -> nothing drawn
      expect(c.calls.length).toBe(drawn);
      p.afterEvent(c, { event: { type: 'mousemove', x: 500 } }); // outside the area
      p.afterDatasetsDraw(c);
      expect(c.calls.length).toBe(drawn);
      const snapped = fakeChart({ tooltip: { getActiveElements: () => [{ element: { x: 25 } }] } });
      p.afterDatasetsDraw(snapped);
      expect(snapped.calls).toContain('moveTo');
    });

    it('paneDecor: separators above every pane but the first, plus pane labels', () => {
      const p = plugin('paneDecor');
      const texts: string[] = [];
      const c = fakeChart({
        ctx: new Proxy({}, { get: (_t, prop) => (...a: unknown[]) => { if (prop === 'fillText') texts.push(String(a[0])); }, set: () => true }),
        scales: {
          x: { top: 0, options: {} },
          y: { top: 0, options: { paneLabel: 'MSFT' } },
          yVol: { top: 30, options: { paneLabel: 'Volume' } },
          yInd0: { top: 40, options: {} },
        },
      });
      p.afterDraw(c);
      expect(texts).toEqual(['MSFT', 'Volume']);
      p.afterDraw({ ...c, ctx: null }); // no context: no crash
    });

    it('tooltip: title is the bar date, dashed guide lines are filtered out', async () => {
      const chart: any = await loaded();
      const tt = chart.options.plugins.tooltip;
      expect(tt.callbacks.title([{ parsed: { x: 0 } }])).toMatch(/Jan 10, 24/);
      expect(tt.callbacks.title([])).toBeTruthy();
      expect(tt.filter({ dataset: { borderDash: [6, 4] } })).toBe(false);
      expect(tt.filter({ dataset: { borderDash: [] } })).toBe(true);
      expect(tt.filter({ dataset: {} })).toBe(true);
    });

    it('weekly interval aggregates the whole file into W-FRI bars', async () => {
      stubCanvas();
      const rows = ['<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>'];
      for (let i = 0; i < 60; i++) {
        const d = new Date(Date.UTC(2024, 0, 1 + i));
        if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
        rows.push(`MSFT.US,D,${d.toISOString().slice(0, 10).replace(/-/g, '')},000000,100,110,95,105,1000,0`);
      }
      const st = TestBed.inject(ChartStateService);
      st.setRange('ALL');
      st.setInterval('1w');
      // the initial load and the interval-change reload are both in flight
      const reqs = httpMock.match('test-data/msft.us.txt');
      expect(reqs.length).toBe(2);
      reqs.forEach((r) => r.flush(rows.join('\r\n')));
      await fixture.whenStable();
      const chart: any = Chart.getChart(component.chartCanvas!.nativeElement);
      const pts = chart.data.datasets[0].data;
      expect(pts.length).toBeGreaterThan(5);
      expect(pts.length).toBeLessThan(15); // ~9 weeks, not ~43 days
      expect(chart.data.datasets[1].data[0].y).toBeGreaterThan(1000); // summed weekly volume
    });

    it('resetZoom survives a throwing plugin; syncView ignores a chart with no bars loaded', async () => {
      const chart: any = await loaded();
      vi.spyOn(chart, 'resetZoom').mockImplementation(() => { throw new Error('boom'); });
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      expect(() => component.resetZoom()).not.toThrow();
      expect(err).toHaveBeenCalled();
      err.mockRestore();
      (component as any).bars = [];
      expect(() => (component as any).syncView(chart)).not.toThrow();
    });

    it('a failing request (HTTP error path of the service) surfaces the failed state', async () => {
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
      await fixture.whenStable();
      vi.spyOn((component as any).chartDataService, 'getOHLCV').mockReturnValue(throwError(() => new Error('x')));
      const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      component.loadChartData('msft', '1d');
      expect(component.errorKind).toBe('failed');
      expect(component.loading).toBe(false);
      err.mockRestore();
    });

    it('rehydrated unknown indicator types are skipped, not fatal', async () => {
      sessionStorage.clear();
      const st = TestBed.inject(ChartStateService);
      st.addIndicator({ type: 'sma', period: 5 });
      st.addIndicator({ type: 'bogus', period: 3 });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const chart: any = await loaded();
      expect(chart.data.datasets.map((d: any) => d.label)).toEqual(expect.arrayContaining(['SMA 5']));
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('error & loading states (6.3)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;

    it('shows a skeleton (not stale content) while loading, gone afterwards', async () => {
      fixture.detectChanges();
      expect(q('.skeleton')).toBeTruthy();
      httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q('.skeleton')).toBeNull();
    });

    it('unknown symbol: names the symbol, lists available symbols, offers Retry; no chart instance', async () => {
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
      await fixture.whenStable();
      component.loadChartData('aapl', '1d');
      httpMock.expectOne('test-data/aapl.us.txt').flush('nope', { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();
      fixture.detectChanges();
      const card = q('.error-card');
      expect(card).toBeTruthy();
      expect(card!.textContent).toContain('AAPL');
      for (const sym of ['msft', 'qqq', 'nvda']) expect(card!.textContent).toContain(sym);
      expect(q('[data-retry]')).toBeTruthy();
      expect(Chart.getChart(component.chartCanvas!.nativeElement)).toBeUndefined();
      expect(q('canvas')!.hasAttribute('hidden')).toBe(true);
    });

    it('Retry re-invokes the load for the failed symbol', async () => {
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
      await fixture.whenStable();
      component.loadChartData('aapl', '1d');
      httpMock.expectOne('test-data/aapl.us.txt').flush('x', { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();
      fixture.detectChanges();
      (q('[data-retry]') as HTMLButtonElement).click();
      const retried = httpMock.expectOne('test-data/aapl.us.txt');
      retried.flush('x', { status: 404, statusText: 'Not Found' });
    });

    it('clicking an available symbol in the error card switches the chart to it', async () => {
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
      await fixture.whenStable();
      component.loadChartData('aapl', '1d');
      httpMock.expectOne('test-data/aapl.us.txt').flush('x', { status: 404, statusText: 'Not Found' });
      await fixture.whenStable();
      fixture.detectChanges();
      const st = TestBed.inject(ChartStateService);
      const btn = Array.from(fixture.nativeElement.querySelectorAll('[data-symbol]')).find(
        (b) => (b as HTMLElement).dataset['symbol'] === 'qqq') as HTMLButtonElement;
      btn.click();
      expect(st.snapshot().symbol).toBe('qqq');
      httpMock.expectOne('test-data/qqq.us.txt').flush(MSFT_ROWS);
    });

    it('known symbol with an empty file says "No data" (not "unknown symbol")', async () => {
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush('<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q('.error-card')!.textContent).toMatch(/no data/i);
      expect(q('.error-card')!.textContent).not.toMatch(/unknown symbol/i);
    });
  });

  describe('indicators on the chart (5.2)', () => {
    const rows = (n: number) => {
      const out = ['<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>'];
      for (let i = 0; i < n; i++) {
        const d = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, '');
        const c = 100 + Math.sin(i / 3) * 5 + i * 0.2;
        out.push(`MSFT.US,D,${d},000000,${c - 1},${c + 2},${c - 2},${c},${1000 + i},0`);
      }
      return out.join('\r\n');
    };
    let state: ChartStateService;
    const panelChart = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;

    beforeEach(() => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
        return fakeCtx(this);
      } as any);
    });
    afterEach(() => vi.restoreAllMocks());

    async function load(indicators: { type: string; period: number }[]) {
      sessionStorage.clear();
      state = TestBed.inject(ChartStateService);
      state.reset();
      state.setSymbol('msft');
      for (const i of indicators) state.addIndicator(i);
      stubCanvas();
      httpMock.expectOne('test-data/msft.us.txt').flush(rows(80));
      await fixture.whenStable();
      fixture.detectChanges();
    }

    it('overlay indicator (SMA) is a line dataset on the price y-scale, aligned to bar index', async () => {
      await load([{ type: 'sma', period: 5 }]);
      const line = panelChart().data.datasets.find((d: any) => d.label === 'SMA 5');
      expect(line).toBeTruthy();
      expect(line.type).toBe('line');
      expect(line.yAxisID).toBe('y');
      expect(line.data.length).toBe(80);
      expect(line.data[3].y).toBeNull(); // warmup gap
      expect(typeof line.data[4].y).toBe('number');
      expect(line.data[4].x).toBe(4);
    });

    it('oscillator (RSI) is a stacked pane of the SAME chart: 0-100 range, guide lines, shared x', async () => {
      await load([{ type: 'rsi', period: 14 }]);
      const chart = panelChart();
      expect(fixture.nativeElement.querySelectorAll('canvas').length).toBe(1);
      const rsi = chart.data.datasets.filter((d: any) => d.yAxisID === 'yInd0');
      expect(rsi.map((d: any) => d.label)).toEqual(expect.arrayContaining(['RSI', 'Overbought', 'Oversold']));
      const sc = chart.options.scales.yInd0;
      expect(sc.stack).toBe('panel');
      expect(sc.min).toBe(0);
      expect(sc.max).toBe(100);
      expect(sc.paneLabel).toBe('RSI 14');
      expect(chart.scales.yInd0.top).toBeGreaterThanOrEqual(chart.scales.yVol.bottom - 1);
    });

    it('removing an indicator removes its pane/dataset', async () => {
      await load([{ type: 'rsi', period: 14 }, { type: 'sma', period: 5 }]);
      state.removeIndicator(0);
      state.removeIndicator(0);
      await fixture.whenStable();
      const chart = panelChart();
      expect(chart.options.scales.yInd0).toBeUndefined();
      expect(chart.data.datasets.map((d: any) => d.label)).toEqual(['Price', 'Volume']);
    });

    it('toggling an indicator keeps the user\'s current pan/zoom view', async () => {
      await load([]);
      panelChart().zoomScale('x', { min: 20, max: 50 });
      state.addIndicator({ type: 'sma', period: 5 });
      await fixture.whenStable();
      const after = panelChart();
      expect(after.options.scales.x.min).toBe(20);
      expect(after.options.scales.x.max).toBe(50);
    });
  });
});
