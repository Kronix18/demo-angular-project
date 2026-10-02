import { OHLCV } from '../models/ohlcv.model';
import {
  Series, constSeries, nanSeries, resolveSource, shift, sma, ema, smooth, trueRange, wilderAtr,
} from './indicator-math';

export type Params = Record<string, unknown>;
export type CalcOutputs = Record<string, Series>;

const num = (p: Params, k: string, d: number): number => {
  const v = p[k];
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
};
const str = (p: Params, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d);
const bool = (p: Params, k: string, d: boolean): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d);

export function movingAverage(bars: OHLCV[], p: Params): CalcOutputs {
  const ma = smooth(resolveSource(bars, str(p, 'source', 'close')), str(p, 'method', 'SMA'), num(p, 'length', 50));
  return { ma: shift(ma, num(p, 'offset', 0)) };
}

export function rsi(bars: OHLCV[], p: Params): CalcOutputs {
  const n = bars.length;
  const length = num(p, 'length', 14);
  const src = resolveSource(bars, str(p, 'source', 'close'));
  const gain = nanSeries(n);
  const loss = nanSeries(n);
  for (let i = 1; i < n; i++) {
    const d = src[i] - src[i - 1];
    gain[i] = Number.isNaN(d) ? NaN : Math.max(d, 0);
    loss[i] = Number.isNaN(d) ? NaN : -Math.min(d, 0);
  }
  const avgGain = smooth(gain, 'RMA', length);
  const avgLoss = smooth(loss, 'RMA', length);
  const out = nanSeries(n);
  for (let i = 0; i < n; i++) {
    const g = avgGain[i];
    const l = avgLoss[i];
    if (Number.isNaN(g) || Number.isNaN(l)) continue;
    if (g === 0 && l === 0) out[i] = 50;
    else if (l === 0) out[i] = 100;
    else out[i] = 100 - 100 / (1 + g / l);
  }
  return {
    rsi: out,
    overbought: constSeries(n, num(p, 'overbought', 70)),
    oversold: constSeries(n, num(p, 'oversold', 30)),
  };
}

export function atr(bars: OHLCV[], p: Params): CalcOutputs {
  return { atr: smooth(trueRange(bars), str(p, 'smoothing', 'RMA'), num(p, 'length', 14)) };
}

const ORIGINAL_ALIASES = new Set(['original', 'classic', '1.0', 'v1']);
const V5150_ALIASES = new Set(['5.150', '5150', '2.0', '2', 'v2']);

/** `webby_rsi.py` dispatcher + `webby_rsi_core.py` (original / version_5150). */
export function webbyRsi(bars: OHLCV[], p: Params): CalcOutputs {
  const mode = str(p, 'mode', '5.150').trim().toLowerCase();
  const n = bars.length;
  const emaLen = num(p, 'ema_length', 21);
  const e = ema(bars.map((b) => b.close), emaLen);

  if (ORIGINAL_ALIASES.has(mode)) {
    const raw = bars.map((b, i) => ((b.low - e[i]) / b.close) * 100);
    const signalRaw = sma(raw, num(p, 'signal_length', 10));
    // Python golden: SMA runs on the UNMASKED series; positive_only masks both afterwards.
    const mask = bool(p, 'positive_only', true) ? (v: number) => (v < 0 ? NaN : v) : (v: number) => v;
    const webby = raw.map(mask);
    const signal = signalRaw.map(mask);
    return {
      webby,
      signal,
      level_0: constSeries(n, 0), level_05: constSeries(n, 0.5), level_2: constSeries(n, 2),
      level_4: constSeries(n, 4), level_6: constSeries(n, 6),
    };
  }
  if (V5150_ALIASES.has(mode)) {
    const a = wilderAtr(bars, num(p, 'atr_length', 50));
    const s = sma(bars.map((b) => b.close), num(p, 'sma_length', 10));
    const pos = (v: number) => (v > 0 ? v : NaN);
    return {
      above_21: bars.map((b, i) => pos((b.low - e[i]) / a[i])),
      below_21: bars.map((b, i) => pos((e[i] - b.high) / a[i])),
      sma_extension: bars.map((b, i) => pos((b.high - s[i]) / a[i])),
      stretched: constSeries(n, num(p, 'stretched_level', 3)),
    };
  }
  throw new Error(`Unsupported Webby RSI mode: ${p['mode']}`);
}

/** Median spacing between bars (days) → trading sessions per bar. */
export function sessionsPerBar(bars: OHLCV[]): number {
  if (bars.length < 2) return 1;
  const gaps = bars.slice(1).map((b, i) => (b.timestamp - bars[i].timestamp) / 86_400_000).sort((x, y) => x - y);
  const mid = gaps.length >> 1;
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  if (median <= 3) return 1;
  if (median <= 10) return 5;
  if (median <= 45) return 21;
  if (median <= 120) return 63;
  if (median <= 240) return 126;
  return 252;
}

const TARGET_SESSIONS: Record<string, number> = { '50_day': 50, '52_week': 252, '18_month': 378 };

export function bobMarley(bars: OHLCV[], p: Params): CalcOutputs {
  const n = bars.length;
  const greenMax = num(p, 'green_max', 4);
  const yellowMax = num(p, 'yellow_max', 8);
  const green = nanSeries(n), yellow = nanSeries(n), red = nanSeries(n);
  if (n === 0) {
    return { green, yellow, red, green_boundary: [], red_boundary: [] };
  }
  const ref = str(p, 'high_reference', '52_week');
  const highs = bars.map((b) => b.high);
  const refHigh = nanSeries(n);
  if (ref === 'all_time') {
    let m = -Infinity;
    for (let i = 0; i < n; i++) { m = Math.max(m, highs[i]); refHigh[i] = m; }
  } else {
    const target = TARGET_SESSIONS[ref];
    if (target === undefined) throw new Error(`Unsupported high reference: ${ref}`);
    const lookback = Math.max(1, Math.round(target / sessionsPerBar(bars)));
    for (let i = 0; i < n; i++) {
      let m = -Infinity;
      for (let j = Math.max(0, i - lookback + 1); j <= i; j++) m = Math.max(m, highs[j]);
      refHigh[i] = m;
    }
  }
  const price = bars.map((b) => (str(p, 'source', 'low') === 'close' ? b.close : b.low));
  const a = wilderAtr(bars, num(p, 'atr_length', 21));
  for (let i = 0; i < n; i++) {
    const d = Math.max((refHigh[i] - price[i]) / a[i], 0);
    if (Number.isNaN(d)) continue;
    if (d <= greenMax) green[i] = d;
    else if (d <= yellowMax) yellow[i] = d;
    else red[i] = d;
  }
  return { green, yellow, red, green_boundary: constSeries(n, greenMax), red_boundary: constSeries(n, yellowMax) };
}
