import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartViewerComponent } from './chart-viewer.component';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpClient, provideHttpClient, withFetch } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Chart, registerables } from 'chart.js';
import { of, throwError } from 'rxjs';
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

/** Proxy-based fake 2d context: absorbs every method call (jsdom has no canvas impl). */
function fakeCtx(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const target: Record<string, unknown> = { canvas };
  return new Proxy(target, {
    get(t, p) {
      if (p === 'canvas') return t['canvas'];
      if (p === 'measureText') return () => ({ width: 10, actualBoundingBoxAscent: 5 });
      if (p === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern')
        return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; },
  }) as unknown as CanvasRenderingContext2D;
}

describe('ChartViewerComponent — chart.js registration & canvas timing (task 2.2)', () => {
  let fixture: ComponentFixture<ChartViewerComponent>;
  let component: ChartViewerComponent;
  let httpMock: HttpTestingController;

  const MSFT_ROWS = [
    'MSFT.US,D,20240110,000000,100,110,95,105,1000,0',
    'MSFT.US,D,20240111,000000,105,115,100,112,1200,0',
    'MSFT.US,D,20240112,000000,112,120,108,118,900,0',
  ].join('\r\n');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartViewerComponent, FormsModule],
      providers: [
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
    // jsdom: stub getContext BEFORE any detectChanges so createChart can run.
    const canvasEl = fixture.nativeElement.querySelector('canvas');
    if (canvasEl) {
      canvasEl.getContext = (() => fakeCtx(canvasEl)) as unknown as typeof canvasEl.getContext;
    }
  });

  afterEach(() => {
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

  it('constructs a real Chart instance when data arrives (no nativeElement crash)', () => {
    fixture.detectChanges(); // canvas in DOM, stubbed
    component.loadChartData('msft', '1d');
    httpMock.expectOne('test-data/msft.us.txt').flush(MSFT_ROWS);
    // allow the subscribe callback to run
    expect(component.loading).toBe(false);
    expect(component.error).toBeNull();
    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const instance = Chart.getChart(canvas);
    expect(instance).toBeTruthy(); // chart actually constructed
    expect(Object.keys((instance as any).scales)).toContain('x');
    expect(Object.keys((instance as any).scales)).toContain('y-price');
    expect(Object.keys((instance as any).scales)).toContain('y-volume');
  });

  it('createChart guards against a missing canvas reference (no crash)', () => {
    // Simulate the pre-fix crash condition: viewChild undefined.
    (component as any).chartCanvas = undefined;
    // Must NOT throw (pre-fix: "Cannot read properties of undefined (reading 'nativeElement')").
    expect(() => (component as any).createChart([])).not.toThrow();
  });

  it('error path: service failure shows the error element and no stuck loading', () => {
    fixture.detectChanges();
    component.loadChartData('msft', '1d');
    httpMock.expectOne('test-data/msft.us.txt').flush('server exploded', { status: 500, statusText: 'Server Error' });
    expect(component.loading).toBe(false);
    expect(component.error).toBeTruthy();
    fixture.detectChanges();
    const errEl = fixture.nativeElement.querySelector('.error-message');
    expect(errEl).toBeTruthy();
  });
});
