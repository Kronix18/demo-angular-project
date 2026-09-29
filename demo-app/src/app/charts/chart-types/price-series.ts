import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartType } from '../../core/models/chart-type';
import { LodPoint } from '../chart-lod';
import { PriceSource } from '../../core/models/symbol-settings';

/** Builds a dataset's data array from the current level-of-detail points. */
export type DataBuilder = (pts: LodPoint[]) => any[];
export interface SeriesEntry { dataset: any; builder: DataBuilder; }

/** Resolved theme colours + per-chart values the price series needs (canvas cannot use var()). */
export interface PriceStyleCtx {
  up: string; down: string; muted: string;
  upFill: string; downFill: string;
  line: string; area: string;
  /** Baseline style: the value the line is measured against. */
  baseline: number;
  /** Box size behind the Point & Figure glyphs. */
  box: number;
  /** legend settings (11.6) */
  byPrevClose?: boolean;
  width?: number;
  source?: PriceSource;
}

/** What a line-family style plots for a (bucketed) bar. */
export function sourceValue(p: LodPoint, source: PriceSource = 'close'): number {
  switch (source) {
    case 'open': return p.o;
    case 'high': return p.h;
    case 'low': return p.l;
    case 'hl2': return (p.h + p.l) / 2;
    case 'hlc3': return (p.h + p.l + p.c) / 3;
    case 'ohlc4': return (p.o + p.h + p.l + p.c) / 4;
    default: return p.c;
  }
}

/** Same colour for every direction, so the element's own open/close test cannot override ours. */
const uniform = (color: string) => ({ up: color, down: color, unchanged: color });

export function lineDataset(label: string, yAxisID: string, color: string, width: number, dash: number[], hidden = false) {
  return {
    type: 'line' as const, label, yAxisID, data: [] as any[], hidden,
    borderColor: color, backgroundColor: color, borderWidth: width, borderDash: dash,
    pointRadius: 0, pointHoverRadius: 3, tension: 0, spanGaps: false,
    parsing: false, normalized: true,
  };
}

const ohlcPoint = (p: LodPoint, byPrev?: boolean) => ({ x: p.x, o: p.o, h: p.h, l: p.l, c: p.c, t: p.t, ...(byPrev ? { dir: p.upPc ? 'up' : 'down' } : {}) });

/** Base of the OHLC-shaped styles: candlestick (candles/hollow/alternative charts) or our tvbar (bars/HLC/high-low). */
function ohlcSeries(type: 'candlestick' | 'tvbar', c: PriceStyleCtx, extra: Record<string, unknown> = {}, hollow = false): SeriesEntry {
  const colors = { up: c.up, down: c.down, unchanged: c.muted };
  const byPrev = !!c.byPrevClose;
  // by previous close the direction rides on the point (`dir`); a scriptable option then
  // returns one uniform colour, whatever the element's own open/close comparison says
  const bg = (raw: any) => (raw?.dir === 'up' ? (hollow ? uniform('transparent') : uniform(c.up)) : raw?.dir === 'down' ? uniform(c.down) : null);
  const bd = (raw: any) => (raw?.dir === 'up' ? uniform(c.up) : raw?.dir === 'down' ? uniform(c.down) : null);
  const fill = hollow ? { ...colors, up: 'transparent' } : colors;
  const widthOpt = c.width ? (type === 'tvbar' ? { lineWidth: c.width } : { borderWidth: c.width }) : {};
  return {
    dataset: {
      type, label: 'Price', yAxisID: 'y', data: [],
      // NB: the financial plugin reads `backgroundColors` / `borderColors` (plural)
      backgroundColors: byPrev ? (ctx: any) => bg(ctx.raw) ?? fill : fill,
      borderColors: byPrev ? (ctx: any) => bd(ctx.raw) ?? colors : colors,
      ...widthOpt,
      ...extra,
    },
    builder: (pts) => pts.map((p) => ohlcPoint(p, byPrev)),
  };
}

/**
 * The price series for a chart style (usually one dataset; HLC area adds the
 * high/low lines). The first entry is always the dataset labelled "Price".
 */
export function buildPriceSeries(type: ChartType, c: PriceStyleCtx): SeriesEntry[] {
  const line = (over: Record<string, unknown> = {}): SeriesEntry => ({
    dataset: { ...lineDataset('Price', 'y', c.line, c.width ?? 2, []), ...over },
    builder: (pts) => pts.map((p) => ({ x: p.x, y: sourceValue(p, c.source), t: p.t })),
  });
  switch (type) {
    case 'hollow': return [ohlcSeries('candlestick', c, {}, true)];
    case 'ohlc': return [ohlcSeries('tvbar', c, { barStyle: 'ohlc' })];
    case 'hlc': return [ohlcSeries('tvbar', c, { barStyle: 'hlc' })];
    case 'highlow': return [ohlcSeries('tvbar', c, { barStyle: 'highlow' })];
    case 'columns':
      return [{
        dataset: {
          type: 'bar', label: 'Price', yAxisID: 'y', data: [], parsing: false, normalized: true,
          barPercentage: 1, categoryPercentage: 0.8,
          backgroundColor: (ctx: any) => (ctx.raw?.up ? c.up : c.down),
        },
        builder: (pts) => pts.map((p) => ({ x: p.x, y: p.c, up: c.byPrevClose ? p.upPc : p.c >= p.o, t: p.t })),
      }];
    case 'line': return [line()];
    case 'markers': return [line({ pointRadius: 3, pointBackgroundColor: c.line })];
    case 'step': return [line({ stepped: 'after' })];
    case 'area': return [line({ fill: 'origin', backgroundColor: c.area })];
    case 'hlcarea':
      return [
        line(),
        { dataset: { ...lineDataset('High', 'y', c.up, 1, []), fill: '+1', backgroundColor: c.area }, builder: (pts) => pts.map((p) => ({ x: p.x, y: p.h, t: p.t })) },
        { dataset: lineDataset('Low', 'y', c.down, 1, []), builder: (pts) => pts.map((p) => ({ x: p.x, y: p.l, t: p.t })) },
      ];
    case 'baseline':
      return [line({
        fill: { target: { value: c.baseline }, above: c.upFill, below: c.downFill },
        segment: { borderColor: (ctx: any) => (ctx.p1.parsed.y >= c.baseline ? c.up : c.down) },
      })];
    case 'kagi': {
      // segments joined by horizontal steps; thick "yang" (rising) and thin "yin" (falling) lines
      const yang = (ctx: any) => ctx.p1.parsed.y >= ctx.p0.parsed.y;
      return [line({
        stepped: 'after',
        segment: { borderColor: (ctx: any) => (yang(ctx) ? c.up : c.down), borderWidth: (ctx: any) => (yang(ctx) ? 3 : 1.5) },
      })];
    }
    case 'pnf': {
      // candle data drawn invisibly; the pnfGlyphs plugin paints the X / O columns on top
      const s = ohlcSeries('candlestick', { ...c, up: 'transparent', down: 'transparent', muted: 'transparent' }, { pnf: true, box: c.box });
      return [s];
    }
    case 'candles':
    case 'heikin':
    case 'renko':
    case 'linebreak':
    case 'range':
    default:
      return [ohlcSeries('candlestick', c)];
  }
}

/** Baseline reference: the middle of the framed price range. */
export function baselineFor(slice: OHLCV[]): number {
  if (!slice.length) return 0;
  const lo = Math.min(...slice.map((b) => b.low));
  const hi = Math.max(...slice.map((b) => b.high));
  return (lo + hi) / 2;
}
