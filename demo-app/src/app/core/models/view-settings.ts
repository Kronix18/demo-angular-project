/** Chart look & status line options (the settings dialog). Everything is on by default, like TradingView. */
export interface ViewSettings {
  /** horizontal / vertical grid lines */
  gridH: boolean;
  gridV: boolean;
  /** the crosshair (lines + axis labels) */
  crosshair: boolean;
  /** dashed last-price line with its axis label */
  lastPrice: boolean;
  /** O H L C V change in the legend header */
  ohlc: boolean;
}

export const VIEW_KEYS: (keyof ViewSettings)[] = ['gridH', 'gridV', 'crosshair', 'lastPrice', 'ohlc'];
export const defaultView = (): ViewSettings => ({ gridH: true, gridV: true, crosshair: true, lastPrice: true, ohlc: true });

/** Unknown keys are dropped, non-booleans fall back to the default (persisted data is never trusted). */
export function sanitizeView(v: unknown): ViewSettings {
  const out = defaultView();
  if (v && typeof v === 'object') for (const k of VIEW_KEYS) if (typeof (v as Record<string, unknown>)[k] === 'boolean') out[k] = (v as Record<string, boolean>)[k];
  return out;
}
