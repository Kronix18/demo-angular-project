// SCRATCH — validates the registration-module pattern for 2.2.
// chartjs-chart-financial needs Chart.register(...registerables) to have run
// BEFORE its import (ESM hoisting makes same-file ordering impossible).
// Pattern: a tiny chart-setup module registers first; the component imports
// chart-setup BEFORE the financial plugin.
import { Chart, registerables } from 'chart.js';
import '../chart-setup'; // registers registerables + adapter + zoom (must precede financial import)
import 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';

// Re-register zoom here too (duplicate-safe, verified) to mirror component usage.
Chart.register(zoomPlugin);

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = ResizeObserverStub;
}

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

describe('SCRATCH: chart-setup module pattern works under jsdom', () => {
  it('constructs candlestick + bar with time scale when setup precedes financial import', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    canvas.getContext = (() => fakeCtx(canvas)) as unknown as typeof canvas.getContext;

    const t0 = Date.UTC(2026, 8, 1);
    const day = 86400000;
    const candles = Array.from({ length: 5 }, (_, i) => ({
      x: t0 + i * day, o: 100 + i, h: 110 + i, l: 90 + i, c: 105 + i,
    }));
    const volumes = candles.map((c, i) => ({ x: c.x, y: 1000 + i }));

    const chart = new Chart(canvas, {
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

    console.log('constructed:', !!chart, 'scales:', Object.keys(chart.scales || {}));
    expect(chart).toBeTruthy();
    expect(Chart.getChart(canvas)).toBe(chart);
    expect(Object.keys(chart.scales)).toContain('x');
    expect(Object.keys(chart.scales)).toContain('y-price');
    expect(Object.keys(chart.scales)).toContain('y-volume');
    chart.destroy();
  });
});
