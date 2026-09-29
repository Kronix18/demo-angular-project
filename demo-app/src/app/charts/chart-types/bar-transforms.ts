/**
 * Bar transforms behind TradingView's non-standard chart styles. Every function
 * returns SYNTHETIC OHLCV bars, so the rest of the pipeline (LOD windowing,
 * volume, indicators, legend, drawings) works unchanged on them:
 *  - Heikin Ashi is index-aligned with the source bars.
 *  - Renko / Line break / Kagi / Point & Figure / Range are NOT time-based: one
 *    output bar per brick/segment/column, stamped with the source bar's time at
 *    which it completed, carrying the volume traded since the previous one.
 * Box/brick/reversal sizes default to ATR(14) of the source (TradingView's default method).
 */
import { OHLCV } from '../../core/models/ohlcv.model';
import { wilderAtr } from '../../core/indicators/indicator-math';

export type ChartType =
  | 'candles' | 'hollow' | 'ohlc' | 'hlc' | 'highlow' | 'columns'
  | 'line' | 'markers' | 'step' | 'area' | 'hlcarea' | 'baseline'
  | 'heikin' | 'renko' | 'linebreak' | 'kagi' | 'pnf' | 'range';

/** Styles whose bars are not the source bars 1:1 (the view cannot be carried over on a switch). */
export const NON_TIME_TYPES: ChartType[] = ['renko', 'linebreak', 'kagi', 'pnf', 'range'];

const EPS = 1e-9;

/** Box / brick size: ATR(14) at the last bar, with a positive fallback for short or flat data. */
export function boxSizeFor(bars: OHLCV[], length = 14): number {
  if (!bars.length) return 1;
  const atr = wilderAtr(bars, length);
  const last = atr[atr.length - 1];
  if (Number.isFinite(last) && last > 0) return last;
  const meanRange = bars.reduce((s, b) => s + (b.high - b.low), 0) / bars.length;
  if (meanRange > 0) return meanRange;
  return Math.max(Math.abs(bars[bars.length - 1].close) * 0.01, 0.01);
}

const mk = (timestamp: number, open: number, close: number, volume: number, high = Math.max(open, close), low = Math.min(open, close)): OHLCV =>
  ({ timestamp, open, high, low, close, volume });

export function heikinAshi(bars: OHLCV[]): OHLCV[] {
  const out: OHLCV[] = [];
  let pOpen = 0;
  let pClose = 0;
  bars.forEach((b, i) => {
    const close = (b.open + b.high + b.low + b.close) / 4;
    const open = i === 0 ? (b.open + b.close) / 2 : (pOpen + pClose) / 2;
    out.push({ timestamp: b.timestamp, open, close, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close), volume: b.volume });
    pOpen = open;
    pClose = close;
  });
  return out;
}

export function renko(bars: OHLCV[], box: number): OHLCV[] {
  if (!bars.length || !(box > 0)) return [];
  const out: OHLCV[] = [];
  const base = Math.floor(bars[0].close / box) * box;
  let dir = 0;
  let open = base;
  let close = base;
  let vol = 0;
  for (const bar of bars) {
    vol += bar.volume;
    const c = bar.close;
    let emitted = false;
    const push = (o: number, cl: number) => {
      out.push(mk(bar.timestamp, o, cl, emitted ? 0 : vol));
      if (!emitted) { vol = 0; emitted = true; }
    };
    for (;;) {
      if (dir === 0) {
        if (c >= base + box - EPS) { push(base, base + box); dir = 1; open = base; close = base + box; continue; }
        if (c <= base - box + EPS) { push(base, base - box); dir = -1; open = base; close = base - box; continue; }
        break;
      }
      if (dir === 1) {
        if (c >= close + box - EPS) { push(close, close + box); open = close; close += box; continue; }
        if (c <= open - box + EPS) { push(open, open - box); dir = -1; close = open - box; continue; }
        break;
      }
      if (c <= close - box + EPS) { push(close, close - box); open = close; close -= box; continue; }
      if (c >= open + box - EPS) { push(open, open + box); dir = 1; close = open + box; continue; }
      break;
    }
  }
  return out;
}

export function lineBreak(bars: OHLCV[], n = 3): OHLCV[] {
  if (bars.length < 2) return [];
  const lines: { o: number; c: number; ts: number; vol: number }[] = [];
  let vol = 0;
  let prev = bars[0].close;
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const c = b.close;
    vol += b.volume;
    const last = lines[lines.length - 1];
    let line: { o: number; c: number } | null = null;
    if (!last) {
      if (c !== prev) line = { o: prev, c };
    } else if (last.c > last.o) {
      if (c > last.c) line = { o: last.c, c };
      else if (c < Math.min(...lines.slice(-n).map((l) => Math.min(l.o, l.c)))) line = { o: last.o, c };
    } else if (c < last.c) {
      line = { o: last.c, c };
    } else if (c > Math.max(...lines.slice(-n).map((l) => Math.max(l.o, l.c)))) {
      line = { o: last.o, c };
    }
    if (line) { lines.push({ ...line, ts: b.timestamp, vol }); vol = 0; }
  }
  return lines.map((l) => mk(l.ts, l.o, l.c, l.vol));
}

