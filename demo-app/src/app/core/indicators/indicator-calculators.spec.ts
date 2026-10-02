import { OHLCV } from '../models/ohlcv.model';
import { bobMarley, movingAverage, sessionsPerBar, webbyRsi, rsi, atr } from './indicator-calculators';
import { ewm, resolveSource, shift, sma, smooth, wma } from './indicator-math';

const DAY = 86_400_000;
const bars = (n: number, step = DAY): OHLCV[] =>
  Array.from({ length: n }, (_, i) => {
    const c = 100 + Math.sin(i / 4) * 6 + i * 0.1;
    return { timestamp: 1_700_000_000_000 + i * step, open: c - 0.5, high: c + 1.5, low: c - 1.5, close: c, volume: 1000 + i };
  });

describe('indicator kernels & calculator options (coverage gate 7.1)', () => {
  describe('math kernels', () => {
    it('sma/wma yield NaN while any input in the window is NaN', () => {
      const v = [1, 2, NaN, 4, 5, 6];
      expect(sma(v, 2).map((x) => Number.isNaN(x))).toEqual([true, false, true, true, false, false]);
      expect(wma(v, 2).map((x) => Number.isNaN(x))).toEqual([true, false, true, true, false, false]);
      expect(sma(v, 0).every(Number.isNaN)).toBe(true);
      expect(wma(v, 0).every(Number.isNaN)).toBe(true);
    });

    it('ewm carries the previous value across a NaN input (pandas ignore_na=False) and honours min_periods', () => {
      const out = ewm([1, NaN, 3], 0.5, 1);
      expect(out[0]).toBe(1);
      expect(out[1]).toBe(1);
      expect(out[2]).toBeGreaterThan(1);
      expect(Number.isNaN(ewm([NaN, 1], 0.5, 1)[0])).toBe(true);
      expect(ewm([1, 2, 3], 0.5, 3).slice(0, 2).every(Number.isNaN)).toBe(true);
    });

    it('smooth rejects unknown methods; shift moves values both ways and 0 is a no-op', () => {
      expect(() => smooth([1], 'XMA', 1)).toThrowError(/Unsupported moving average/);
      const v = [1, 2, 3, 4];
      expect(shift(v, 0)).toBe(v);
      expect(shift(v, 1).map((x) => (Number.isNaN(x) ? null : x))).toEqual([null, 1, 2, 3]);
      expect(shift(v, -1).map((x) => (Number.isNaN(x) ? null : x))).toEqual([2, 3, 4, null]);
    });

    it('resolveSource derives hl2/hlc3/ohlc4 and rejects unknown sources', () => {
      const b = bars(1)[0];
      expect(resolveSource([b], ' HL2 ')[0]).toBeCloseTo((b.high + b.low) / 2);
      expect(resolveSource([b], 'hlc3')[0]).toBeCloseTo((b.high + b.low + b.close) / 3);
      expect(resolveSource([b], 'ohlc4')[0]).toBeCloseTo((b.open + b.high + b.low + b.close) / 4);
      expect(() => resolveSource([b], 'vwap')).toThrowError(/Unsupported indicator source/);
    });
  });

  describe('calculators', () => {
    it('moving_average: negative offset shifts back; every method runs', () => {
      const b = bars(60);
      const base = movingAverage(b, { method: 'SMA', length: 5 })['ma'];
      const back = movingAverage(b, { method: 'SMA', length: 5, offset: -2 })['ma'];
      expect(back[10]).toBeCloseTo(base[12], 9);
      for (const method of ['SMA', 'EMA', 'WMA', 'RMA']) {
        expect(movingAverage(b, { method, length: 5 })['ma'].some((x) => !Number.isNaN(x))).toBe(true);
      }
    });

    it('rsi/atr fall back to defaults when params are missing', () => {
      const b = bars(60);
      expect(rsi(b, {})['overbought'][0]).toBe(70);
      expect(rsi(b, {})['oversold'][0]).toBe(30);
      expect(atr(b, {})['atr'].some((x) => !Number.isNaN(x))).toBe(true);
    });

    it('webby_rsi: mode aliases, positive_only off keeps negatives, unknown mode throws', () => {
      const b = bars(120);
      expect(Object.keys(webbyRsi(b, { mode: 'classic' }))).toContain('signal');
      expect(Object.keys(webbyRsi(b, { mode: 'v1' }))).toContain('webby');
      expect(Object.keys(webbyRsi(b, { mode: '2.0' }))).toContain('above_21');
      expect(Object.keys(webbyRsi(b, { mode: 'v2' }))).toContain('below_21');
      // a falling market has lows below the EMA -> negative raw values survive when positive_only=false
      const falling = b.map((x, i) => ({ ...x, low: x.low - i, close: x.close - i * 0.5 }));
      const kept = webbyRsi(falling, { mode: 'Original', positive_only: false })['webby'];
      expect(kept.some((v) => v < 0)).toBe(true);
      const masked = webbyRsi(falling, { mode: 'Original', positive_only: true })['webby'];
      expect(masked.some((v) => v < 0)).toBe(false);
      expect(() => webbyRsi(b, { mode: 'nope' })).toThrowError(/Unsupported Webby RSI mode/);
    });

    it('bob_marley: every high reference + close source; unknown reference throws; empty input', () => {
      const b = bars(300);
      for (const high_reference of ['52_week', '50_day', '18_month', 'all_time']) {
        const r = bobMarley(b, { high_reference });
        expect(r['green_boundary'].length).toBe(300);
        const zones = r['green'].concat(r['yellow'], r['red']);
        expect(zones.some((v) => !Number.isNaN(v))).toBe(true);
      }
      const close = bobMarley(b, { source: 'close', green_max: 1, yellow_max: 2 });
      expect(close['red'].some((v) => !Number.isNaN(v))).toBe(true);
      expect(() => bobMarley(b, { high_reference: 'lifetime' })).toThrowError(/Unsupported high reference/);
      expect(bobMarley([], {})['green']).toEqual([]);
    });

    it('sessionsPerBar maps the median bar spacing to trading sessions per bar', () => {
      expect(sessionsPerBar(bars(1))).toBe(1);
      expect(sessionsPerBar(bars(10, DAY))).toBe(1);
      expect(sessionsPerBar(bars(10, 7 * DAY))).toBe(5);
      expect(sessionsPerBar(bars(10, 30 * DAY))).toBe(21);
      expect(sessionsPerBar(bars(10, 91 * DAY))).toBe(63);
      expect(sessionsPerBar(bars(10, 180 * DAY))).toBe(126);
      expect(sessionsPerBar(bars(10, 365 * DAY))).toBe(252);
      expect(sessionsPerBar(bars(4, DAY))).toBe(1); // even count -> mean of the middle gaps
    });
  });
});
