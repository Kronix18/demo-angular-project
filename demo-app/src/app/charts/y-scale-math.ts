/** Pure range maths for manual price-scale interaction and logarithmic fitting. */
export interface Range { min: number; max: number; }

const AXIS_SENSITIVITY = 0.004; // scale factor per dragged pixel on the axis (exp)

/** Shift a range by a vertical mouse move (dragging DOWN reveals higher values). Log axes move by a constant ratio. */
export function panRange(r: Range, dyPx: number, heightPx: number, log: boolean): Range {
  if (!dyPx || !(heightPx > 0)) return r;
  if (log) {
    const f = Math.exp((dyPx * (Math.log(r.max) - Math.log(r.min))) / heightPx);
    return { min: r.min * f, max: r.max * f };
  }
  const d = (dyPx * (r.max - r.min)) / heightPx;
  return { min: r.min + d, max: r.max + d };
}

/** Scale a range around its centre (geometric centre on log axes); dragging DOWN zooms out. Never collapses to zero width. */
export function scaleRange(r: Range, dyPx: number, log: boolean): Range {
  const factor = Math.exp(dyPx * AXIS_SENSITIVITY);
  if (log) {
    const centre = Math.sqrt(r.min * r.max);
    const half = Math.max((Math.log(r.max / r.min) / 2) * factor, 1e-6);
    return { min: centre * Math.exp(-half), max: centre * Math.exp(half) };
  }
  const mid = (r.min + r.max) / 2;
  const half = Math.max(((r.max - r.min) / 2) * factor, Math.abs(mid) * 1e-6, 1e-9);
  return { min: mid - half, max: mid + half };
}

/** Multiplicative padding for a logarithmic axis; always strictly positive. */
export function fitRangeLog(min: number, max: number, pad = 0.05): Range {
  if (!Number.isFinite(min) && !Number.isFinite(max)) return { min: 1, max: 10 };
  const hi0 = Number.isFinite(max) && max > 0 ? max : NaN;
  const lo0 = Number.isFinite(min) && min > 0 ? min : NaN;
  const hi = Number.isNaN(hi0) ? (Number.isNaN(lo0) ? 10 : lo0 * 10) : hi0;
  const lo = Number.isNaN(lo0) ? hi / 1000 : lo0;
  const padLog = Math.max(Math.log(hi / lo) * pad, 0.01);
  return { min: lo * Math.exp(-padLog), max: hi * Math.exp(padLog) };
}
