import { OHLCV } from '../../core/models/ohlcv.model';
import { distToRay, distToSegment, indexForTime, timeForIndex } from './drawing-geometry';

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
});
