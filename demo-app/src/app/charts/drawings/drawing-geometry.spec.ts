import { OHLCV } from '../../core/models/ohlcv.model';
import { FIB_LEVELS, distToEllipse, distToPolyline, distToRectBorder, indexForTime, distToRay, distToSegment, measureInfo, snapToOhlc, timeForIndex } from './drawing-geometry';

const DAY = 86_400_000;
const bars = (n: number, step = DAY): OHLCV[] =>
  Array.from({ length: n }, (_, i) => ({ timestamp: 1_000_000 + i * step, open: 1, high: 2, low: 0.5, close: 1.5, volume: 1 }));

describe('drawing geometry', () => {
  it('indexForTime maps a timestamp to a (fractional) bar index; timeForIndex is its inverse', () => {
    const b = bars(10);
    expect(indexForTime(b, b[3].timestamp)).toBe(3);
    expect(indexForTime(b, b[3].timestamp + DAY / 2)).toBeCloseTo(3.5);
    expect(timeForIndex(b, 3)).toBe(b[3].timestamp);
    expect(timeForIndex(b, 3.5)).toBe(b[3].timestamp + DAY / 2);
    for (const i of [0, 1.25, 4.75, 9]) expect(indexForTime(b, timeForIndex(b, i))).toBeCloseTo(i);
  });

  it('a drawing survives switching to a coarser interval (same time -> different index)', () => {
    const daily = bars(20);
    const weekly = bars(4, 5 * DAY); // one bar per 5 days
    const t = daily[10].timestamp;
    expect(indexForTime(daily, t)).toBe(10);
    expect(indexForTime(weekly, t)).toBeCloseTo(2, 5);
  });

  it('clamps outside the data and copes with 0/1 bars', () => {
    const b = bars(5);
    expect(indexForTime(b, b[0].timestamp - 10 * DAY)).toBe(0);
    expect(indexForTime(b, b[4].timestamp + 10 * DAY)).toBe(4);
    expect(indexForTime([], 5)).toBe(0);
    expect(indexForTime(bars(1), 123)).toBe(0);
    expect(timeForIndex([], 3)).toBe(0);
    expect(timeForIndex(b, -5)).toBe(b[0].timestamp);
    expect(timeForIndex(b, 99)).toBe(b[4].timestamp);
  });

  it('distToSegment: perpendicular inside, endpoint distance outside, degenerate segment', () => {
    expect(distToSegment(5, 3, 0, 0, 10, 0)).toBe(3);
    expect(distToSegment(-4, 3, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(13, 4, 0, 0, 10, 0)).toBe(5);
    expect(distToSegment(3, 4, 0, 0, 0, 0)).toBe(5);
  });

  it('distToRay: extends only to the right of the start point', () => {
    expect(distToRay(50, 3, 0, 0)).toBe(3);
    expect(distToRay(-4, 3, 0, 0)).toBe(5);
  });

  it('distToRectBorder: distance to the nearest edge from inside or outside', () => {
    expect(distToRectBorder(5, 0, 0, 0, 10, 10)).toBe(0);      // on the top edge
    expect(distToRectBorder(5, 3, 0, 0, 10, 10)).toBe(3);      // inside: to the nearest edge
    expect(distToRectBorder(13, 5, 0, 0, 10, 10)).toBe(3);     // outside right
    expect(distToRectBorder(13, 14, 10, 10, 0, 0)).toBeCloseTo(5); // corners given in any order
  });

  it('distToEllipse: ~0 on the outline, grows away from it (inside and outside)', () => {
    expect(distToEllipse(10, 0, 0, 0, 10, 5)).toBeCloseTo(0, 6);
    expect(distToEllipse(0, 5, 0, 0, 10, 5)).toBeCloseTo(0, 6);
    expect(distToEllipse(20, 0, 0, 0, 10, 5)).toBeGreaterThan(4);
    expect(distToEllipse(0, 0, 0, 0, 10, 5)).toBeGreaterThan(4); // centre is far from the outline
    expect(distToEllipse(3, 3, 0, 0, 0, 0)).toBeCloseTo(Math.hypot(3, 3)); // degenerate ellipse = a point
  });

  it('distToPolyline: nearest segment; a single point behaves like a point', () => {
    expect(distToPolyline(5, 4, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(4);
    expect(distToPolyline(12, 5, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }])).toBe(2);
    expect(distToPolyline(3, 4, [{ x: 0, y: 0 }])).toBe(5);
    expect(distToPolyline(1, 1, [])).toBe(Infinity);
  });

  it('measureInfo: price change, percent, bar count and calendar days between two anchors', () => {
    const b = bars(30);
    const m = measureInfo(b, { t: b[5].timestamp, p: 100 }, { t: b[20].timestamp, p: 110 });
    expect(m.dPrice).toBeCloseTo(10);
    expect(m.pct).toBeCloseTo(10);
    expect(m.bars).toBe(15);
    expect(m.days).toBeCloseTo(15);
    const down = measureInfo(b, { t: b[20].timestamp, p: 110 }, { t: b[5].timestamp, p: 100 });
    expect(down.dPrice).toBeCloseTo(-10);
    expect(down.bars).toBe(15);            // bar count is an absolute distance
    expect(measureInfo(b, { t: 1, p: 0 }, { t: 2, p: 5 }).pct).toBe(0); // no division by zero
  });

  it('snapToOhlc: picks the nearest of open/high/low/close of the bar (magnet)', () => {
    const bar = { timestamp: 1, open: 10, high: 14, low: 8, close: 12, volume: 1 };
    expect(snapToOhlc(bar, 13.2)).toBe(14);
    expect(snapToOhlc(bar, 11.4)).toBe(12);
    expect(snapToOhlc(bar, 9.4)).toBe(10);
    expect(snapToOhlc(bar, 0)).toBe(8);
  });

  it('FIB_LEVELS are the classic retracement levels', () => {
    expect(FIB_LEVELS).toEqual([0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]);
  });
});
