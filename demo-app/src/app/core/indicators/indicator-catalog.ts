/**
 * Bridges the persisted chart-state entries (`{type, period}`, 4.1) to the
 * calculator registry (5.1) and decides WHERE each indicator renders:
 * overlay on the price pane vs. its own oscillator pane. ATR is a pane (its
 * scale is price-units-per-bar, not price level — overlaying it would be wrong).
 */
export interface IndicatorEntry {
  type: string;
  period: number;
}

export type IndicatorKind = 'overlay' | 'pane';

export interface CatalogItem {
  type: string;
  label: string;
  kind: IndicatorKind;
  definitionId: string;
  defaultPeriod: number;
  /** false → the period is ignored (Webby RSI / Bob Marley use their own defaults). */
  usesPeriod: boolean;
  buildParams(period: number): Record<string, unknown>;
}

export const INDICATOR_CATALOG: CatalogItem[] = [
  {
    type: 'sma', label: 'SMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 20, usesPeriod: true,
    buildParams: (p) => ({ method: 'SMA', source: 'close', length: p }),
  },
  {
    type: 'ema', label: 'EMA', kind: 'overlay', definitionId: 'moving_average', defaultPeriod: 21, usesPeriod: true,
    buildParams: (p) => ({ method: 'EMA', source: 'close', length: p }),
  },
  {
    type: 'rsi', label: 'RSI', kind: 'pane', definitionId: 'rsi', defaultPeriod: 14, usesPeriod: true,
    buildParams: (p) => ({ length: p }),
  },
  {
    type: 'atr', label: 'ATR', kind: 'pane', definitionId: 'atr', defaultPeriod: 14, usesPeriod: true,
    buildParams: (p) => ({ length: p }),
  },
  {
    type: 'webby_rsi', label: 'Webby RSI', kind: 'pane', definitionId: 'webby_rsi', defaultPeriod: 0, usesPeriod: false,
    buildParams: () => ({}),
  },
  {
    type: 'bob_marley', label: 'Bob Marley', kind: 'pane', definitionId: 'bob_marley', defaultPeriod: 0, usesPeriod: false,
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
}

export function resolveEntry(entry: IndicatorEntry): ResolvedIndicator {
  const item = catalogItem(entry.type);
  if (!item) throw new Error(`Unknown indicator type: ${entry.type}`);
  return {
    entry,
    kind: item.kind,
    definitionId: item.definitionId,
    params: item.buildParams(entry.period),
    label: item.usesPeriod ? `${item.label} ${entry.period}` : item.label,
  };
}
