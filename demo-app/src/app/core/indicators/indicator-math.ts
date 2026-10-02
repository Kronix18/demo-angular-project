/**
 * Pure numeric kernels ported from the Python calculators
 * (screener/viewingApp/indicators/calculators/*). They intentionally reproduce
 * pandas semantics (ewm adjust=False seed/min_periods, rolling min_periods) —
 * NOT the textbook formulas — so results match the Python reference 1:1.
 * `NaN` marks "no value" internally; the service maps it to `null` at the edge.
 */
import { OHLCV } from '../models/ohlcv.model';

export type Series = number[];

export const nanSeries = (n: number): Series => new Array<number>(n).fill(NaN);
export const constSeries = (n: number, v: number): Series => new Array<number>(n).fill(v);

/** pandas `rolling(length, min_periods=length).mean()` (any NaN in window → NaN). */
export function sma(values: Series, length: number): Series {
  const out = nanSeries(values.length);
  if (length < 1) return out;
  let sum = 0;
  let bad = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (Number.isNaN(v)) bad++; else sum += v;
    if (i >= length) {
      const old = values[i - length];
      if (Number.isNaN(old)) bad--; else sum -= old;
    }
    if (i >= length - 1 && bad === 0) out[i] = sum / length;
  }
  return out;
}

/**
 * pandas `ewm(alpha, adjust=False, min_periods).mean()` incl. NaN handling
 * (ignore_na=False: a NaN input carries the previous value and decays its weight).
 */
export function ewm(values: Series, alpha: number, minPeriods: number): Series {
  const out = nanSeries(values.length);
  let weighted = NaN;
  let oldWt = 1;
  let seen = 0;
  for (let i = 0; i < values.length; i++) {
    const cur = values[i];
    if (!Number.isNaN(weighted)) oldWt *= 1 - alpha;
    if (!Number.isNaN(cur)) {
      seen++;
      if (Number.isNaN(weighted)) {
        weighted = cur;
      } else {
        weighted = (oldWt * weighted + alpha * cur) / (oldWt + alpha);
      }
      oldWt = 1;
    }
    if (seen >= minPeriods && !Number.isNaN(weighted)) out[i] = weighted;
  }
  return out;
}

/** pandas `ewm(span=length, adjust=False, min_periods=length)`. */
export const ema = (values: Series, length: number): Series =>
  ewm(values, 2 / (length + 1), length);

/** Wilder / RMA: pandas `ewm(alpha=1/length, adjust=False, min_periods=length)`. */
export const rma = (values: Series, length: number): Series =>
  ewm(values, 1 / length, length);

/** Weighted MA with weights 1..length (newest bar heaviest). */
export function wma(values: Series, length: number): Series {
  const out = nanSeries(values.length);
  if (length < 1) return out;
  const denom = (length * (length + 1)) / 2;
  for (let i = length - 1; i < values.length; i++) {
    let acc = 0;
    let ok = true;
    for (let k = 0; k < length; k++) {
      const v = values[i - length + 1 + k];
      if (Number.isNaN(v)) { ok = false; break; }
      acc += v * (k + 1);
    }
    if (ok) out[i] = acc / denom;
  }
  return out;
}

export type MaMethod = 'SMA' | 'EMA' | 'WMA' | 'RMA';

export function smooth(values: Series, method: string, length: number): Series {
  switch (method.toUpperCase()) {
    case 'SMA': return sma(values, length);
    case 'EMA': return ema(values, length);
    case 'WMA': return wma(values, length);
    case 'RMA': return rma(values, length);
    default: throw new Error(`Unsupported moving average method: ${method}`);
  }
}

/** pandas `shift(offset)`; positive = values move to later bars. */
export function shift(values: Series, offset: number): Series {
  if (!offset) return values;
  const n = values.length;
  const out = nanSeries(n);
  for (let i = 0; i < n; i++) {
    const j = i - offset;
    if (j >= 0 && j < n) out[i] = values[j];
  }
  return out;
}

export const SOURCE_CHOICES = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'volume'] as const;
export type SourceKey = (typeof SOURCE_CHOICES)[number];

/** Port of `indicators/sources.py::resolve_source`. */
export function resolveSource(bars: OHLCV[], source: string): Series {
  const key = String(source).trim().toLowerCase();
  switch (key) {
    case 'open': case 'high': case 'low': case 'close': case 'volume':
      return bars.map((b) => b[key]);
    case 'hl2': return bars.map((b) => (b.high + b.low) / 2);
    case 'hlc3': return bars.map((b) => (b.high + b.low + b.close) / 3);
    case 'ohlc4': return bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
    default: throw new Error(`Unsupported indicator source: ${source}`);
  }
}

/** True range; first bar has no previous close → high − low. */
export function trueRange(bars: OHLCV[]): Series {
  return bars.map((b, i) => {
    if (i === 0) return b.high - b.low;
    const pc = bars[i - 1].close;
    return Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
  });
}

/** `webby_rsi_core.wilder_atr` — shared by Webby RSI and Bob Marley. */
export const wilderAtr = (bars: OHLCV[], length: number): Series => rma(trueRange(bars), length);
