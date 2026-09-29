/** Registry metadata mirroring `indicators/registry.py` / `model.py` (see docs/PORT-INVENTORY.md §4). */
export type ParameterType = 'integer' | 'float' | 'boolean' | 'choice' | 'source';
export type PanePolicy = 'price' | 'volume' | 'own' | 'source_aware';
export type ParamValue = number | string | boolean;

export interface ParameterSpec {
  key: string;
  label: string;
  type: ParameterType;
  default: ParamValue;
  minimum?: number;
  maximum?: number;
  step?: number;
  choices?: { value: string; label: string }[];
}

export interface OutputSpec {
  key: string;
  label: string;
  renderType: 'line' | 'histogram';
  /** CSS colour or a `var(--name)` reference (resolved at draw time). */
  defaultColor: string;
  defaultWidth: number;
  defaultLineStyle: 'solid' | 'dash' | 'dot' | 'dash_dot';
}

export interface IndicatorDefinition {
  id: string;
  name: string;
  category: string;
  parameters: ParameterSpec[];
  outputs: OutputSpec[];
  panePolicy: PanePolicy;
  labelTemplate?: string;
  defaultPanelHeight: number;
  defaultYRange: [number, number] | null;
}

const out = (
  key: string, label: string, color: string, style: OutputSpec['defaultLineStyle'] = 'solid',
): OutputSpec => ({ key, label, renderType: 'line', defaultColor: color, defaultWidth: 1, defaultLineStyle: style });

