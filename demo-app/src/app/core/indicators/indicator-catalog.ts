/**
 * Bridges the persisted chart-state entries (`{type, period}`, 4.1) to the
 * calculator registry (5.1) and decides WHERE each indicator renders:
 * overlay on the price pane vs. its own oscillator pane. ATR is a pane (its
 * scale is price-units-per-bar, not price level — overlaying it would be wrong).
 */
export type LineDash = 'solid' | 'dash' | 'dot' | 'dash_dot';

/** Per-output style overrides (the settings dialog's Style tab). */
export interface OutputStyle {
  color?: string;
  width?: number;
  dash?: LineDash;
  visible?: boolean;
}

export interface IndicatorEntry {
  type: string;
  period: number;
  /** eye toggle (10.2): series hidden, indicator kept */
  hidden?: boolean;
  /** overrides of the definition's parameters (settings dialog, Inputs tab) */
  params?: Record<string, number | string | boolean>;
  /** per-output style overrides, keyed by output key (Style tab) */
  styles?: Record<string, OutputStyle>;
  /** timeframes the indicator is shown on; absent = all (Visibility tab) */
  intervals?: string[];
}

export type IndicatorKind = 'overlay' | 'pane';

export interface CatalogItem {
  type: string;
  label: string;
  kind: IndicatorKind;
  definitionId: string;
  defaultPeriod: number;
  category: string;
  description: string;
  /** false → the period is ignored (Webby RSI / Bob Marley use their own defaults). */
  usesPeriod: boolean;
  buildParams(period: number): Record<string, unknown>;
}

/** Allowed period range for period-based indicators (validated inline in the panel). */
export const PERIOD_MIN = 2;
export const PERIOD_MAX = 500;

export const INDICATOR_CATALOG: CatalogItem[] = [
  {
    type: 'sma', category: 'Trend', description: 'Simple moving average: the mean of the last N values.', label: 'SMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 20, usesPeriod: true,
    buildParams: (p) => ({ method: 'SMA', source: 'close', length: p }),
  },
  {
    type: 'ema', category: 'Trend', description: 'Exponential moving average: weights recent values more heavily.', label: 'EMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 21, usesPeriod: true,
    buildParams: (p) => ({ method: 'EMA', source: 'close', length: p }),
  },
  {
    type: 'wma', category: 'Trend', description: 'Weighted moving average: linearly increasing weights, newest highest.', label: 'WMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 10, usesPeriod: true,
    buildParams: (p) => ({ method: 'WMA', source: 'close', length: p }),
  },
  {
    type: 'rma', category: 'Trend', description: 'Wilder smoothed moving average (used inside RSI and ATR).', label: 'RMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 14, usesPeriod: true,
    buildParams: (p) => ({ method: 'RMA', source: 'close', length: p }),
  },
  {
    type: 'rsi', category: 'Momentum', description: 'Relative Strength Index: momentum oscillator between 0 and 100.', label: 'RSI', kind: 'pane', definitionId: 'rsi', defaultPeriod: 14, usesPeriod: true,
    buildParams: (p) => ({ length: p }),
  },
  {
    type: 'atr', category: 'Volatility', description: 'Average True Range: average bar range including gaps.', label: 'ATR', kind: 'pane', definitionId: 'atr', defaultPeriod: 14, usesPeriod: true,
    buildParams: (p) => ({ length: p }),
  },
  {
    type: 'webby_rsi', category: 'IBD / CANSLIM', description: 'Webby RSI: distance from the 21 EMA measured in ATRs (5.150 and Original modes).', label: 'Webby RSI', kind: 'pane', definitionId: 'webby_rsi', defaultPeriod: 0, usesPeriod: false,
    buildParams: () => ({}),
  },
  {
    type: 'bob_marley', category: 'IBD / CANSLIM', description: 'Bob Marley: distance below the recent high in ATRs, coloured by zone.', label: 'Bob Marley', kind: 'pane', definitionId: 'bob_marley', defaultPeriod: 0, usesPeriod: false,
    buildParams: () => ({}),
  },
];

export function catalogItem(type: string): CatalogItem | undefined {
  return INDICATOR_CATALOG.find((c) => c.type === type);
}

export interface ResolvedIndicator {
  entry: IndicatorEntry;
  kind: IndicatorKind;
  definitionId: string;
  params: Record<string, unknown>;
  label: string;
  hidden: boolean;
  styles: Record<string, OutputStyle>;
  /** false when the indicator is restricted to other timeframes */
  visibleOn(interval: string): boolean;
}

export function resolveEntry(entry: IndicatorEntry): ResolvedIndicator {
  const item = catalogItem(entry.type);
  if (!item) throw new Error(`Unknown indicator type: ${entry.type}`);
  const params: Record<string, unknown> = { ...item.buildParams(entry.period), ...(entry.params ?? {}) };
  const length = typeof params['length'] === 'number' ? params['length'] : entry.period;
  const name = item.definitionId === 'moving_average' ? String(params['method'] ?? item.label) : item.label;
  return {
    entry,
    kind: item.kind,
    definitionId: item.definitionId,
    params,
    label: item.usesPeriod ? `${name} ${length}` : item.label,
    hidden: entry.hidden === true,
    styles: entry.styles ?? {},
    visibleOn: (interval: string) => !entry.intervals || entry.intervals.includes(interval),
  };
}
