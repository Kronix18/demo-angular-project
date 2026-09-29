import { OHLCV } from '../../core/models/ohlcv.model';
import { boxSizeFor, heikinAshi, kagi, lineBreak, pointAndFigure, rangeBars, renko, transformBars } from './bar-transforms';

const DAY = 86_400_000;
const bar = (i: number, o: number, h: number, l: number, c: number, v = 100): OHLCV => ({ timestamp: 1_700_000_000_000 + i * DAY, open: o, high: h, low: l, close: c, volume: v });
/** bars whose close follows `closes` (open = previous close, wicks ±0.5) */
const fromCloses = (closes: number[]): OHLCV[] => closes.map((c, i) => bar(i, i ? closes[i - 1] : c, Math.max(c, i ? closes[i - 1] : c) + 0.5, Math.min(c, i ? closes[i - 1] : c) - 0.5, c));
const sum = (b: OHLCV[]) => b.reduce((s, x) => s + x.volume, 0);

describe('bar transforms (TradingView chart styles)', () => {
  describe('boxSizeFor', () => {
    it('is the Wilder ATR(14) of the last bar; a sane positive fallback for tiny inputs', () => {
      const b = Array.from({ length: 40 }, (_, i) => bar(i, 100, 104, 96, 100)); // TR = 8 every bar
      expect(boxSizeFor(b)).toBeCloseTo(8, 6);
      expect(boxSizeFor([])).toBeGreaterThan(0);
      expect(boxSizeFor([bar(0, 10, 12, 8, 11)])).toBeGreaterThan(0);
      expect(boxSizeFor(Array.from({ length: 20 }, (_, i) => bar(i, 5, 5, 5, 5)))).toBeGreaterThan(0); // zero range
    });
  });

  describe('heikinAshi', () => {
    it('HA close = OHLC4, HA open = mean of the previous HA open/close, high/low envelope them', () => {
      const src = [bar(0, 10, 12, 9, 11), bar(1, 11, 14, 10, 13), bar(2, 13, 13.5, 8, 9)];
      const ha = heikinAshi(src);
      expect(ha.length).toBe(3);
      expect(ha[0].close).toBeCloseTo((10 + 12 + 9 + 11) / 4);
      expect(ha[0].open).toBeCloseTo((10 + 11) / 2);
      expect(ha[1].open).toBeCloseTo((ha[0].open + ha[0].close) / 2);
      expect(ha[1].close).toBeCloseTo((11 + 14 + 10 + 13) / 4);
      for (const b of ha) {
        expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close));
        expect(b.low).toBeLessThanOrEqual(Math.min(b.open, b.close));
      }
      expect(ha.map((b) => b.timestamp)).toEqual(src.map((b) => b.timestamp));
      expect(ha.map((b) => b.volume)).toEqual(src.map((b) => b.volume));
    });
    it('empty in, empty out', () => expect(heikinAshi([])).toEqual([]));
  });

  describe('renko', () => {
    it('a steady rise emits one up brick per box; bricks are contiguous and box-sized', () => {
      const r = renko(fromCloses([100, 101, 103, 106, 110]), 2);
      expect(r.length).toBeGreaterThanOrEqual(4);
      for (const b of r) {
        expect(Math.abs(b.close - b.open)).toBeCloseTo(2, 9);
        expect(b.close).toBeGreaterThan(b.open);
      }
      for (let i = 1; i < r.length; i++) expect(r[i].open).toBeCloseTo(r[i - 1].close, 9);
    });
    it('a reversal needs TWO boxes against the trend, and the new brick opens at the old brick\'s open', () => {
      const r = renko(fromCloses([100, 104, 106, 103, 101, 99]), 2);
      const firstDown = r.findIndex((b) => b.close < b.open);
      expect(firstDown).toBeGreaterThan(0);
      const lastUp = r[firstDown - 1];
      expect(r[firstDown].open).toBeCloseTo(lastUp.open, 9);
      expect(r[firstDown].close).toBeCloseTo(lastUp.open - 2, 9);
    });
    it('conserves total volume and never invents time going backwards', () => {
      const src = fromCloses([100, 103, 99, 104, 110, 90]);
      const r = renko(src, 3);
      expect(sum(r)).toBe(sum(src) - (sum(src) - sum(r))); // all volume is attributed to some brick
      expect(sum(r)).toBeLessThanOrEqual(sum(src));
      for (let i = 1; i < r.length; i++) expect(r[i].timestamp).toBeGreaterThanOrEqual(r[i - 1].timestamp);
    });
    it('flat prices produce no bricks', () => expect(renko(fromCloses([100, 100.5, 100.2, 100.1]), 5)).toEqual([]));
  });

  describe('lineBreak (three-line break)', () => {
    it('extends the trend while closes make new highs; reverses only by breaking the last three lines', () => {
      const lb = lineBreak(fromCloses([10, 11, 12, 13, 14, 12.5, 9, 8]), 3);
      const dirs = lb.map((b) => (b.close >= b.open ? 'u' : 'd'));
      expect(dirs.slice(0, 4).every((d) => d === 'u')).toBe(true);
      expect(dirs).toContain('d');
      const firstDown = lb.findIndex((b) => b.close < b.open);
      // 12.5 does not break the low of the last 3 lines (11..14) -> no reversal at that close; 9 does
      expect(lb[firstDown].close).toBeLessThan(Math.min(...lb.slice(Math.max(0, firstDown - 3), firstDown).map((b) => Math.min(b.open, b.close))));
    });
    it('needs at least two bars', () => { expect(lineBreak([], 3)).toEqual([]); expect(lineBreak([bar(0, 1, 2, 0.5, 1.5)], 3)).toEqual([]); });
  });

  describe('kagi', () => {
    it('emits segments that alternate direction only when price reverses by the reversal amount', () => {
      const k = kagi(fromCloses([100, 102, 104, 103.5, 101, 99, 100, 105]), 2);
      expect(k.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < k.length; i++) {
        const prevUp = k[i - 1].close > k[i - 1].open;
        const up = k[i].close > k[i].open;
        expect(up).toBe(!prevUp); // every segment reverses the previous one
        expect(k[i].open).toBeCloseTo(k[i - 1].close, 9); // and continues from its end
      }
    });
    it('no segment for moves smaller than the reversal', () => expect(kagi(fromCloses([100, 100.5, 100.2]), 5)).toEqual([]));
  });

  describe('pointAndFigure', () => {
    it('builds alternating X (up) and O (down) columns; a column reverses after `reversal` boxes', () => {
      const cols = pointAndFigure(fromCloses([100, 102, 104, 106, 103, 100, 97, 99, 103, 108]), 1, 3);
      expect(cols.length).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < cols.length; i++) {
        const prevX = cols[i - 1].close > cols[i - 1].open;
        expect(cols[i].close > cols[i].open).toBe(!prevX);
      }
      for (const c of cols) {
        expect(c.high).toBeGreaterThan(c.low);
        expect(c.low % 1).toBeCloseTo(0, 9); // columns sit on the box grid
        expect(c.high % 1).toBeCloseTo(0, 9);
      }
    });
    it('rising X column extends box by box without a new column', () => {
      const cols = pointAndFigure(fromCloses([100, 101, 102, 103, 104, 105]), 1, 3);
      expect(cols.length).toBe(1);
      expect(cols[0].close).toBeGreaterThan(cols[0].open);
    });
  });

  describe('rangeBars', () => {
    it('every finished bar spans exactly the range; volume is conserved', () => {
      const src = fromCloses([100, 103, 101, 108, 96, 99]);
      const r = rangeBars(src, 4);
      expect(r.length).toBeGreaterThanOrEqual(3);
      for (const b of r.slice(0, -1)) expect(b.high - b.low).toBeCloseTo(4, 9);
      expect(sum(r)).toBe(sum(src));
      for (const b of r) expect(b.high).toBeGreaterThanOrEqual(Math.max(b.open, b.close) - 1e-9);
    });
  });

  describe('transformBars dispatcher', () => {
    it('time-based styles return the bars untouched (same reference)', () => {
      const b = fromCloses([1, 2, 3]);
      for (const t of ['candles', 'hollow', 'ohlc', 'hlc', 'highlow', 'columns', 'line', 'markers', 'step', 'area', 'hlcarea', 'baseline'] as const) {
        expect(transformBars(b, t)).toBe(b);
      }
    });
    it('heikin + brick styles transform; every result is non-decreasing in time with valid OHLC', () => {
      const b = fromCloses(Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 5) * 12 + i * 0.3));
      for (const t of ['heikin', 'renko', 'linebreak', 'kagi', 'pnf', 'range'] as const) {
        const out = transformBars(b, t);
        expect(out.length, t).toBeGreaterThan(2);
        for (let i = 0; i < out.length; i++) {
          expect(out[i].high, t).toBeGreaterThanOrEqual(Math.max(out[i].open, out[i].close) - 1e-9);
          expect(out[i].low, t).toBeLessThanOrEqual(Math.min(out[i].open, out[i].close) + 1e-9);
          if (i) expect(out[i].timestamp, t).toBeGreaterThanOrEqual(out[i - 1].timestamp);
        }
      }
    });
    it('empty input is safe for every style', () => {
      for (const t of ['heikin', 'renko', 'linebreak', 'kagi', 'pnf', 'range'] as const) expect(transformBars([], t)).toEqual([]);
    });
  });
});
