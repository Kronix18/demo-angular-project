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
    localStorage.clear(); // panel, lock / hide, watchlist and alert state persist there
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

    it('paneDecor: draws separators above every pane but the first (labels are the legend\'s job)', () => {
      const p = plugin('paneDecor');
      const c = fakeChart({
        scales: {
          x: { top: 0, options: {} },
          y: { top: 0, options: { paneLabel: 'MSFT' } },
          yVol: { top: 30, options: { paneLabel: 'Volume' } },
          yInd0: { top: 40, options: {} },
        },
      });
      p.afterDraw(c);
      expect(c.calls.filter((k: string) => k === 'stroke').length).toBe(2); // above yVol and yInd0, not above y
      expect(c.calls).not.toContain('fillText');
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
      httpMock.expectOne('test-data/msft.us.txt').flush(rows.join('\r\n'));
      await fixture.whenStable();
      const daily = (Chart.getChart(component.chartCanvas!.nativeElement) as any).data.datasets[0].data.length;
      st.setInterval('1w'); // re-aggregates from the cached file: NO second request
      expect(httpMock.match('test-data/msft.us.txt').length).toBe(0);
      await fixture.whenStable();
      expect(daily).toBeGreaterThan(30);
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

  describe('drawing tools (10.3)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); TestBed.inject(ChartStateService).reset(); };

    it('tool buttons select the active tool (aria-pressed) and only the cursor tool leaves pan enabled', async () => {
      fresh();
      const chart: any = await loaded();
      expect(q('[data-tool="cursor"]')!.getAttribute('aria-pressed')).toBe('true');
      expect(chart.options.plugins.zoom.pan.enabled).toBe(true);
      (q('[data-tool="trend"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('[data-tool="trend"]')!.getAttribute('aria-pressed')).toBe('true');
      expect(q('[data-tool="cursor"]')!.getAttribute('aria-pressed')).toBe('false');
      expect(chart.options.plugins.zoom.pan.enabled).toBe(false);
      (q('[data-tool="cursor"]') as HTMLButtonElement).click();
      expect(chart.options.plugins.zoom.pan.enabled).toBe(true);
    });

    it('a chart rebuild (e.g. indicator toggle) keeps pan disabled while a drawing tool is active', async () => {
      fresh();
      await loaded();
      component.setTool('ray');
      TestBed.inject(ChartStateService).addIndicator({ type: 'sma', period: 2 });
      await fixture.whenStable();
      expect((Chart.getChart(component.chartCanvas!.nativeElement) as any).options.plugins.zoom.pan.enabled).toBe(false);
    });

    it('canvas mouse events reach the controller with canvas-relative coordinates; Clear empties the symbol\'s drawings', async () => {
      fresh();
      await loaded();
      const store = TestBed.inject((await import('../drawings/drawing-store.service')).DrawingStore);
      store.add('msft', { id: 'x', type: 'ray', a: { t: 1, p: 1 } });
      component.setTool('trend');
      const ctl: any = (component as any).drawings;
      const down = vi.spyOn(ctl, 'pointerDown').mockImplementation(() => undefined);
      const move = vi.spyOn(ctl, 'pointerMove').mockImplementation(() => undefined);
      const up = vi.spyOn(ctl, 'pointerUp').mockImplementation(() => undefined);
      Object.defineProperty(MouseEvent.prototype, 'offsetX', { get: () => 12, configurable: true });
      Object.defineProperty(MouseEvent.prototype, 'offsetY', { get: () => 34, configurable: true });
      const canvas = component.chartCanvas!.nativeElement;
      canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, buttons: 1 }));
      canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      delete (MouseEvent.prototype as any).offsetX;
      delete (MouseEvent.prototype as any).offsetY;
      expect(down).toHaveBeenCalledWith(12, 34);
      expect(move).toHaveBeenCalledWith(12, 34);
      expect(up).toHaveBeenCalledWith(12, 34);
      down.mockRestore(); move.mockRestore(); up.mockRestore();
      (q('[data-tool-clear]') as HTMLButtonElement).click();
      expect(store.list('msft')).toEqual([]);
    });

    it('drawings render without breaking the chart draw cycle (plugin handles rays, trends, channels, drafts)', async () => {
      fresh();
      const chart: any = await loaded();
      const store = TestBed.inject((await import('../drawings/drawing-store.service')).DrawingStore);
      const t0 = chart.data.datasets[0].data[0].t;
      const t1 = chart.data.datasets[0].data[2].t;
      store.add('msft', { id: 'r', type: 'ray', a: { t: t0, p: 100 } });
      store.add('msft', { id: 't', type: 'trend', a: { t: t0, p: 100 }, b: { t: t1, p: 120 } });
      store.add('msft', { id: 'c', type: 'channel', a: { t: t0, p: 100 }, b: { t: t1, p: 120 }, offset: 5 });
      expect(() => chart.draw()).not.toThrow();
      (component as any).drawings.pointerDown(chart.chartArea.left + 5, (chart.scales.y.top + chart.scales.y.bottom) / 2);
      expect(() => chart.draw()).not.toThrow(); // draft path
    });

    it('key handling ignores form fields (Delete in the symbol box must not delete a drawing)', async () => {
      fresh();
      await loaded();
      const spy = vi.spyOn((component as any).drawings, 'key');
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      expect(spy).not.toHaveBeenCalled();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      expect(spy).toHaveBeenCalledWith('Delete');
      input.remove();
    });
  });

  describe('price scale: auto, manual pan/scale, logarithmic (11.4)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    /** long-ish history so pan/scale have room */
    async function loadLong() {
      stubCanvas();
      const rows = ['<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>'];
      for (let i = 0; i < 300; i++) {
        const d = new Date(Date.UTC(2023, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, '');
        const c = 50 + Math.sin(i / 12) * 15 + i * 0.4;
        rows.push(`MSFT.US,D,${d},000000,${c - 1},${c + 2},${c - 2},${c},${1000 + (i % 7) * 500},0`);
      }
      httpMock.expectOne('test-data/msft.us.txt').flush(rows.join('\r\n'));
      await fixture.whenStable();
      fixture.detectChanges();
    }
    const mouse = (type: string, x: number, y: number, buttons = 0) => {
      const canvas = component.chartCanvas!.nativeElement;
      Object.defineProperty(MouseEvent.prototype, 'offsetX', { get: () => x, configurable: true });
      Object.defineProperty(MouseEvent.prototype, 'offsetY', { get: () => y, configurable: true });
      canvas.dispatchEvent(new MouseEvent(type, { bubbles: true, buttons }));
      delete (MouseEvent.prototype as any).offsetX;
      delete (MouseEvent.prototype as any).offsetY;
    };
    /** jsdom has no layout: give the scales/area real numbers so hit-testing works */
    const layout = () => {
      const c = chartOf();
      c.chartArea = { left: 0, right: 900, top: 0, bottom: 500 };
      c.scales.y.top = 0; c.scales.y.bottom = 300; c.scales.y.height = 300;
      return c;
    };

    it('auto + log buttons: auto is on by default; log toggles the state and rebuilds with log price AND volume scales', async () => {
      const st = fresh();
      await loaded();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
      expect(q('[data-log]')!.getAttribute('aria-pressed')).toBe('false');
      expect(chartOf().options.scales.y.type).toBe('linear');
      (q('[data-log]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(st.snapshot().logScale).toBe(true);
      expect(q('[data-log]')!.getAttribute('aria-pressed')).toBe('true');
      expect(chartOf().options.scales.y.type).toBe('logarithmic');
      expect(chartOf().options.scales.yVol.type).toBe('logarithmic'); // volume follows the price scale
      expect(chartOf().scales.y.min).toBeGreaterThan(0);
      expect(chartOf().scales.yVol.min).toBeGreaterThan(0);
    });

    it('log volume drops zero-volume bars instead of breaking the axis', async () => {
      const st = fresh();
      await loaded();
      st.toggleLogScale();
      await fixture.whenStable();
      const vol = chartOf().data.datasets.find((d: any) => d.label === 'Volume').data;
      expect(vol.every((p: any) => p.y === null || p.y > 0)).toBe(true);
    });

    it('log price fit is multiplicative and covers the visible candles', async () => {
      const st = fresh();
      await loadLong();
      st.toggleLogScale();
      await fixture.whenStable();
      const y = chartOf().scales.y;
      const view = chartOf().data.datasets[0].data.filter((p: any) => p.x >= chartOf().scales.x.min && p.x <= chartOf().scales.x.max);
      expect(y.min).toBeLessThanOrEqual(Math.min(...view.map((p: any) => p.l)));
      expect(y.max).toBeGreaterThanOrEqual(Math.max(...view.map((p: any) => p.h)));
      expect(y.min).toBeGreaterThan(0);
    });

    it('vertical drag on the price pane turns auto off and pans the price range (chart down = higher prices)', async () => {
      fresh();
      await loadLong();
      const c = layout();
      const before = { min: c.scales.y.min, max: c.scales.y.max };
      mouse('mousedown', 400, 100, 1);
      mouse('mousemove', 400, 110, 1); // 10px: over the threshold
      mouse('mousemove', 400, 160, 1);
      mouse('mouseup', 400, 160);
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('false');
      const after = chartOf().options.scales.y;
      expect(after.min).toBeGreaterThan(before.min);
      expect(after.max).toBeGreaterThan(before.max);
      expect(after.max - after.min).toBeCloseTo(before.max - before.min, 4); // pure pan: same span
    });

    it('a small jitter while dragging horizontally does NOT switch auto off', async () => {
      fresh();
      await loadLong();
      layout();
      mouse('mousedown', 400, 100, 1);
      mouse('mousemove', 450, 102, 1);
      mouse('mouseup', 450, 102);
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
    });

    it('dragging on the price axis scales the range around its centre and turns auto off', async () => {
      fresh();
      await loadLong();
      const c = layout();
      const before = { min: c.scales.y.min, max: c.scales.y.max };
      mouse('mousedown', 950, 100, 1); // x > chartArea.right = on the axis
      mouse('mousemove', 950, 200, 1);
      mouse('mouseup', 950, 200);
      fixture.detectChanges();
      const after = chartOf().options.scales.y;
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('false');
      expect((after.min + after.max) / 2).toBeCloseTo((before.min + before.max) / 2, 4);
      expect(after.max - after.min).toBeGreaterThan(before.max - before.min); // dragged down = zoom out
    });

    it('in manual mode the price range stays put when the view pans horizontally; Auto restores the fit', async () => {
      fresh();
      await loadLong();
      const c = layout();
      mouse('mousedown', 400, 100, 1); mouse('mousemove', 400, 120, 1); mouse('mousemove', 400, 140, 1); mouse('mouseup', 400, 140);
      const manual = { min: chartOf().options.scales.y.min, max: chartOf().options.scales.y.max };
      c.zoomScale('x', { min: 20, max: 80 });
      expect(chartOf().options.scales.y.min).toBeCloseTo(manual.min, 6);
      expect(chartOf().options.scales.y.max).toBeCloseTo(manual.max, 6);
      (q('[data-auto]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
      expect(chartOf().options.scales.y.min).not.toBeCloseTo(manual.min, 3); // refit to the visible bars
    });

    it('manual scale survives an indicator toggle (chart rebuild) but resets on symbol / range changes', async () => {
      const st = fresh();
      await loadLong();
      layout();
      mouse('mousedown', 400, 100, 1); mouse('mousemove', 400, 120, 1); mouse('mousemove', 400, 150, 1); mouse('mouseup', 400, 150);
      const manual = chartOf().options.scales.y.min;
      st.addIndicator({ type: 'sma', period: 5 });
      await fixture.whenStable();
      expect(chartOf().options.scales.y.min).toBeCloseTo(manual, 6);
      st.setRange('1Y');
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
    });

    it('double-clicking the price axis re-enables auto (and does not reset the x zoom)', async () => {
      fresh();
      await loadLong();
      layout();
      mouse('mousedown', 400, 100, 1); mouse('mousemove', 400, 125, 1); mouse('mousemove', 400, 160, 1); mouse('mouseup', 400, 160);
      const spy = vi.spyOn(chartOf(), 'resetZoom');
      Object.defineProperty(MouseEvent.prototype, 'offsetX', { get: () => 950, configurable: true });
      Object.defineProperty(MouseEvent.prototype, 'offsetY', { get: () => 100, configurable: true });
      component.chartCanvas!.nativeElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      delete (MouseEvent.prototype as any).offsetX;
      delete (MouseEvent.prototype as any).offsetY;
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
      expect(spy).not.toHaveBeenCalled();
    });

    it('dragging a selected drawing does not pan the price scale', async () => {
      fresh();
      await loadLong();
      layout();
      const ctl: any = (component as any).drawings;
      vi.spyOn(ctl, 'isDragging').mockReturnValue(true);
      mouse('mousedown', 400, 100, 1); mouse('mousemove', 400, 130, 1); mouse('mousemove', 400, 170, 1); mouse('mouseup', 400, 170);
      fixture.detectChanges();
      expect(q('[data-auto]')!.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('drawing sidebar, styles, text, zoom tool (11.5)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const qa = (sel: string) => Array.from(fixture.nativeElement.querySelectorAll(sel)) as HTMLElement[];
    const fresh = () => { sessionStorage.clear(); localStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    const ctl = () => (component as any).drawings;
    let store: any;
    beforeEach(async () => {
      const { DrawingStore } = await import('../drawings/drawing-store.service');
      store = TestBed.inject(DrawingStore);
    });
    // chart.update() (e.g. from setTool -> syncPan) rebuilds the layout: re-apply the fake geometry
    const mock = (c: any) => {
      c.chartArea = { left: 0, right: 900, top: 0, bottom: 500 };
      c.scales.y.top = 0; c.scales.y.bottom = 300; c.scales.y.height = 300;
      // fake pixel mapping: x = index * 10, y = 300 - price (so prices 0..300 fit the pane)
      c.scales.x.getPixelForValue = (v: number) => v * 10;
      c.scales.x.getValueForPixel = (px: number) => px / 10;
      c.scales.y.getPixelForValue = (v: number) => 300 - v;
      c.scales.y.getValueForPixel = (px: number) => 300 - px;
    };
    const use = (t: string) => { component.setTool(t as any); mock(chartOf()); };
    async function ready() {
      fresh();
      if (store.locked()) store.toggleLocked(); // the flags persist in localStorage across tests
      store.setHidden(false);
      await loaded();
      const c = chartOf();
      mock(c);
      return c;
    }
    const drawn = () => store.list('msft');

    it('the sidebar has cursor, one button per tool group (with a flyout listing all its tools), measure, zoom + magnet / stay-in-drawing / lock / hide / delete-all', async () => {
      await ready();
      expect(qa('[data-group]').map((b) => b.dataset['group'])).toEqual(['cursors', 'lines', 'fib', 'patterns', 'projection', 'shapes', 'text', 'icons']);
      expect(qa('.draw-tools > [data-tool], .draw-tools [data-tool]').map((b) => b.dataset['tool'])).toEqual(
        ['cursor', 'trend', 'fib', 'xabcd', 'longpos', 'brush', 'text', 'iconup', 'measure', 'zoom']);
      for (const sel of ['[data-magnet]', '[data-keep]', '[data-lock]', '[data-hide]', '[data-tool-clear]']) expect(q(sel), sel).toBeTruthy();
      for (const b of qa('.draw-tools button')) expect(b.getAttribute('aria-label') || b.getAttribute('title'), b.outerHTML).toBeTruthy();
      expect(q('.chart-tools [data-magnet]')).toBeNull(); // magnet moved into the sidebar
      expect(q('[data-flyout-menu]')).toBeNull();
      (q('[data-flyout="lines"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      const lines = qa('[data-flyout-tool]').map((b) => b.dataset['flyoutTool']);
      expect(lines).toEqual(expect.arrayContaining(['trend', 'rayline', 'extended', 'info', 'angle', 'hline', 'ray', 'vline', 'cross', 'arrow', 'channel', 'regression']));
      (q('[data-flyout-tool="extended"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.tool()).toBe('extended');
      expect(q('[data-flyout-menu]')).toBeNull(); // picking closes the flyout
      expect(q('[data-group="lines"]')!.dataset['tool']).toBe('extended'); // and the group button now stands for it
      expect(q('[data-group="lines"]')!.getAttribute('aria-pressed')).toBe('true');
      const all: string[] = [];
      for (const g of qa('[data-flyout]')) { g.click(); fixture.detectChanges(); all.push(...qa('[data-flyout-tool]').map((b) => b.dataset['flyoutTool']!)); }
      expect(all.length).toBeGreaterThanOrEqual(50);
    });

    it('after finishing a drawing the tool returns to the cursor — unless "stay in drawing mode" is on', async () => {
      await ready();
      use('hline');
      ctl().pointerDown(100, 100); ctl().pointerUp(100, 100);
      fixture.detectChanges();
      expect(component.tool()).toBe('cursor');
      (q('[data-keep]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('[data-keep]')!.getAttribute('aria-pressed')).toBe('true');
      use('hline');
      ctl().pointerDown(100, 120); ctl().pointerUp(100, 120);
      expect(component.tool()).toBe('hline');
      expect(drawn().length).toBe(2);
    });

    it('Escape leaves the drawing tool; lock / hide buttons toggle the store flags; picking a tool un-hides', async () => {
      await ready();
      use('trend');
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(component.tool()).toBe('cursor');
      (q('[data-lock]') as HTMLButtonElement).click();
      (q('[data-hide]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(store.locked()).toBe(true);
      expect(store.hidden()).toBe(true);
      expect(q('[data-lock]')!.getAttribute('aria-pressed')).toBe('true');
      expect(q('[data-hide]')!.getAttribute('aria-pressed')).toBe('true');
      (q('[data-flyout="shapes"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q('[data-flyout-tool="rect"]') as HTMLButtonElement).click();
      expect(store.hidden()).toBe(false);
    });

    it('a selected drawing shows the style toolbar: colour, width, dash, delete', async () => {
      await ready();
      expect(q('[data-draw-style]')).toBeNull();
      use('hline');
      ctl().pointerDown(100, 100); ctl().pointerUp(100, 100);
      fixture.detectChanges();
      expect(q('[data-draw-style]')).toBeTruthy();
      const color = q('[data-draw-color]') as HTMLInputElement;
      color.value = '#ff0000'; color.dispatchEvent(new Event('input'));
      const width = q('[data-draw-width]') as HTMLSelectElement;
      width.value = '3'; width.dispatchEvent(new Event('change'));
      const dash = q('[data-draw-dash]') as HTMLSelectElement;
      dash.value = 'dot'; dash.dispatchEvent(new Event('change'));
      expect(drawn()[0].style).toEqual({ color: '#ff0000', width: 3, dash: 'dot' });
      (q('[data-draw-delete]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(drawn()).toEqual([]);
      expect(q('[data-draw-style]')).toBeNull();
    });

    it('text tool: click opens an inline editor; Enter saves the label, Esc / blank discards it', async () => {
      await ready();
      use('text');
      ctl().pointerDown(150, 100); ctl().pointerUp(150, 100);
      fixture.detectChanges();
      const input = q('[data-text-edit]') as HTMLInputElement;
      expect(input).toBeTruthy();
      input.value = 'breakout';
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();
      expect(drawn()[0].text).toBe('breakout');
      expect(q('[data-text-edit]')).toBeNull();
      use('text');
      ctl().pointerDown(250, 100); ctl().pointerUp(250, 100);
      fixture.detectChanges();
      (q('[data-text-edit]') as HTMLInputElement).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();
      expect(drawn().length).toBe(1); // the empty label was discarded
    });

    it('double-clicking a text label edits it', async () => {
      await ready();
      store.add('msft', { id: 't1', type: 'text', a: { t: chartOf().data.datasets[0].data[1].t, p: 100 }, text: 'old' });
      const x = chartOf().scales.x.getPixelForValue(chartOf().data.datasets[0].data[1].x);
      Object.defineProperty(MouseEvent.prototype, 'offsetX', { get: () => x + 5, configurable: true });
      Object.defineProperty(MouseEvent.prototype, 'offsetY', { get: () => 200, configurable: true });
      component.chartCanvas!.nativeElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      delete (MouseEvent.prototype as any).offsetX;
      delete (MouseEvent.prototype as any).offsetY;
      fixture.detectChanges();
      expect((q('[data-text-edit]') as HTMLInputElement).value).toBe('old');
    });

    it('zoom tool: dragging a region zooms x to it and sets a manual price range (auto off), then returns to the cursor', async () => {
      const c = await ready();
      use('zoom');
      expect(c.data.datasets[0].data.length).toBeGreaterThan(0);
      component.zoomToRegion({ x0: 0, x1: 2, p0: 90, p1: 130 });
      fixture.detectChanges();
      expect(component.autoScale()).toBe(false);
      expect(chartOf().options.scales.y.min).toBeCloseTo(90, 4);
      expect(chartOf().options.scales.y.max).toBeCloseTo(130, 4);
      expect(component.tool()).toBe('cursor');
    });

    it('measure readout is transient and never persisted', async () => {
      await ready();
      use('measure');
      ctl().pointerDown(100, 100); ctl().pointerMove(200, 60); ctl().pointerUp(200, 60);
      expect(ctl().view().measure).toBeTruthy();
      expect(() => chartOf().draw()).not.toThrow();
      expect(drawn()).toEqual([]);
    });

    it('every drawing type renders without errors (incl. hidden, selected and draft states)', async () => {
      const c = await ready();
      const { TOOL_DEFS } = await import('../drawings/drawing-tools');
      const barsNow = (component as any).bars as { timestamp: number }[];
      const at = (i: number, p: number) => ({ t: barsNow[Math.min(i, barsNow.length - 1)].timestamp + i * 3600_000, p });
      TOOL_DEFS.forEach((def, k) => {
        const n = typeof def.points === 'number' ? def.points : 6;
        const pts = Array.from({ length: n }, (_, j) => at(j, 100 + (j % 2 ? 25 : 0) + j * 3));
        store.add('msft', { id: `t${k}`, type: def.id, a: pts[0], ...(n > 1 ? { b: pts[1] } : {}), ...(n > 2 || typeof def.points !== 'number' ? { pts } : {}), ...(def.id === 'channel' ? { offset: 5 } : {}), ...(def.text ? { text: 'note' } : {}) } as any);
      });
      expect(store.list('msft').length).toBe(TOOL_DEFS.length);
      expect(() => c.draw()).not.toThrow();
      for (const d of store.list('msft')) { (ctl() as any).selectedId = d.id; expect(() => c.draw(), d.type).not.toThrow(); }
      store.setHidden(true);
      expect(() => c.draw()).not.toThrow();
    });
  });

  describe('symbol + volume settings (11.6)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    const setColor = (sel: string, v: string) => { const i = q(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); };

    it('the legend header has an eye and a gear; the gear opens the symbol settings, OK restyles the bars', async () => {
      const st = fresh();
      await loaded();
      (q('[data-price-settings]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-symbol-settings-dialog')).toBeTruthy();
      setColor('[data-set="up"]', '#112233');
      setColor('[data-set="down"]', '#445566');
      const w = q('[data-set="width"]') as HTMLSelectElement;
      w.value = '3'; w.dispatchEvent(new Event('change'));
      (q('[data-ok]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().price).toMatchObject({ up: '#112233', down: '#445566', width: 3 });
      const ds = chartOf().data.datasets[0];
      expect(ds.backgroundColors.up).toBe('#112233');
      expect(ds.borderColors.down).toBe('#445566');
      expect(ds.borderWidth).toBe(3);
      expect(q('app-symbol-settings-dialog')).toBeNull();
    });

    it('previous-close colouring puts a direction on every bar; the eye hides / shows the price series', async () => {
      const st = fresh();
      st.setPriceSettings({ byPrevClose: true });
      await loaded();
      const pts = chartOf().data.datasets[0].data;
      expect(pts.every((p: any) => p.dir === 'up' || p.dir === 'down')).toBe(true);
      (q('[data-price-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().price.hidden).toBe(true);
      expect(chartOf().data.datasets[0].hidden).toBe(true);
      expect(q('[data-legend-header]')!.classList.contains('hidden')).toBe(true);
      (q('[data-price-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(chartOf().data.datasets[0].hidden).toBeFalsy();
    });

    it('line styles get source + line colour in the dialog and use them', async () => {
      const st = fresh();
      st.setChartType('line');
      st.setPriceSettings({ source: 'high', line: '#abcdef', width: 4 });
      await loaded();
      const ds = chartOf().data.datasets[0];
      expect(ds.borderColor).toBe('#abcdef');
      expect(ds.borderWidth).toBe(4);
      expect(ds.data[0].y).toBe(chartOf().data.datasets[0].data[0].y);
      (q('[data-price-settings]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('[data-set="source"]')).toBeTruthy();
    });

    it('the Volume row: eye hides the histogram, gear edits colours and previous-close colouring', async () => {
      const st = fresh();
      await loaded();
      expect(q('[data-volume-row]')).toBeTruthy();
      (q('[data-volume-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(chartOf().data.datasets.find((d: any) => d.label === 'Volume').hidden).toBe(true);
      (q('[data-volume-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      (q('[data-volume-settings]') as HTMLButtonElement).click();
      fixture.detectChanges();
      setColor('[data-set="up"]', '#0a0b0c');
      (q('[data-set="prev"]') as HTMLInputElement).click();
      (q('[data-ok]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().volume).toEqual({ up: '#0a0b0c', byPrevClose: true });
      const vol = chartOf().data.datasets.find((d: any) => d.label === 'Volume');
      const raw = vol.data[1];
      expect(typeof raw.up).toBe('boolean');
      expect(vol.backgroundColor({ raw: { up: true } })).toBe('#0a0b0c');
    });
  });

  describe('layout, scale bar, cursors (11.8)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const qa = (sel: string) => Array.from(fixture.nativeElement.querySelectorAll(sel)) as HTMLElement[];
    const fresh = () => { sessionStorage.clear(); localStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;

    it('the drawing sidebar is a fixed column beside the chart panel (not floating inside it)', async () => {
      fresh();
      await loaded();
      expect(q('.chart-body > app-drawing-sidebar')).toBeTruthy();
      expect(q('.chart-body > .chart-col > .chart-panel')).toBeTruthy();
      expect(q('.chart-panel app-drawing-sidebar')).toBeNull();
    });

    it('percent scale: the price axis reads % change from the first visible bar (and the state persists)', async () => {
      const st = fresh();
      await loaded();
      (q('[data-percent]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().percentScale).toBe(true);
      expect(q('[data-percent]')!.getAttribute('aria-pressed')).toBe('true');
      const bars = (component as any).bars as { close: number }[];
      const cb = chartOf().options.scales.y.ticks.callback;
      const base = bars[Math.max(0, Math.round(chartOf().scales.x.min))].close;
      expect(cb(base)).toBe('0.00%');
      expect(cb(base * 1.1)).toBe('+10.00%');
      expect(cb(base * 0.95)).toBe('-5.00%');
    });

    it('invert scale flips the price axis', async () => {
      const st = fresh();
      await loaded();
      expect(chartOf().options.scales.y.reverse).toBeFalsy();
      (q('[data-invert]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(st.snapshot().invertScale).toBe(true);
      expect(chartOf().options.scales.y.reverse).toBe(true);
    });

    it('zoom in / out buttons zoom the x axis about the centre', async () => {
      fresh();
      await loaded();
      const zoom = vi.spyOn(chartOf(), 'zoom');
      (q('[data-zoom-in]') as HTMLButtonElement).click();
      (q('[data-zoom-out]') as HTMLButtonElement).click();
      expect(zoom.mock.calls.map((c) => (c[0] as any).x)).toEqual([1.25, 0.8]);
    });

    it('cursor group: cross, dot, arrow, eraser — the crosshair follows the choice', async () => {
      fresh();
      await loaded();
      (q('[data-flyout="cursors"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(qa('[data-flyout-tool]').map((b) => b.dataset['flyoutTool'])).toEqual(['cursor', 'dot', 'pointer', 'demo', 'eraser']);
      (q('[data-flyout-tool="dot"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.tool()).toBe('dot');
      expect(chartOf().$cursorStyle).toBe('dot');
      component.setTool('pointer');
      expect(chartOf().$cursorStyle).toBe('pointer');
      component.setTool('demo');
      expect(chartOf().$cursorStyle).toBe('demo');
      component.setTool('trend');
      expect(chartOf().$cursorStyle).toBe('cross');
    });
  });

  describe('undo / redo, clone, shortcuts, remove menu (11.10)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); localStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const ctl = () => (component as any).drawings;
    let store: any;
    const key = (k: string, init: KeyboardEventInit = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));
    beforeEach(async () => {
      const { DrawingStore } = await import('../drawings/drawing-store.service');
      store = TestBed.inject(DrawingStore);
    });
    const mock = () => {
      const c = Chart.getChart(component.chartCanvas!.nativeElement) as any;
      c.chartArea = { left: 0, right: 900, top: 0, bottom: 500 };
      c.scales.y.top = 0; c.scales.y.bottom = 300;
      c.scales.x.getPixelForValue = (v: number) => v * 10;
      c.scales.x.getValueForPixel = (px: number) => px / 10;
      c.scales.y.getPixelForValue = (v: number) => 300 - v;
      c.scales.y.getValueForPixel = (px: number) => 300 - px;
    };
    const use = (t: string) => { component.setTool(t as any); mock(); }; // setTool updates the chart, which rebuilds the layout
    const draw = async () => {
      fresh();
      if (store.locked()) store.toggleLocked();
      store.setHidden(false);
      store.clear('msft'); // the store was created before fresh() emptied sessionStorage
      await loaded();
      mock();
    };

    it('Ctrl+Z / Ctrl+Y (and the header buttons) undo and redo drawing changes', async () => {
      await draw();
      use('hline');
      ctl().pointerDown(100, 100); ctl().pointerUp(100, 100);
      fixture.detectChanges();
      expect(store.list('msft').length).toBe(1);
      expect((q('[data-undo]') as HTMLButtonElement).disabled).toBe(false);
      expect((q('[data-redo]') as HTMLButtonElement).disabled).toBe(true);
      key('z', { ctrlKey: true });
      fixture.detectChanges();
      expect(store.list('msft').length).toBe(0);
      expect((q('[data-redo]') as HTMLButtonElement).disabled).toBe(false);
      key('y', { ctrlKey: true });
      expect(store.list('msft').length).toBe(1);
      key('z', { ctrlKey: true });
      fixture.detectChanges();
      (q('[data-redo]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(store.list('msft').length).toBe(1);
      (q('[data-undo]') as HTMLButtonElement).click();
      expect(store.list('msft').length).toBe(0);
      key('z', { ctrlKey: true, shiftKey: true }); // Ctrl+Shift+Z is redo too
      expect(store.list('msft').length).toBe(1);
    });

    it('Ctrl+D clones the selection; the style toolbar has a clone button', async () => {
      await draw();
      use('hline');
      ctl().pointerDown(100, 100); ctl().pointerUp(100, 100);
      fixture.detectChanges();
      key('d', { ctrlKey: true });
      expect(store.list('msft').length).toBe(2);
      (q('[data-draw-clone]') as HTMLButtonElement).click();
      expect(store.list('msft').length).toBe(3);
    });

    it('TradingView Alt shortcuts pick tools: T trend, H horizontal line, V vertical line, C cross, F fib', async () => {
      await draw();
      for (const [code, tool] of [['KeyT', 'trend'], ['KeyH', 'hline'], ['KeyV', 'vline'], ['KeyC', 'cross'], ['KeyF', 'fib']] as const) {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code, altKey: true, bubbles: true }));
        expect(component.tool(), code).toBe(tool);
      }
      expect(q('app-symbol-search-dialog')).toBeNull(); // Alt+letter never opens type-to-search
    });

    it('the trash menu removes drawings, indicators or everything', async () => {
      const st = fresh();
      st.addIndicator({ type: 'sma', period: 5 });
      store.clear('msft');
      await loaded();
      store.add('msft', { id: 'a', type: 'hline', a: { t: 1, p: 10 } });
      (q('[data-flyout="remove"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q('[data-remove="indicators"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(st.snapshot().indicators).toEqual([]);
      expect(store.list('msft').length).toBe(1);
      st.addIndicator({ type: 'sma', period: 5 });
      (q('[data-flyout="remove"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q('[data-remove="all"]') as HTMLButtonElement).click();
      expect(st.snapshot().indicators).toEqual([]);
      expect(store.list('msft')).toEqual([]);
    });
  });

  describe('per-drawing controls and emoji (11.12)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const ctl = () => (component as any).drawings;
    let store: any;
    beforeEach(async () => {
      const { DrawingStore } = await import('../drawings/drawing-store.service');
      store = TestBed.inject(DrawingStore);
    });
    const ready = async () => {
      sessionStorage.clear(); localStorage.clear();
      TestBed.inject(ChartStateService).reset();
      if (store.locked()) store.toggleLocked();
      store.setHidden(false);
      store.clear('msft');
      await loaded();
      const c = Chart.getChart(component.chartCanvas!.nativeElement) as any;
      const mock = () => {
        c.chartArea = { left: 0, right: 900, top: 0, bottom: 500 };
        c.scales.y.top = 0; c.scales.y.bottom = 300;
        c.scales.x.getPixelForValue = (v: number) => v * 10;
        c.scales.x.getValueForPixel = (px: number) => px / 10;
        c.scales.y.getPixelForValue = (v: number) => 300 - v;
        c.scales.y.getValueForPixel = (px: number) => 300 - px;
      };
      mock();
      return () => { mock(); };
    };

    it('the style toolbar locks, hides and reorders the selected drawing', async () => {
      const remock = await ready();
      store.add('msft', { id: 'a', type: 'hline', a: { t: 1, p: 100 } });
      store.add('msft', { id: 'b', type: 'hline', a: { t: 1, p: 150 } });
      component.setTool('cursor'); remock();
      ctl().pointerDown(50, 200); ctl().pointerUp(50, 200); // price 100 -> y 200: selects 'a'
      fixture.detectChanges();
      expect(ctl().view().selectedId).toBe('a');
      const order = q('[data-draw-order]') as HTMLSelectElement;
      order.value = 'front'; order.dispatchEvent(new Event('change'));
      expect(store.list('msft').map((d: any) => d.id)).toEqual(['b', 'a']);
      (q('[data-draw-lock]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(store.list('msft')[1].locked).toBe(true);
      expect(q('[data-draw-lock]')!.getAttribute('aria-pressed')).toBe('true');
      (q('[data-draw-hide]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(store.list('msft')[1].hidden).toBe(true);
      expect(q('[data-draw-style]')).toBeNull(); // hidden -> deselected
    });

    it('the icons flyout has an emoji picker; picking one arms the emoji tool and the click stamps it', async () => {
      const remock = await ready();
      (q('[data-flyout="icons"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-emoji]').length).toBeGreaterThan(30);
      (Array.from(fixture.nativeElement.querySelectorAll('[data-emoji]')) as HTMLElement[]).find((b) => b.dataset['emoji'] === '🚀')!.click();
      fixture.detectChanges();
      expect(component.tool()).toBe('emoji');
      remock();
      ctl().pointerDown(100, 100); ctl().pointerUp(100, 100);
      expect(store.list('msft')[0]).toMatchObject({ type: 'emoji', text: '🚀' });
    });
  });

  describe('chart settings, context menu, keyboard navigation (11.11)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); localStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    const key = (k: string, init: KeyboardEventInit = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));

    it('the gear opens chart settings; grid, crosshair, last price line and OHLC status line can be switched off', async () => {
      const st = fresh();
      await loaded();
      expect(q('[data-ohlc]')).toBeTruthy();
      (q('[data-chart-settings]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-chart-settings-dialog')).toBeTruthy();
      for (const k of ['gridV', 'gridH', 'crosshair', 'lastPrice', 'ohlc']) (q(`[data-view="${k}"]`) as HTMLInputElement).click();
      (q('[data-ok]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().view).toMatchObject({ gridH: false, gridV: false, crosshair: false, lastPrice: false, ohlc: false });
      const c = chartOf();
      expect(c.options.scales.x.grid.display).toBe(false);
      expect(c.options.scales.y.grid.display).toBe(false);
      expect(c.$crosshairOn).toBe(false);
      expect(c.$lastPriceOn).toBe(false);
      expect(q('[data-ohlc]')).toBeNull();
      expect(q('app-chart-settings-dialog')).toBeNull();
    });

    it('right-click opens a context menu: reset view, horizontal line at the price, settings, remove drawings', async () => {
      fresh();
      await loaded();
      const canvas = component.chartCanvas!.nativeElement;
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 120 }));
      fixture.detectChanges();
      expect(q('[data-ctx-menu]')).toBeTruthy();
      for (const k of ['reset', 'hline', 'settings', 'clear']) expect(q(`[data-ctx="${k}"]`), k).toBeTruthy();
      (q('[data-ctx="settings"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('[data-ctx-menu]')).toBeNull();
      expect(q('app-chart-settings-dialog')).toBeTruthy();
    });

    it('the context menu closes on Escape and on a click elsewhere', async () => {
      fresh();
      await loaded();
      const canvas = component.chartCanvas!.nativeElement;
      canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 120 }));
      fixture.detectChanges();
      key('Escape');
      fixture.detectChanges();
      expect(q('[data-ctx-menu]')).toBeNull();
    });

    it('arrow keys pan, + and - zoom, End jumps to the latest bar', async () => {
      fresh();
      await loaded();
      const c = chartOf();
      const pan = vi.spyOn(c, 'pan');
      const zoom = vi.spyOn(c, 'zoom');
      key('ArrowLeft');
      key('ArrowRight');
      expect(pan.mock.calls.map((a) => Math.sign((a[0] as any).x))).toEqual([1, -1]);
      key('+');
      key('-');
      expect(zoom.mock.calls.map((a) => (a[0] as any).x)).toEqual([1.25, 0.8]);
      const scrollTo = vi.spyOn(component, 'scrollToLatest');
      key('End');
      expect(scrollTo).toHaveBeenCalled();
    });
  });

  describe('go to date, lock scale, fit, clock (11.13)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); localStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;

    it('go to date opens a dialog; picking a date centres the view on that bar', async () => {
      fresh();
      await loaded();
      (q('[data-goto]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-goto-date-dialog')).toBeTruthy();
      const zoomScale = vi.spyOn(chartOf(), 'zoomScale');
      const bars = (component as any).bars as { timestamp: number }[];
      const iso = new Date(bars[1].timestamp).toISOString().slice(0, 10);
      const input = q('[data-goto-input]') as HTMLInputElement;
      input.value = iso; input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      (q('[data-ok]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-goto-date-dialog')).toBeNull();
      expect(zoomScale).toHaveBeenCalled();
      const [axis, range] = zoomScale.mock.calls[0] as any[];
      expect(axis).toBe('x');
      expect((range.min + range.max) / 2).toBeCloseTo(1, 0);
    });

    it('Alt+G opens go to date too', async () => {
      fresh();
      await loaded();
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', code: 'KeyG', altKey: true, bubbles: true }));
      fixture.detectChanges();
      expect(q('app-goto-date-dialog')).toBeTruthy();
    });

    it('lock scale freezes the price range: auto, vertical drags and the auto button are inert while locked', async () => {
      fresh();
      await loaded();
      expect(component.autoScale()).toBe(true);
      (q('[data-lock-scale]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component.autoScale()).toBe(false);
      expect(q('[data-lock-scale]')!.getAttribute('aria-pressed')).toBe('true');
      component.setAuto();
      expect(component.autoScale()).toBe(false);
      (q('[data-lock-scale]') as HTMLButtonElement).click();
      component.setAuto();
      expect(component.autoScale()).toBe(true);
    });

    it('fit all data zooms the x axis to every bar', async () => {
      fresh();
      await loaded();
      const zoomScale = vi.spyOn(chartOf(), 'zoomScale');
      (q('[data-fit]') as HTMLButtonElement).click();
      const bars = (component as any).bars as unknown[];
      expect((zoomScale.mock.calls[0] as any[])[1]).toMatchObject({ min: 0, max: bars.length - 1 });
    });

    it('the clock shows the time in the chosen timezone', async () => {
      const st = fresh();
      await loaded();
      expect(q('[data-clock]')!.textContent).toMatch(/^\d\d:\d\d:\d\d UTC-[45]$/); // exchange time (New York)
      st.setViewSettings({ ...st.snapshot().view, timezone: 'utc' });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(q('[data-clock]')!.textContent).toMatch(/^\d\d:\d\d:\d\d UTC$/);
    });
  });

  describe('side panel: objects, data window, watchlist, alerts (11.14 / 11.15)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const qa = (sel: string) => Array.from(fixture.nativeElement.querySelectorAll(sel)) as HTMLElement[];
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    const ctl = () => (component as any).drawings;
    let store: any; let alerts: any;
    beforeEach(async () => {
      localStorage.clear();
      const { DrawingStore } = await import('../drawings/drawing-store.service');
      const { AlertService } = await import('../../core/services/alert.service');
      store = TestBed.inject(DrawingStore);
      alerts = TestBed.inject(AlertService);
    });
    const ready = async () => {
      sessionStorage.clear(); localStorage.clear();
      const st = TestBed.inject(ChartStateService); st.reset();
      if (store.locked()) store.toggleLocked();
      store.setHidden(false); store.clear('msft');
      alerts.list.set([]);
      await loaded();
      return st;
    };
    const openPanel = async (tab: string) => {
      if (!q('app-chart-side-panel')) (q('[data-panel]') as HTMLButtonElement).click();
      fixture.detectChanges();
      (q(`[data-tab="${tab}"]`) as HTMLButtonElement).click();
      fixture.detectChanges();
    };

    it('the header button toggles the panel (remembered); it sits beside the chart', async () => {
      await ready();
      expect(q('app-chart-side-panel')).toBeNull();
      (q('[data-panel]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('.chart-body > app-chart-side-panel')).toBeTruthy();
      expect(JSON.parse(localStorage.getItem('chart-panel')!).open).toBe(true);
      (q('[data-panel]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-chart-side-panel')).toBeNull();
    });

    it('object tree: indicators and drawings of this symbol; row / eye / lock / delete drive the chart', async () => {
      const st = await ready();
      st.addIndicator({ type: 'sma', period: 2 });
      store.add('msft', { id: 'a', type: 'trend', a: { t: 1, p: 100 }, b: { t: 2, p: 110 } });
      await fixture.whenStable();
      await openPanel('objects');
      expect(qa('[data-obj-indicator]').length).toBe(1);
      expect(qa('[data-obj-drawing]').length).toBe(1);
      expect(qa('[data-obj-drawing]')[0].textContent).toContain('Trend line');
      qa('[data-obj-drawing]')[0].click();
      fixture.detectChanges();
      expect(ctl().view().selectedId).toBe('a');
      (qa('[data-obj-drawing] [data-obj-lock]')[0] as HTMLButtonElement).click();
      expect(store.list('msft')[0].locked).toBe(true);
      (qa('[data-obj-drawing] [data-obj-eye]')[0] as HTMLButtonElement).click();
      expect(store.list('msft')[0].hidden).toBe(true);
      (qa('[data-obj-indicator] [data-obj-eye]')[0] as HTMLButtonElement).click();
      expect(st.snapshot().indicators[0].hidden).toBe(true);
      (qa('[data-obj-drawing] [data-obj-delete]')[0] as HTMLButtonElement).click();
      expect(store.list('msft')).toEqual([]);
      (qa('[data-obj-indicator] [data-obj-delete]')[0] as HTMLButtonElement).click();
      expect(st.snapshot().indicators).toEqual([]);
    });

    it('data window: OHLC, volume, change and the indicators for the last bar (the hovered bar when hovering)', async () => {
      const st = await ready();
      st.addIndicator({ type: 'sma', period: 2 });
      await fixture.whenStable();
      await openPanel('data');
      const rows = qa('[data-data-row]').map((r) => r.textContent!);
      for (const l of ['Open', 'High', 'Low', 'Close', 'Volume', 'Change', 'SMA 2']) expect(rows.some((t) => t.includes(l)), l).toBe(true);
      expect(q('[data-data-date]')!.textContent).not.toBe('–');
      component.setHoverIndex(0);
      fixture.detectChanges();
      const bars = (component as any).bars as { open: number }[];
      expect(qa('[data-data-row]')[0].textContent).toContain(bars[0].open.toFixed(2));
    });

    it('watchlist: lists the symbols, loads quotes for them, and a click switches the chart', async () => {
      const st = await ready();
      await openPanel('watchlist');
      const wl = TestBed.inject((await import('../../core/services/watchlist.service')).WatchlistService);
      expect(qa('[data-watch-row]').length).toBe(wl.list().length);
      httpMock.match((r) => r.url.includes('test-data/')).forEach((r) => r.flush(MSFT_ROWS));
      await fixture.whenStable();
      fixture.detectChanges();
      expect(qa('[data-watch-row]')[0].textContent).toMatch(/\d+\.\d\d/);
      qa('[data-watch-row]').find((r) => r.textContent!.includes('NVDA'))!.click();
      expect(st.snapshot().symbol).toBe('nvda');
    });

    it('alerts: add from the panel or the context menu; shown on the chart; removable', async () => {
      await ready();
      await openPanel('alerts');
      const input = q('[data-alert-input]') as HTMLInputElement;
      input.value = '480'; input.dispatchEvent(new Event('input'));
      (q('[data-alert-add]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(alerts.forSymbol('msft').map((a: any) => a.price)).toEqual([480]);
      expect(chartOf().$alerts().map((a: any) => a.price)).toEqual([480]);
      chartOf().scales.y.getValueForPixel = () => 490; // the stub canvas has no real scale
      component.chartCanvas!.nativeElement.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 200, clientY: 120 }));
      fixture.detectChanges();
      (q('[data-ctx="alert"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(alerts.forSymbol('msft').length).toBe(2);
      expect(qa('[data-alert-row]').length).toBe(2);
      (qa('[data-alert-remove]')[0] as HTMLButtonElement).click();
      expect(alerts.forSymbol('msft').length).toBe(1);
    });
  });

  describe('type-to-search symbol dialog', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const press = (key: string, init: KeyboardEventInit = {}, target: EventTarget = document.body) =>
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    const fresh = () => { sessionStorage.clear(); TestBed.inject(ChartStateService).reset(); };

    it('typing a letter or digit anywhere opens symbol search with that character in the box', async () => {
      fresh();
      await loaded();
      expect(q('app-symbol-search-dialog')).toBeNull();
      press('n');
      fixture.detectChanges();
      expect(q('app-symbol-search-dialog')).toBeTruthy();
      expect((q('input[type="search"]') as HTMLInputElement).value).toBe('n');
      expect(Array.from(fixture.nativeElement.querySelectorAll('[data-symbol-option]')).map((r: any) => r.dataset.symbolOption)).toEqual(['nvda']);
    });

    it('characters typed before the dialog has rendered are not lost', async () => {
      fresh();
      await loaded();
      press('a');
      press('p'); // no change detection in between: the dialog does not exist yet
      press('l');
      fixture.detectChanges();
      expect((q('input[type="search"]') as HTMLInputElement).value).toBe('apl');
    });

    it('does not hijack typing in form fields, shortcuts with modifiers, or navigation keys', async () => {
      fresh();
      await loaded();
      const input = document.createElement('input');
      document.body.appendChild(input);
      press('a', {}, input);
      press('c', { ctrlKey: true });
      press('c', { metaKey: true });
      press('Enter');
      press('ArrowDown');
      press('Delete');
      fixture.detectChanges();
      expect(q('app-symbol-search-dialog')).toBeNull();
      input.remove();
    });

    it('picking a symbol switches the chart (state + URL) and closes the dialog; Esc closes without changing', async () => {
      const st = TestBed.inject(ChartStateService);
      fresh();
      await loaded();
      press('q');
      fixture.detectChanges();
      (q('[data-symbol-option="qqq"]') as HTMLElement).click();
      fixture.detectChanges();
      expect(st.snapshot().symbol).toBe('qqq');
      expect(q('app-symbol-search-dialog')).toBeNull();
      httpMock.match((r) => r.url.includes('test-data/')).forEach((r) => r.flush(MSFT_ROWS));
      press('z');
      fixture.detectChanges();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(q('app-symbol-search-dialog')).toBeNull();
      expect(st.snapshot().symbol).toBe('qqq');
    });

    it('clicking the symbol in the legend header opens the (empty) search too', async () => {
      fresh();
      await loaded();
      (q('[data-symbol-btn]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-symbol-search-dialog')).toBeTruthy();
      expect((q('input[type="search"]') as HTMLInputElement).value).toBe('');
    });

    it('while another dialog is open, typing goes to that dialog, not to a second one', async () => {
      fresh();
      await loaded();
      (q('[data-indicators]') as HTMLButtonElement).click();
      fixture.detectChanges();
      press('r');
      fixture.detectChanges();
      expect(q('app-symbol-search-dialog')).toBeNull();
    });
  });

  describe('indicators dialog + settings', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;
    const label = (l: string) => chartOf().data.datasets.find((d: any) => d.label === l);

    it('the Indicators button opens the picker; adding from it puts the indicator on the chart; Esc closes', async () => {
      const st = fresh();
      await loaded();
      expect(q('app-indicators-dialog')).toBeNull();
      (q('[data-indicators]') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(q('app-indicators-dialog')).toBeTruthy();
      (q('[data-add-indicator="rsi"]') as HTMLButtonElement).click();
      (q('[data-add-indicator="rsi"]') as HTMLButtonElement).click(); // TradingView lets you add the same one twice
      await fixture.whenStable();
      fixture.detectChanges();
      expect(st.snapshot().indicators.map((i) => i.type)).toEqual(['rsi', 'rsi']);
      expect(q('app-indicators-dialog')).toBeTruthy(); // stays open for more
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      fixture.detectChanges();
      expect(q('app-indicators-dialog')).toBeNull();
    });

    it('gear opens the settings dialog; OK applies inputs, colour, width, dash and hides on unchecked timeframes', async () => {
      const st = fresh();
      st.addIndicator({ type: 'sma', period: 2 });
      await loaded();
      (q('[data-settings]') as HTMLButtonElement).click();
      fixture.detectChanges();
      const dlg = () => q('app-indicator-settings-dialog')!;
      expect(dlg()).toBeTruthy();
      const setInput = (s: string, v: string) => { const i = dlg().querySelector(s) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); fixture.detectChanges(); };
      setInput('[data-param="length"]', '3');
      (dlg().querySelector('[data-tab="style"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      setInput('[data-style-color="ma"]', '#123456');
      const w = dlg().querySelector('[data-style-width="ma"]') as HTMLSelectElement;
      w.value = '3'; w.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      (dlg().querySelector('[data-ok]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      const e = st.snapshot().indicators[0];
      expect(e.period).toBe(3);
      expect(e.styles!['ma']).toMatchObject({ color: '#123456', width: 3 });
      const ds = label('SMA 3');
      expect(ds).toBeTruthy(); // label follows the edited length
      expect(ds.borderColor).toBe('#123456');
      expect(ds.borderWidth).toBe(3);
      expect(q('app-indicator-settings-dialog')).toBeNull(); // closed after OK
    });

    it('per-output visibility and per-timeframe visibility hide the series', async () => {
      const st = fresh();
      st.addIndicator({ type: 'rsi', period: 14, styles: { overbought: { visible: false } } });
      st.addIndicator({ type: 'sma', period: 2, intervals: ['1w'] });
      await loaded();
      expect(label('Overbought').hidden).toBe(true);
      expect(label('RSI').hidden).toBeFalsy();
      expect(label('SMA 2').hidden).toBe(true); // interval is 1d, indicator only on 1w
      expect(q('[data-indicator-row].hidden')).toBeTruthy();
    });

    it('a moving average of VOLUME plots on the volume scale', async () => {
      const st = fresh();
      st.addIndicator({ type: 'sma', period: 2, params: { source: 'volume', method: 'SMA', length: 2 } });
      await loaded();
      expect(label('SMA 2').yAxisID).toBe('yVol');
    });

    it('unknown settings never break rendering (stale style keys are ignored)', async () => {
      const st = fresh();
      st.addIndicator({ type: 'sma', period: 2, styles: { nonsense: { color: '#000000' } }, params: { bogus: 1 } });
      await loaded();
      expect(label('SMA 2')).toBeTruthy();
    });
  });

  describe('chart types + tools (10.5)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;
    const fresh = () => { sessionStorage.clear(); const st = TestBed.inject(ChartStateService); st.reset(); return st; };
    const chartOf = () => Chart.getChart(component.chartCanvas!.nativeElement) as any;

    it('chart type switcher re-renders the price series: candles → ohlc → line → area', async () => {
      const st = fresh();
      await loaded();
      expect(chartOf().data.datasets[0].type).toBe('candlestick');
      st.setChartType('ohlc');
      await fixture.whenStable();
      expect(chartOf().data.datasets[0].type).toBe('tvbar');
      expect(chartOf().data.datasets[0].data[0]).toMatchObject({ o: 100, h: 110, l: 95, c: 105 });
      st.setChartType('line');
      await fixture.whenStable();
      let ds = chartOf().data.datasets[0];
      expect(ds.type).toBe('line');
      expect(ds.data.map((p: any) => p.y)).toEqual([105, 112, 118]); // closes
      expect(ds.fill).toBeFalsy();
      st.setChartType('area');
      await fixture.whenStable();
      ds = chartOf().data.datasets[0];
      expect(ds.type).toBe('line');
      expect(ds.fill).toBeTruthy();
      // volume + panes untouched by the type
      expect(chartOf().data.datasets.some((d: any) => d.label === 'Volume')).toBe(true);
    });

    it('EVERY chart style renders: price series shape per style, finite y-axis, no exceptions', async () => {
      const st = fresh();
      await loaded();
      const expected: Record<string, (ds: any) => void> = {
        candles: (d) => { expect(d.type).toBe('candlestick'); expect(d.backgroundColors).toBeTruthy(); expect(d.borderColors).toBeTruthy(); },
        hollow: (d) => { expect(d.type).toBe('candlestick'); expect(d.backgroundColors.up).toBe('transparent'); expect(d.backgroundColors.down).not.toBe('transparent'); },
        ohlc: (d) => { expect(d.type).toBe('tvbar'); expect(d.barStyle).toBe('ohlc'); },
        hlc: (d) => { expect(d.type).toBe('tvbar'); expect(d.barStyle).toBe('hlc'); },
        highlow: (d) => { expect(d.type).toBe('tvbar'); expect(d.barStyle).toBe('highlow'); },
        columns: (d) => { expect(d.type).toBe('bar'); expect(d.data.map((p: any) => p.y)).toEqual([105, 112, 118]); expect(typeof d.backgroundColor).toBe('function'); },
        line: (d) => { expect(d.type).toBe('line'); expect(d.fill).toBeFalsy(); expect(d.pointRadius).toBe(0); },
        markers: (d) => { expect(d.type).toBe('line'); expect(d.pointRadius).toBeGreaterThan(0); },
        step: (d) => { expect(d.type).toBe('line'); expect(d.stepped).toBe('after'); },
        area: (d) => { expect(d.type).toBe('line'); expect(d.fill).toBeTruthy(); },
        hlcarea: (d) => { expect(d.type).toBe('line'); },
        baseline: (d) => { expect(d.type).toBe('line'); expect(d.fill.target.value).toBeGreaterThan(90); expect(typeof d.segment.borderColor).toBe('function'); },
        heikin: (d) => { expect(d.type).toBe('candlestick'); },
        renko: (d) => { expect(d.type).toBe('candlestick'); },
        linebreak: (d) => { expect(d.type).toBe('candlestick'); },
        kagi: (d) => { expect(d.type).toBe('line'); expect(d.stepped).toBe('after'); expect(typeof d.segment.borderColor).toBe('function'); },
        pnf: (d) => { expect(d.type).toBe('candlestick'); expect(d.pnf).toBe(true); },
        range: (d) => { expect(d.type).toBe('candlestick'); },
      };
      for (const [type, check] of Object.entries(expected)) {
        st.setChartType(type as any);
        await fixture.whenStable();
        const c = chartOf();
        expect(c, type).toBeTruthy();
        check(c.data.datasets[0]);
        expect(c.data.datasets.some((d: any) => d.label === 'Volume'), type).toBe(true);
        expect(Number.isFinite(c.scales.y.min) && Number.isFinite(c.scales.y.max), `${type} y axis`).toBe(true);
        expect(() => c.draw(), type).not.toThrow();
      }
    });

    it('HLC area adds high + low lines around the close', async () => {
      const st = fresh();
      await loaded();
      st.setChartType('hlcarea');
      await fixture.whenStable();
      const labels = chartOf().data.datasets.map((d: any) => d.label);
      expect(labels).toEqual(expect.arrayContaining(['Price', 'High', 'Low']));
    });

    it('Heikin Ashi keeps the view on a switch; brick styles reframe (their bar indexes differ)', async () => {
      const st = fresh();
      await loaded();
      chartOf().zoomScale('x', { min: 1, max: 2 });
      st.setChartType('heikin');
      await fixture.whenStable();
      expect(chartOf().options.scales.x.min).toBe(1);
      st.setChartType('renko');
      await fixture.whenStable();
      expect(chartOf().options.scales.x.min).not.toBe(1);
    });

    it('brick styles work on a long history (bounded data window, volume + indicators still aligned)', async () => {
      const st = fresh();
      st.addIndicator({ type: 'sma', period: 5 });
      stubCanvas();
      const rows = ['<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>'];
      for (let i = 0; i < 400; i++) {
        const d = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, '');
        const c = 100 + Math.sin(i / 15) * 20 + i * 0.05;
        rows.push(`MSFT.US,D,${d},000000,${c - 1},${c + 2},${c - 2},${c},${1000 + i},0`);
      }
      httpMock.expectOne('test-data/msft.us.txt').flush(rows.join('\r\n'));
      await fixture.whenStable();
      for (const type of ['renko', 'kagi', 'pnf', 'range', 'linebreak']) {
        st.setChartType(type as any);
        await fixture.whenStable();
        const c = chartOf();
        const price = c.data.datasets[0].data;
        const vol = c.data.datasets.find((d: any) => d.label === 'Volume').data;
        const sma = c.data.datasets.find((d: any) => d.label === 'SMA 5').data;
        expect(price.length, type).toBeGreaterThan(3);
        expect(vol.length, type).toBe(price.length);
        expect(sma.length, type).toBe(price.length);
        expect(price.map((p: any) => p.x), type).toEqual(vol.map((p: any) => p.x));
      }
    });

    it('the type select writes the state; y-axis still fits the line/ohlc data', async () => {
      const st = fresh();
      await loaded();
      const sel = q('select[name="chartType"]') as HTMLSelectElement;
      expect(Array.from(sel.options).map((o) => o.value)).toEqual([
        'candles', 'hollow', 'ohlc', 'hlc', 'highlow', 'columns',
        'line', 'markers', 'step', 'area', 'hlcarea', 'baseline',
        'heikin', 'renko', 'linebreak', 'kagi', 'pnf', 'range',
      ]);
      expect(Array.from(sel.querySelectorAll('optgroup')).map((g) => g.label)).toEqual(['Bars & candles', 'Lines & areas', 'Alternative charts']);
      sel.value = 'line';
      sel.dispatchEvent(new Event('change'));
      expect(st.snapshot().chartType).toBe('line');
      await fixture.whenStable();
      const y = chartOf().scales.y;
      expect(y.min).toBeLessThanOrEqual(105);
      expect(y.max).toBeGreaterThanOrEqual(118);
    });

    it('switching type keeps the current pan/zoom view', async () => {
      const st = fresh();
      await loaded();
      chartOf().zoomScale('x', { min: 1, max: 2 });
      st.setChartType('line');
      await fixture.whenStable();
      expect(chartOf().options.scales.x.min).toBe(1);
    });

    it('tooltip handles ohlc and line price series', async () => {
      fresh();
      await loaded();
      const label = chartOf().options.plugins.tooltip.callbacks.label;
      expect(label({ dataset: { type: 'ohlc' }, raw: { o: 1, h: 2, l: 0.5, c: 1.5 } })).toBe('O 1.00  H 2.00  L 0.50  C 1.50');
      expect(label({ dataset: { type: 'line', label: 'Price' }, raw: { y: 3.333 } })).toBe('Price 3.33');
    });

    it('screenshot button downloads the chart as SYMBOL-interval.png', async () => {
      fresh();
      const chart = await loaded();
      vi.spyOn(chart, 'toBase64Image').mockReturnValue('data:image/png;base64,AAAA');
      const clicked: { download: string; href: string }[] = [];
      const orig = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) { clicked.push({ download: this.download, href: this.href }); };
      (q('[data-screenshot]') as HTMLButtonElement).click();
      HTMLAnchorElement.prototype.click = orig;
      expect(clicked).toEqual([{ download: 'msft-1d.png', href: 'data:image/png;base64,AAAA' }]);
    });

    it('fullscreen button toggles document fullscreen', async () => {
      fresh();
      await loaded();
      const enter = vi.fn().mockResolvedValue(undefined);
      const exit = vi.fn().mockResolvedValue(undefined);
      (document.documentElement as any).requestFullscreen = enter;
      (document as any).exitFullscreen = exit;
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
      (q('[data-fullscreen]') as HTMLButtonElement).click();
      expect(enter).toHaveBeenCalled();
      Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
      (q('[data-fullscreen]') as HTMLButtonElement).click();
      expect(exit).toHaveBeenCalled();
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });
    });

    it('double-click on the chart resets the zoom', async () => {
      fresh();
      const chart = await loaded();
      const spy = vi.spyOn(chart, 'resetZoom');
      component.chartCanvas!.nativeElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      expect(spy).toHaveBeenCalled();
    });

    it('magnet button toggles the state and the crosshair mode', async () => {
      const st = fresh();
      const chart = await loaded();
      const btn = q('[data-magnet]') as HTMLButtonElement;
      expect(btn.getAttribute('aria-pressed')).toBe('false');
      btn.click();
      fixture.detectChanges();
      expect(st.snapshot().magnet).toBe(true);
      await fixture.whenStable();
      expect(chartOf().$magnet).toBe(true);
      expect(chart).toBeTruthy();
    });

    it('crosshair: horizontal line follows the mouse; magnet snaps it to the hovered close; price label on the axis', () => {
      const p = Chart.registry.getPlugin('crosshair') as any;
      const calls: [string, unknown[]][] = [];
      const ctx = new Proxy({}, { get: (_t, prop) => (...a: unknown[]) => { calls.push([String(prop), a]); }, set: () => true });
      const yScale = { top: 0, bottom: 100, getValueForPixel: (y: number) => 200 - y, getPixelForValue: (v: number) => 200 - v, right: 100, left: 90 };
      const mk = (magnet: boolean): any => ({
        ctx, chartArea: { left: 0, right: 90, top: 0, bottom: 100 }, $magnet: magnet,
        tooltip: { getActiveElements: () => [{ index: 0, element: { x: 30 } }] },
        data: { datasets: [{ data: [{ c: 150, y: 150 }] }] },
        scales: { y: yScale },
      });
      const normal = mk(false); normal.$crosshairX = 30; normal.$crosshairY = 40;
      p.afterDatasetsDraw(normal);
      const lineYs = calls.filter(([k]) => k === 'lineTo').map(([, a]) => a as number[]);
      expect(lineYs.some(([x, y]) => x === 90 && y === 40)).toBe(true); // horizontal at the mouse y
      expect(calls.some(([k, a]) => k === 'fillText' && a[0] === '160.00')).toBe(true); // 200 - 40
      calls.length = 0;
      const mag = mk(true); mag.$crosshairX = 30; mag.$crosshairY = 40;
      p.afterDatasetsDraw(mag);
      const magYs = calls.filter(([k]) => k === 'lineTo').map(([, a]) => a as number[]);
      expect(magYs.some(([x, y]) => x === 90 && y === 50)).toBe(true); // snapped to close 150 -> pixel 50
    });
  });

  describe('legend rows (10.2)', () => {
    const q = (sel: string) => fixture.nativeElement.querySelector(sel) as HTMLElement | null;

    it('header shows symbol · interval and the LAST bar OHLC by default; hovering a bar swaps in its values', async () => {
      sessionStorage.clear();
      TestBed.inject(ChartStateService).reset();
      const chart: any = await loaded();
      fixture.detectChanges();
      expect(q('[data-legend-header]')!.textContent).toContain('MSFT');
      expect(q('[data-legend-header]')!.textContent).toContain('118.00'); // last bar close (MSFT_ROWS)
      component.setHoverIndex(0);
      fixture.detectChanges();
      expect(q('[data-legend-header]')!.textContent).toContain('105.00'); // first bar close
      expect(q('[data-legend-header]')!.textContent).toContain('95.00');
      component.setHoverIndex(null);
      fixture.detectChanges();
      expect(q('[data-legend-header]')!.textContent).toContain('118.00');
      expect(chart).toBeTruthy();
    });

    it('header volume follows the hovered bar; indicator rows show their value at that bar', async () => {
      const st = TestBed.inject(ChartStateService);
      sessionStorage.clear();
      st.reset();
      st.addIndicator({ type: 'sma', period: 2 });
      const chart: any = await loaded();
      component.setHoverIndex(1);
      fixture.detectChanges();
      expect(q('[data-legend-header]')!.textContent).toMatch(/V\s*1\.2K/); // OHLCV next to the symbol, like TradingView
      expect(q('[data-legend-group="volume"]')).toBeNull();
      const row = q('[data-indicator-row]')!;
      expect(row.textContent).toContain('SMA 2');
      expect(row.textContent).toContain('108.50'); // (105+112)/2
      expect(chart.data.datasets.some((d: any) => d.label === 'SMA 2')).toBe(true);
    });

    it('eye toggle hides/shows the series without removing it; the choice persists in state', async () => {
      const st = TestBed.inject(ChartStateService);
      sessionStorage.clear();
      st.reset();
      st.addIndicator({ type: 'sma', period: 2 });
      await loaded();
      const ds = () => (Chart.getChart(component.chartCanvas!.nativeElement) as any).data.datasets.find((d: any) => d.label === 'SMA 2');
      expect(ds().hidden).toBeFalsy();
      (q('[data-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(ds().hidden).toBe(true);
      expect(st.snapshot().indicators[0].hidden).toBe(true);
      expect(q('[data-indicator-row]')!.classList.contains('hidden')).toBe(true);
      (q('[data-eye]') as HTMLButtonElement).click();
      await fixture.whenStable();
      expect(ds().hidden).toBeFalsy();
    });

    it('remove ✕ in the legend removes the indicator', async () => {
      const st = TestBed.inject(ChartStateService);
      sessionStorage.clear();
      st.reset();
      st.addIndicator({ type: 'sma', period: 2 });
      await loaded();
      (q('[data-remove]') as HTMLButtonElement).click();
      expect(st.snapshot().indicators).toEqual([]);
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
