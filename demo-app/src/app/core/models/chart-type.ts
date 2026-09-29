/** Price-series styles (TradingView's chart types that a daily-data demo can honour). */
export type ChartType =
  | 'candles' | 'hollow' | 'ohlc' | 'hlc' | 'highlow' | 'columns'
  | 'line' | 'markers' | 'step' | 'area' | 'hlcarea' | 'baseline'
  | 'heikin' | 'renko' | 'linebreak' | 'kagi' | 'pnf' | 'range';

export interface ChartTypeGroup { label: string; types: { id: ChartType; label: string }[]; }

/** Menu order + labels (grouped like TradingView's style picker). */
export const CHART_TYPE_GROUPS: ChartTypeGroup[] = [
  { label: 'Bars & candles', types: [
    { id: 'candles', label: 'Candles' }, { id: 'hollow', label: 'Hollow candles' }, { id: 'ohlc', label: 'Bars' },
    { id: 'hlc', label: 'HLC bars' }, { id: 'highlow', label: 'High-low' }, { id: 'columns', label: 'Columns' } ] },
  { label: 'Lines & areas', types: [
    { id: 'line', label: 'Line' }, { id: 'markers', label: 'Line with markers' }, { id: 'step', label: 'Step line' },
    { id: 'area', label: 'Area' }, { id: 'hlcarea', label: 'HLC area' }, { id: 'baseline', label: 'Baseline' } ] },
  { label: 'Alternative charts', types: [
    { id: 'heikin', label: 'Heikin Ashi' }, { id: 'renko', label: 'Renko' }, { id: 'linebreak', label: 'Line break' },
    { id: 'kagi', label: 'Kagi' }, { id: 'pnf', label: 'Point & figure' }, { id: 'range', label: 'Range' } ] },
];

export const CHART_TYPES: ChartType[] = CHART_TYPE_GROUPS.flatMap((g) => g.types.map((t) => t.id));

/** Styles whose bars are not the source bars 1:1 (bar indexes differ from the daily/weekly series). */
export const NON_TIME_TYPES: ChartType[] = ['renko', 'linebreak', 'kagi', 'pnf', 'range'];
