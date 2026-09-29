import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartType } from '../../core/models/chart-type';
import { LodPoint } from '../chart-lod';

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
}

export function lineDataset(label: string, yAxisID: string, color: string, width: number, dash: number[], hidden = false) {
  return {
    type: 'line' as const, label, yAxisID, data: [] as any[], hidden,
    borderColor: color, backgroundColor: color, borderWidth: width, borderDash: dash,
    pointRadius: 0, pointHoverRadius: 3, tension: 0, spanGaps: false,
    parsing: false, normalized: true,
  };
}

const ohlcPoint = (p: LodPoint) => ({ x: p.x, o: p.o, h: p.h, l: p.l, c: p.c, t: p.t });
const closePoint = (p: LodPoint) => ({ x: p.x, y: p.c, t: p.t });

/** Base of the OHLC-shaped styles: candlestick (candles/hollow/alternative charts) or our tvbar (bars/HLC/high-low). */
function ohlcSeries(type: 'candlestick' | 'tvbar', c: PriceStyleCtx, extra: Record<string, unknown> = {}, hollow = false): SeriesEntry {
  const colors = { up: c.up, down: c.down, unchanged: c.muted };
  return {
    dataset: {
      type, label: 'Price', yAxisID: 'y', data: [],
      // NB: the financial plugin reads `backgroundColors` / `borderColors` (plural)
      backgroundColors: hollow ? { ...colors, up: 'transparent' } : colors,
      borderColors: colors,
      ...extra,
    },
    builder: (pts) => pts.map(ohlcPoint),
  };
}

/**
 * The price series for a chart style (usually one dataset; HLC area adds the
 * high/low lines). The first entry is always the dataset labelled "Price".
 */
export function buildPriceSeries(type: ChartType, c: PriceStyleCtx): SeriesEntry[] {
  const line = (over: Record<string, unknown> = {}): SeriesEntry => ({
    dataset: { ...lineDataset('Price', 'y', c.line, 2, []), ...over },
    builder: (pts) => pts.map(closePoint),
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
        builder: (pts) => pts.map((p) => ({ x: p.x, y: p.c, up: p.c >= p.o, t: p.t })),
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
