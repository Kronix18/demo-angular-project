import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  /** Stub getContext on the canvas AFTER first detectChanges so we stub the
   *  exact DOM node Angular's @ViewChild binds to (re-created nodes would
   *  otherwise carry the stub away). Returns the stubbed canvas element. */
  function stubCanvas(): HTMLCanvasElement {
    fixture.detectChanges(); // first render — canvas now in DOM (2.2 fix)
    const canvasEl = fixture.nativeElement.querySelector('canvas');
    expect(canvasEl).toBeTruthy();
    canvasEl.getContext = (() => fakeCtx(canvasEl)) as unknown as typeof canvasEl.getContext;
    return canvasEl;
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
    // sanity: my stub must be live on this exact node
    expect(canvasEl.getContext('2d')).toBeTruthy();
    // and the component's viewChild must be THIS node
    expect(component.chartCanvas?.nativeElement).toBe(canvasEl);
    // ngOnInit already auto-loaded on create; flush that request first.
    const beforeFlush = fixture.nativeElement.querySelector('canvas');
    console.log('canvas identity before flush:', beforeFlush === canvasEl);
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    const afterFlush = fixture.nativeElement.querySelector('canvas');
    console.log('canvas identity after flush:', afterFlush === canvasEl, '| getContext after flush truthy:', !!afterFlush.getContext('2d'));
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    await fixture.whenStable();
    const instance = Chart.getChart(canvasEl);
    expect(instance).toBeTruthy(); // chart actually constructed
    expect(Object.keys((instance as any).scales)).toContain('x');
    expect(Object.keys((instance as any).scales)).toContain('y-price');
    expect(Object.keys((instance as any).scales)).toContain('y-volume');
  });

  it('volume dataset: bar type on y-volume axis, begins at zero', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    await fixture.whenStable();
    const inst: any = Chart.getChart(canvasEl);
    expect(inst).toBeTruthy();
    const volDataset = inst.data.datasets.find((d: any) => (d as any).type === 'bar' || d.label === 'Volume');
    expect(volDataset).toBeTruthy();
    expect(volDataset.yAxisID).toBe('y-volume');
    // bars must start at 0: beginAtZero on the volume scale (option-level check;
    // pixel/decimal proof is the live browser verification's job — jsdom has
    // no real canvas dimensions so getPixelForValue returns NaN here).
    const volScale = inst.scales['y-volume'];
    expect(volScale).toBeTruthy();
    expect(volScale.beginAtZero || inst.options.scales['y-volume'].beginAtZero).toBe(true);
  });

  it('volume values map each OHLCV point to {x, y: volume}', async () => {
    const canvasEl = stubCanvas();
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS); // ngOnInit's request
    await fixture.whenStable();
    const inst: any = Chart.getChart(canvasEl);
    const volDataset = inst.data.datasets.find((d: any) => d.label === 'Volume');
    const priceDataset = inst.data.datasets.find((d: any) => d.label === 'Price');
    console.log('CHART vol points:', volDataset.data.length, '| price points:', priceDataset.data.length,
      '| vol[0]:', JSON.stringify(volDataset.data[0]));
    expect(volDataset.data.length).toBe(priceDataset.data.length);
    expect(volDataset.data.length).toBe(3);
    expect(volDataset.data[0]).toEqual({ x: Date.UTC(2024, 0, 10), y: 1000 });
    expect(volDataset.data[volDataset.data.length - 1]).toEqual({ x: Date.UTC(2024, 0, 12), y: 900 });
  });
  it('createChart guards against a missing canvas reference (no crash)', () => {
    // Simulate the pre-fix crash condition: viewChild undefined.
    (component as any).chartCanvas = undefined;
    // Must NOT throw (pre-fix: "Cannot read properties of undefined (reading 'nativeElement')").
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
});
