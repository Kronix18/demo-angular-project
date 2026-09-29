import { OHLCV } from '../core/models/ohlcv.model';
import { bucketWindow, chooseBucket, loadWindow, fitRange } from './chart-lod';

const bar = (i: number, o = 10 + i, c = 11 + i): OHLCV => ({
  timestamp: 1_700_000_000_000 + i * 86_400_000, open: o, high: Math.max(o, c) + 1, low: Math.min(o, c) - 1, close: c, volume: 100 + i,
});
const bars = (n: number) => Array.from({ length: n }, (_, i) => bar(i));

describe('chart LOD helpers (level-of-detail windowing)', () => {
  it('chooseBucket: 1 bar per point until the visible span exceeds maxPoints', () => {
    expect(chooseBucket(100, 500)).toBe(1);
    expect(chooseBucket(500, 500)).toBe(1);
    expect(chooseBucket(501, 500)).toBe(2);
    expect(chooseBucket(10_000, 500)).toBe(20);
    expect(chooseBucket(0, 500)).toBe(1);
  });

  it('bucketWindow bucket=1: identity mapping with x = bar index', () => {
    const pts = bucketWindow(bars(10), 2, 5, 1);
    expect(pts.map((p) => p.x)).toEqual([2, 3, 4, 5]);
    expect(pts[0]).toMatchObject({ i: 2, n: 1, o: 12, c: 13, v: 102, up: true });
  });

  it('bucketWindow aggregates OHLCV: first open, max high, min low, last close, sum volume', () => {
    const b = bars(6);
    const [p] = bucketWindow(b, 0, 2, 3);
    expect(p.o).toBe(b[0].open);
    expect(p.c).toBe(b[2].close);
    expect(p.h).toBe(Math.max(b[0].high, b[1].high, b[2].high));
    expect(p.l).toBe(Math.min(b[0].low, b[1].low, b[2].low));
    expect(p.v).toBe(b[0].volume + b[1].volume + b[2].volume);
    expect(p.n).toBe(3);
    expect(p.x).toBe(1); // centre of bars 0..2
    expect(p.t).toBe(b[0].timestamp);
  });

  it('bucketWindow buckets are aligned to global multiples (stable while panning)', () => {
    const b = bars(30);
    const a = bucketWindow(b, 4, 20, 5);
    expect(a[0].i).toBe(0); // start snaps down to a multiple of the bucket
    const c = bucketWindow(b, 7, 25, 5);
    const shared = a.find((p) => p.i === 10)!;
    expect(c.find((p) => p.i === 10)).toEqual(shared);
  });

  it('bucketWindow handles the ragged last bucket and empty input', () => {
    const pts = bucketWindow(bars(7), 0, 6, 3);
    expect(pts.map((p) => p.n)).toEqual([3, 3, 1]);
    expect(bucketWindow([], 0, 10, 2)).toEqual([]);
  });

  it('loadWindow: visible span plus half a span of buffer each side, clamped', () => {
    expect(loadWindow(100, 150, 1000)).toEqual({ from: 75, to: 175 });
    expect(loadWindow(0, 40, 1000)).toEqual({ from: 0, to: 60 });
    expect(loadWindow(980, 999, 1000)).toEqual({ from: 970, to: 999 });
  });

  it('fitRange pads the data extent; flat data still gets a non-zero range', () => {
    const r = fitRange(100, 200, 0.05);
    expect(r.min).toBeCloseTo(95);
    expect(r.max).toBeCloseTo(205);
    const flat = fitRange(50, 50, 0.05);
    expect(flat.max).toBeGreaterThan(flat.min);
  });

  it('carries upPc: did the bucket close above the PREVIOUS bar\'s close (first bar: vs its own open)', () => {
    const b = [bar(0, 10, 11), bar(1, 20, 9), bar(2, 8, 12)];
    const pts = bucketWindow(b, 0, 2, 1);
    expect(pts.map((p) => p.upPc)).toEqual([true, false, true]);
    expect(bucketWindow(b, 1, 2, 2)[0].upPc).toBe(true); // bucket [1..2] closes at 12, previous close is 11
  });
});
