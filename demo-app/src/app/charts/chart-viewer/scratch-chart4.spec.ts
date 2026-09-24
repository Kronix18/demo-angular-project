// SCRATCH 4 — where does chartjs-chart-financial's candlestick registration land?
// Hypothesis: financial imports its OWN chart.js copy (ESM) whose registry is
// separate from the CJS-interop Chart this spec sees.
import { Chart, registerables } from 'chart.js';
import '../chart-setup'; // registerables + adapter + zoom
import 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import { CandlestickController } from 'chartjs-chart-financial';

describe('SCRATCH4: financial controller registration target', () => {
  it('locates CandlestickController and registers it explicitly on this Chart copy', () => {
    const has = (fn: () => void) => { try { fn(); return true; } catch { return false; } };
    console.log('before explicit register — candlestick:', has(() => Chart.registry.getController('candlestick')));
    console.log('CandlestickController import:', typeof CandlestickController);
    Chart.register(CandlestickController);
    console.log('after explicit register — candlestick:', has(() => Chart.registry.getController('candlestick')));
    expect(has(() => Chart.registry.getController('candlestick'))).toBe(true);
  });
});