export function kagi(bars: OHLCV[], reversal: number): OHLCV[] {
  if (bars.length < 2 || !(reversal > 0)) return [];
  const out: OHLCV[] = [];
  let dir = 0;
  let start = bars[0].close;
  let end = start;
  let endTs = bars[0].timestamp;
  let vol = 0;
  const flush = (nextStart: number) => { out.push(mk(endTs, start, end, vol)); vol = 0; start = nextStart; };
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const c = b.close;
    vol += b.volume;
    if (dir === 0) {
      if (c - start >= reversal - EPS) { dir = 1; end = c; endTs = b.timestamp; }
      else if (start - c >= reversal - EPS) { dir = -1; end = c; endTs = b.timestamp; }
    } else if (dir === 1) {
      if (c > end) { end = c; endTs = b.timestamp; }
      else if (end - c >= reversal - EPS) { const e = end; flush(e); dir = -1; end = c; endTs = b.timestamp; }
    } else if (c < end) { end = c; endTs = b.timestamp; }
    else if (c - end >= reversal - EPS) { const e = end; flush(e); dir = 1; end = c; endTs = b.timestamp; }
  }
  if (dir !== 0) out.push(mk(endTs, start, end, vol));
  return out;
}

/** X columns (rising, open < close) and O columns (falling); each column spans whole boxes on the price grid. */
export function pointAndFigure(bars: OHLCV[], box: number, reversal = 3): OHLCV[] {
  if (!bars.length || !(box > 0)) return [];
  const level = (p: number) => Math.floor(p / box + EPS);
  const out: OHLCV[] = [];
  const lv0 = level(bars[0].close);
  let dir = 0;
  let top = lv0;
  let bottom = lv0;
  let ts = bars[0].timestamp;
  let vol = 0;
  const column = (up: boolean, hi: number, lo: number, t: number, v: number) => {
    const high = (hi + 1) * box;
    const low = lo * box;
    return mk(t, up ? low : high, up ? high : low, v, high, low);
  };
  for (const b of bars) {
    const l = level(b.close);
    vol += b.volume;
    if (dir === 0) {
      if (l >= lv0 + 1) { dir = 1; top = l; bottom = lv0; ts = b.timestamp; }
      else if (l <= lv0 - 1) { dir = -1; bottom = l; top = lv0; ts = b.timestamp; }
    } else if (dir === 1) {
      if (l > top) { top = l; ts = b.timestamp; }
      else if (top - l >= reversal) {
        out.push(column(true, top, bottom, ts, vol - b.volume));
        vol = b.volume;
        dir = -1; top = top - 1; bottom = l; ts = b.timestamp;
      }
    } else if (l < bottom) { bottom = l; ts = b.timestamp; }
    else if (l - bottom >= reversal) {
      out.push(column(false, top, bottom, ts, vol - b.volume));
      vol = b.volume;
      dir = 1; bottom = bottom + 1; top = l; ts = b.timestamp;
    }
  }
  if (dir !== 0) out.push(column(dir === 1, top, bottom, ts, vol));
  return out;
}

/** Bars that each span exactly `range` in price (the last one may still be forming). */
export function rangeBars(bars: OHLCV[], range: number): OHLCV[] {
  if (!bars.length || !(range > 0)) return [];
  const out: OHLCV[] = [];
  let cur = { o: bars[0].open, h: bars[0].open, l: bars[0].open };
  let vol = 0;
  for (const b of bars) {
    vol += b.volume;
    let emitted = false;
    const emit = (o: number, h: number, l: number, c: number) => {
      out.push({ timestamp: b.timestamp, open: o, high: h, low: l, close: c, volume: emitted ? 0 : vol });
      if (!emitted) { vol = 0; emitted = true; }
    };
    const path = b.close >= b.open ? [b.open, b.low, b.high, b.close] : [b.open, b.high, b.low, b.close];
    for (const p of path) {
      for (;;) {
        const hi = Math.max(cur.h, p);
        const lo = Math.min(cur.l, p);
        if (hi - lo < range - EPS) { cur = { ...cur, h: hi, l: lo }; break; }
        if (p > cur.h) { const top = lo + range; emit(cur.o, top, lo, top); cur = { o: top, h: top, l: top }; }
        else { const bot = hi - range; emit(cur.o, hi, bot, bot); cur = { o: bot, h: bot, l: bot }; }
      }
    }
  }
  const last = bars[bars.length - 1];
  const lastClose = last.close;
  out.push({ timestamp: last.timestamp, open: cur.o, high: cur.h, low: cur.l, close: Math.min(Math.max(lastClose, cur.l), cur.h), volume: vol });
  return out;
}

/** Applies the style's bar transform (time-based styles return the SAME array). */
export function transformBars(bars: OHLCV[], type: ChartType): OHLCV[] {
  switch (type) {
    case 'heikin': return heikinAshi(bars);
    case 'renko': return renko(bars, boxSizeFor(bars));
    case 'linebreak': return lineBreak(bars, 3);
    case 'kagi': return kagi(bars, boxSizeFor(bars));
    case 'pnf': return pointAndFigure(bars, boxSizeFor(bars), 3);
    case 'range': return rangeBars(bars, boxSizeFor(bars));
    default: return bars;
  }
}