const choices = (...vals: string[]) => vals.map((v) => ({ value: v, label: v }));
const SOURCE: ParameterSpec['choices'] = choices('open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'volume');

export const MOVING_AVERAGE: IndicatorDefinition = {
  id: 'moving_average', name: 'Moving Average', category: 'Trend',
  parameters: [
    { key: 'method', label: 'Method', type: 'choice', default: 'SMA', choices: choices('SMA', 'EMA', 'WMA', 'RMA') },
    { key: 'source', label: 'Source', type: 'source', default: 'close', choices: SOURCE },
    { key: 'length', label: 'Length', type: 'integer', default: 50, minimum: 1, maximum: 10000, step: 1 },
    { key: 'offset', label: 'Offset', type: 'integer', default: 0, minimum: -5000, maximum: 5000, step: 1 },
  ],
  outputs: [out('ma', 'MA', 'var(--c-ind-blue)')],
  panePolicy: 'source_aware', labelTemplate: '{method} {length} {source}',
  defaultPanelHeight: 180, defaultYRange: null,
};

export const RSI: IndicatorDefinition = {
  id: 'rsi', name: 'Relative Strength Index', category: 'Momentum',
  parameters: [
    { key: 'source', label: 'Source', type: 'source', default: 'close', choices: SOURCE },
    { key: 'length', label: 'Length', type: 'integer', default: 14, minimum: 1, maximum: 10000, step: 1 },
    { key: 'overbought', label: 'Overbought', type: 'float', default: 70, minimum: 0, maximum: 100, step: 1 },
    { key: 'oversold', label: 'Oversold', type: 'float', default: 30, minimum: 0, maximum: 100, step: 1 },
  ],
  outputs: [
    out('rsi', 'RSI', 'var(--c-ind-violet)'),
    out('overbought', 'Overbought', 'var(--c-ind-guide)', 'dash'),
    out('oversold', 'Oversold', 'var(--c-ind-guide)', 'dash'),
  ],
  panePolicy: 'own', labelTemplate: 'RSI {length}', defaultPanelHeight: 180, defaultYRange: [0, 100],
};

export const ATR: IndicatorDefinition = {
  id: 'atr', name: 'Average True Range', category: 'Volatility',
  parameters: [
    { key: 'length', label: 'Length', type: 'integer', default: 14, minimum: 1, maximum: 10000, step: 1 },
    { key: 'smoothing', label: 'Smoothing', type: 'choice', default: 'RMA', choices: choices('RMA', 'SMA', 'EMA', 'WMA') },
  ],
  outputs: [out('atr', 'ATR', 'var(--c-ind-amber)')],
  panePolicy: 'own', labelTemplate: 'ATR {length}', defaultPanelHeight: 180, defaultYRange: null,
};

export const WEBBY_RSI: IndicatorDefinition = {
  id: 'webby_rsi', name: 'Webby RSI', category: 'IBD / CANSLIM',
  parameters: [
    { key: 'mode', label: 'Mode', type: 'choice', default: '5.150', choices: choices('5.150', 'Original') },
    { key: 'ema_length', label: 'EMA length', type: 'integer', default: 21, minimum: 1, maximum: 1000, step: 1 },
    { key: 'sma_length', label: 'SMA length', type: 'integer', default: 10, minimum: 1, maximum: 1000, step: 1 },
    { key: 'atr_length', label: 'ATR length', type: 'integer', default: 50, minimum: 1, maximum: 1000, step: 1 },
    { key: 'stretched_level', label: 'Stretched level', type: 'float', default: 3, minimum: 0, maximum: 100, step: 0.25 },
    { key: 'signal_length', label: 'Signal length', type: 'integer', default: 10, minimum: 1, maximum: 1000, step: 1 },
    { key: 'positive_only', label: 'Positive only', type: 'boolean', default: true },
  ],
  outputs: [
    out('webby', 'Webby', 'var(--c-ind-sky)'), out('signal', 'Signal', 'var(--c-ind-violet)'),
    out('level_0', '0', 'var(--c-ind-guide)', 'dash'), out('level_05', '0.5', 'var(--c-ind-guide)', 'dash'),
    out('level_2', '2', 'var(--c-ind-guide)', 'dash'), out('level_4', '4', 'var(--c-ind-guide)', 'dash'),
    out('level_6', '6', 'var(--c-ind-guide)', 'dash'),
    out('above_21', 'Above 21', 'var(--c-ind-green)'), out('below_21', 'Below 21', 'var(--c-ind-red)'),
    out('sma_extension', 'SMA extension', 'var(--c-ind-orange)'), out('stretched', 'Stretched', 'var(--c-ind-orange)', 'dash'),
  ],
  panePolicy: 'own', labelTemplate: 'Webby RSI {mode}', defaultPanelHeight: 180, defaultYRange: null,
};

export const BOB_MARLEY: IndicatorDefinition = {
  id: 'bob_marley', name: 'Bob Marley Off-High ATR', category: 'IBD / CANSLIM',
  parameters: [
    { key: 'high_reference', label: 'High reference', type: 'choice', default: '52_week', choices: choices('52_week', '50_day', '18_month', 'all_time') },
    { key: 'source', label: 'Source', type: 'choice', default: 'low', choices: choices('low', 'close') },
    { key: 'atr_length', label: 'ATR length', type: 'integer', default: 21, minimum: 1, maximum: 1000, step: 1 },
    { key: 'green_max', label: 'Green max', type: 'float', default: 4, minimum: 0, maximum: 100, step: 0.25 },
    { key: 'yellow_max', label: 'Yellow max', type: 'float', default: 8, minimum: 0, maximum: 100, step: 0.25 },
    { key: 'invert_axis', label: 'Invert axis', type: 'boolean', default: false },
  ],
  outputs: [
    out('green', 'Green', 'var(--c-ind-green)'), out('yellow', 'Yellow', 'var(--c-ind-yellow)'), out('red', 'Red', 'var(--c-ind-red)'),
    out('green_boundary', 'Green boundary', 'var(--c-ind-green)', 'dash'), out('red_boundary', 'Red boundary', 'var(--c-ind-red)', 'dash'),
  ],
  panePolicy: 'own', labelTemplate: 'Bob Marley {high_reference}', defaultPanelHeight: 180, defaultYRange: null,
};

/** Registration order mirrors `create_default_registry()`. */
export const DEFAULT_DEFINITIONS: IndicatorDefinition[] = [MOVING_AVERAGE, ATR, RSI, WEBBY_RSI, BOB_MARLEY];
