import { OHLCV } from '../../core/models/ohlcv.model';

/** A chart anchor in DATA coordinates (time + price) — independent of interval, zoom and LOD bucketing. */
export interface Anchor { t: number; p: number; }

export type DrawingType = 'trend' | 'ray' | 'channel';

export interface Drawing {
  id: string;
  type: DrawingType;
  a: Anchor;
  /** second anchor (trend, channel base line); absent for a horizontal ray */
  b?: Anchor;
  /** channel: price distance of the parallel line from the base line */
  offset?: number;
}

/** Fractional bar index for a timestamp (linear between neighbouring bars, clamped to the data). */
export function indexForTime(bars: OHLCV[], t: number): number {
  const n = bars.length;
  if (n < 2) return 0;
  if (t <= bars[0].timestamp) return 0;
  if (t >= bars[n - 1].timestamp) return n - 1;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].timestamp <= t) lo = mid; else hi = mid;
  }
  return lo + (t - bars[lo].timestamp) / (bars[lo + 1].timestamp - bars[lo].timestamp);
}

/** Inverse of indexForTime. */
export function timeForIndex(bars: OHLCV[], i: number): number {
  const n = bars.length;
  if (!n) return 0;
  const c = Math.min(Math.max(i, 0), n - 1);
  const lo = Math.floor(c);
  if (lo >= n - 1) return bars[n - 1].timestamp;
  return bars[lo].timestamp + (c - lo) * (bars[lo + 1].timestamp - bars[lo].timestamp);
}

/** Pixel distance from a point to a segment. */
export function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + u * dx), py - (ay + u * dy));
}

/** Pixel distance from a point to a horizontal ray that starts at (ax, ay) and runs to the right. */
export function distToRay(px: number, py: number, ax: number, ay: number): number {
  return px >= ax ? Math.abs(py - ay) : Math.hypot(px - ax, py - ay);
}
