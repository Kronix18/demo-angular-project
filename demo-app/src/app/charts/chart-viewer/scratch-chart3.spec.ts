// SCRATCH 3 — tests module-dedup: does the spec's Chart instance share the
// registry that chart-setup populated?
import { Chart } from 'chart.js';
import '../chart-setup';

describe('SCRATCH3: registry dedup under ng test', () => {
  it('sees candlestick registered from chart-setup import', () => {
    const has = (fn: () => void) => { try { fn(); return true; } catch { return false; } };
    const candlestick = has(() => Chart.registry.getController('candlestick'));
    const time = has(() => Chart.registry.getScale('time'));
    const zoom = has(() => Chart.registry.getPlugin('zoom'));
    console.log('candlestick:', candlestick, '| time:', time, '| zoom:', zoom);
    expect(candlestick).toBe(true);
    expect(time).toBe(true);
  });
});
