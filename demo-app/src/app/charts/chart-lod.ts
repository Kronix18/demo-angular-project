/**
 * Level-of-detail helpers for the chart viewer. The chart never receives all
 * bars: only a window around the visible x-range, aggregated into at most
 * ~`maxPoints` buckets. That keeps pan/zoom smooth on 10k+ bar histories
 * (MSFT has ~40 years of daily data) and makes y-axes fit the visible bars.
 */
import { OHLCV } from '../core/models/ohlcv.model';

export interface LodPoint {
  /** Chart x position (bar-index units; centre of the bucket). */
  x: number;
  /** Index of the first bar in the bucket. */
  i: number;
  /** Bars aggregated into this point. */
  n: number;
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  up: boolean;
  /** closed at/above the previous bar's close (first bar: above its own open) */
  upPc: boolean;
}

/** Bars per point so that `visibleBars` fit into `maxPoints` points. */
export function chooseBucket(visibleBars: number, maxPoints: number): number {
  if (!(visibleBars > 0) || !(maxPoints > 0)) return 1;
  return Math.max(1, Math.ceil(visibleBars / maxPoints));
}

/** Bar-index window to load: the visible span plus half a span of buffer per side
 *  (every loaded point is drawn, so the buffer is kept small). */
export function loadWindow(min: number, max: number, count: number): { from: number; to: number } {
  const buffer = Math.max(1, (max - min) / 2);
  return {
    from: Math.max(0, Math.floor(min - buffer)),
    to: Math.min(count - 1, Math.ceil(max + buffer)),
  };
}

/**
 * Aggregate bars[from..to] into buckets aligned to global multiples of
 * `bucket` (so a bucket's contents don't change while the user pans).
 */
export function bucketWindow(bars: OHLCV[], from: number, to: number, bucket: number): LodPoint[] {
  if (!bars.length) return [];
  const step = Math.max(1, Math.floor(bucket));
  const lo = Math.max(0, Math.floor(from / step) * step);
  const hi = Math.min(bars.length - 1, Math.floor(to));
  const out: LodPoint[] = [];
  for (let start = lo; start <= hi; start += step) {
    const end = Math.min(start + step - 1, bars.length - 1);
    const first = bars[start];
    const last = bars[end];
    let h = first.high, l = first.low, v = 0;
    for (let k = start; k <= end; k++) {
      const b = bars[k];
      if (b.high > h) h = b.high;
      if (b.low < l) l = b.low;
      v += b.volume;
    }
    out.push({
      x: start + (end - start) / 2, i: start, n: end - start + 1, t: first.timestamp,
      o: first.open, h, l, c: last.close, v, up: last.close >= first.open,
      upPc: last.close >= (start > 0 ? bars[start - 1].close : first.open),
    });
  }
  return out;
}

/** Pad a data extent so lines don't touch the pane edges. */
export function fitRange(min: number, max: number, pad = 0.05): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  const span = max - min;
  if (span === 0) {
    const d = Math.abs(min) * pad || 1;
    return { min: min - d, max: max + d };
  }
  return { min: min - span * pad, max: max + span * pad };
}
