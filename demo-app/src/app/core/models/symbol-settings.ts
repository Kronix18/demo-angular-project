/** Symbol (price) and volume settings edited from the chart legend (11.6). Unset = theme default. */
export const PRICE_SOURCES = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];
export const LINE_WIDTHS = [1, 2, 3, 4];

export interface PriceSettings {
  up?: string;
  down?: string;
  /** colour by close vs the PREVIOUS close instead of close vs open */
  byPrevClose?: boolean;
  /** candle border/wick, bar and line thickness */
  width?: number;
  /** colour of line-family styles */
  line?: string;
  /** what line-family styles plot */
  source?: PriceSource;
  hidden?: boolean;
}

export interface VolumeSettings {
  up?: string;
  down?: string;
  byPrevClose?: boolean;
  hidden?: boolean;
}

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown): v is string => typeof v === 'string' && HEX.test(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Persisted / dialog input is never trusted: only known keys with valid values survive. */
export function sanitizePrice(v: unknown): PriceSettings {
  const out: PriceSettings = {};
  if (!isObj(v)) return out;
  if (hex(v['up'])) out.up = v['up'];
  if (hex(v['down'])) out.down = v['down'];
  if (typeof v['byPrevClose'] === 'boolean') out.byPrevClose = v['byPrevClose'];
  if (LINE_WIDTHS.includes(v['width'] as number)) out.width = v['width'] as number;
  if (hex(v['line'])) out.line = v['line'];
  if ((PRICE_SOURCES as readonly unknown[]).includes(v['source'])) out.source = v['source'] as PriceSource;
  if (v['hidden'] === true) out.hidden = true;
  return out;
}

export function sanitizeVolume(v: unknown): VolumeSettings {
  const out: VolumeSettings = {};
  if (!isObj(v)) return out;
  if (hex(v['up'])) out.up = v['up'];
  if (hex(v['down'])) out.down = v['down'];
  if (typeof v['byPrevClose'] === 'boolean') out.byPrevClose = v['byPrevClose'];
  if (v['hidden'] === true) out.hidden = true;
  return out;
}
