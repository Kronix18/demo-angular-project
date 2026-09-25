import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ChartViewerComponent } from './chart-viewer.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Chart } from 'chart.js';
import { Subject, of, throwError } from 'rxjs';
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
    expect(canvases.length).toBeGreaterThanOrEqual(2);
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
    expect(component.priceCanvas?.nativeElement).toBe(canvasEl);
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

  it('volume pane: separate chart, bar dataset, begins at zero', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const volCanvas = el.querySelector('[data-pane="volume"] canvas') as HTMLCanvasElement;
    const volChart: any = Chart.getChart(volCanvas);
    expect(volChart).toBeTruthy();
    const volDataset = volChart.data.datasets[0];
    expect(volDataset.label).toBe('Volume');
    // bars must start at 0: beginAtZero (option-level check; pixel/decimal proof
    // is the live browser verification's job — jsdom has no real dimensions).
    const volScale = volChart.scales['y'];
    expect(volScale).toBeTruthy();
    expect(volScale.beginAtZero || volChart.options.scales.y.beginAtZero).toBe(true);
  });

  it('volume values map each OHLCV point to {x, y: volume} (ASC, volume pane)', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS); // ngOnInit's request
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const volCanvas = el.querySelector('[data-pane="volume"] canvas') as HTMLCanvasElement;
    const volChart: any = Chart.getChart(volCanvas);
    const priceCanvas = el.querySelector('[data-pane="price"] canvas') as HTMLCanvasElement;
    const priceChart: any = Chart.getChart(priceCanvas);
    const volDataset = volChart.data.datasets[0];
    expect(volDataset.data.length).toBe(priceChart.data.datasets[0].data.length);
    expect(volDataset.data.length).toBe(3);
    // ASC order (3.1 GREEN fix): data[0] = OLDEST; Chart.js financial requires
    // ascending — DESC dropped the oldest point (RED-proven).
    expect(volDataset.data[0]).toEqual({ x: Date.UTC(2024, 0, 10), y: 1000 });
    expect(volDataset.data[volDataset.data.length - 1]).toEqual({ x: Date.UTC(2024, 0, 12), y: 900 });
  });
  it('MULTI-PANE: separate price + volume canvases, volume below price', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const canvases = el.querySelectorAll('canvas');
    // TWO canvases: price pane + volume pane (TradingView layout — no overlap)
    expect(canvases.length).toBe(2);
    const priceCanvas = el.querySelector('[data-pane="price"] canvas');
    const volCanvas = el.querySelector('[data-pane="volume"] canvas');
    expect(priceCanvas).toBeTruthy();
    expect(volCanvas).toBeTruthy();
    // price pane is the FIRST/main canvas; volume the second
    expect(priceCanvas).toBe(canvases[0]);
    expect(volCanvas).toBe(canvases[1]);
    // two Chart instances, one per pane
    const priceChart: any = Chart.getChart(priceCanvas as HTMLCanvasElement);
    const volChart: any = Chart.getChart(volCanvas as HTMLCanvasElement);
    expect(priceChart).toBeTruthy();
    expect(volChart).toBeTruthy();
    // price chart: candlestick only, no volume dataset
    expect(priceChart.data.datasets.length).toBe(1);
    expect(priceChart.data.datasets[0].type).toBe('candlestick');
    // volume chart: bar dataset with the same point count
    expect(volChart.data.datasets[0].data.length).toBe(priceChart.data.datasets[0].data.length);
    // shared x range: both charts' x scale min/max match
    expect(volChart.scales.x.min).toBe(priceChart.scales.x.min);
    expect(volChart.scales.x.max).toBe(priceChart.scales.x.max);
  });

  it('ZOOM: both panes have wheel+pan enabled with data limits (3.2)', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const priceChart: any = Chart.getChart(el.querySelector('[data-pane="price"] canvas') as HTMLCanvasElement);
    const volChart: any = Chart.getChart(el.querySelector('[data-pane="volume"] canvas') as HTMLCanvasElement);
    for (const [name, chart] of [['price', priceChart], ['volume', volChart]] as const) {
      const zoomOpts = chart.options.plugins?.zoom;
      expect(zoomOpts, name + ' has zoom options').toBeTruthy();
      expect(zoomOpts.zoom?.wheel?.enabled, name + ' wheel zoom').toBe(true);
      expect(zoomOpts.pan?.enabled, name + ' pan').toBe(true);
      expect(zoomOpts.limits?.x, name + ' x limits').toBeTruthy();
    }
    // limits must reference the data extent (no panning into the void)
    const lim = priceChart.options.plugins.zoom.limits.x;
    expect(lim.min).toBeLessThanOrEqual(priceChart.scales.x.min);
    expect(lim.max).toBeGreaterThanOrEqual(priceChart.scales.x.max);
  });

  it('ZOOM: reset button exists and calls resetZoom on BOTH panes (3.2)', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const resetBtn = el.querySelector('.reset-zoom-btn') as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    const priceChart: any = Chart.getChart(el.querySelector('[data-pane="price"] canvas') as HTMLCanvasElement);
    const volChart: any = Chart.getChart(el.querySelector('[data-pane="volume"] canvas') as HTMLCanvasElement);
    const pSpy = vi.spyOn(priceChart, 'resetZoom');
    const vSpy = vi.spyOn(volChart, 'resetZoom');
    resetBtn.click();
    expect(pSpy).toHaveBeenCalled();
    expect(vSpy).toHaveBeenCalled();
  });

  it('ZOOM: zooming the price pane syncs the volume pane x-range (3.2)', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const priceChart: any = Chart.getChart(el.querySelector('[data-pane="price"] canvas') as HTMLCanvasElement);
    const volChart: any = Chart.getChart(el.querySelector('[data-pane="volume"] canvas') as HTMLCanvasElement);
    // simulate a zoom on the price pane: zoomScale x to a sub-range
    const full = priceChart.scales.x;
    const subMin = full.min + (full.max - full.min) * 0.25;
    const subMax = full.min + (full.max - full.min) * 0.75;
    priceChart.zoomScale('x', { min: subMin, max: subMax });
    // the sync handler must apply the same range to the volume pane
    expect(volChart.scales.x.min).toBe(subMin);
    expect(volChart.scales.x.max).toBe(subMax);
  });

  it('createCharts guards against missing pane references (no crash)', () => {
    // Simulate the pre-fix crash condition: viewChildren undefined.
    (component as any).priceCanvas = undefined;
    (component as any).volumeCanvas = undefined;
    // Must NOT throw (pre-fix: "Cannot read properties of undefined (reading 'nativeElement')").
    expect(() => (component as any).createCharts([])).not.toThrow();
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
});
