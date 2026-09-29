import { OHLCV } from '../../core/models/ohlcv.model';

/** A chart anchor in DATA coordinates (time + price) — independent of interval, zoom and LOD bucketing. */
export interface Anchor { t: number; p: number; }

export type DrawingType = 'trend' | 'arrow' | 'ray' | 'hline' | 'vline' | 'channel' | 'rect' | 'ellipse' | 'fib' | 'brush' | 'text';

export interface DrawingStyle {
  color?: string;
  width?: number;
  dash?: 'solid' | 'dash' | 'dot';
}

export interface Drawing {
  id: string;
  type: DrawingType;
  a: Anchor;
  /** second anchor (trend, channel base line); absent for a horizontal ray */
  b?: Anchor;
  /** channel: price distance of the parallel line from the base line */
  offset?: number;
  /** text label */
  text?: string;
  /** freehand brush points */
  pts?: Anchor[];
  style?: DrawingStyle;
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

export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

/** Distance from a point to the border of the axis-aligned rectangle spanned by two corners (any order). */
export function distToRectBorder(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const l = Math.min(x1, x2), r = Math.max(x1, x2), t = Math.min(y1, y2), b = Math.max(y1, y2);
  return Math.min(
    distToSegment(px, py, l, t, r, t), distToSegment(px, py, r, t, r, b),
    distToSegment(px, py, r, b, l, b), distToSegment(px, py, l, b, l, t),
  );
}

/** Approximate distance to an ellipse outline (centre + radii), in pixels. */
export function distToEllipse(px: number, py: number, cx: number, cy: number, rx: number, ry: number): number {
  if (rx < 1e-6 || ry < 1e-6) return Math.hypot(px - cx, py - cy);
  const d = Math.hypot((px - cx) / rx, (py - cy) / ry);
  return Math.abs(d - 1) * Math.min(rx, ry);
}

export function distToPolyline(px: number, py: number, pts: { x: number; y: number }[]): number {
  if (!pts.length) return Infinity;
  if (pts.length === 1) return Math.hypot(px - pts[0].x, py - pts[0].y);
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(px, py, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y));
  return best;
}

/** Readout for the measure tool. */
export function measureInfo(bars: OHLCV[], a: Anchor, b: Anchor): { dPrice: number; pct: number; bars: number; days: number } {
  const dPrice = b.p - a.p;
  return {
    dPrice,
    pct: a.p ? (dPrice / a.p) * 100 : 0,
    bars: Math.round(Math.abs(indexForTime(bars, b.t) - indexForTime(bars, a.t))),
    days: Math.abs(b.t - a.t) / 86_400_000,
  };
}

/** Magnet: the nearest of the bar's open/high/low/close to `price`. */
export function snapToOhlc(bar: OHLCV, price: number): number {
  return [bar.open, bar.high, bar.low, bar.close].reduce((best, v) => (Math.abs(v - price) < Math.abs(best - price) ? v : best));
}
