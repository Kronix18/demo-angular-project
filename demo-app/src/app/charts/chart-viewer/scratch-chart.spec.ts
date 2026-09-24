// SCRATCH — technique validation only; deleted before any commit.
// This spec used the BROKEN side-effect import pattern (financial imported
// without prior registerables) and documents the resulting crash:
// "candlestick is not a registered controller". Superseded by
// scratch-chart2.spec.ts + the chart-setup.ts module (correct order +
// explicit named-controller registration). Kept only as a RED reference.
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import zoomPlugin from 'chartjs-plugin-zoom';

Chart.register(...registerables, zoomPlugin);

// jsdom has no ResizeObserver; Chart.js's responsive mode requires one.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

/** Proxy-based fake 2d context: absorbs every method call, returns sane values for getters. */
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

describe('SCRATCH: chart.js constructs under jsdom with proxy ctx', () => {
  it('constructs candlestick + bar with time scale', () => {
    const nativeCtx = document.createElement('canvas').getContext('2d');
    console.log('jsdom native getContext("2d"):', nativeCtx);

    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.getContext = (() => fakeCtx(canvas)) as unknown as typeof canvas.getContext;

    const t0 = Date.UTC(2026, 8, 1);
    const day = 86400000;
    const candles = Array.from({ length: 5 }, (_, i) => ({
      x: t0 + i * day, o: 100 + i, h: 110 + i, l: 90 + i, c: 105 + i,
    }));
    const volumes = candles.map((c, i) => ({ x: c.x, y: 1000 + i }));

    let chart: Chart | undefined;
    try {
      chart = new Chart(canvas, {
        type: 'candlestick',
        data: {
          datasets: [
            { type: 'candlestick', label: 'Price', data: candles, yAxisID: 'y-price' },
            { type: 'bar', label: 'Volume', data: volumes, yAxisID: 'y-volume' },
          ],
        } as any,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', time: { unit: 'day' }, ticks: { source: 'data' } },
            'y-price': { type: 'linear', position: 'left' },
            'y-volume': { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
          },
        } as any,
      });
    } catch (e) {
      console.log('CONSTRUCTION THREW:', (e as Error).stack?.slice(0, 600));
      throw e;
    }

    console.log('constructed:', !!chart, 'id:', chart?.id);
    expect(chart).toBeTruthy();
    expect(Chart.getChart(canvas)).toBe(chart);
    chart!.destroy();
  });
});
