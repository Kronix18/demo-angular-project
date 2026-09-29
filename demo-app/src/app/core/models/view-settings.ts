/** Chart look & status line options (the settings dialog). Everything is on by default, like TradingView (except the countdown). */
export type Timezone = 'exchange' | 'utc' | 'local';
export type Session = 'regular' | 'extended';

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
  /** time left until the bar closes, under the last-price label */
  countdown: boolean;
  /** the clock's time zone, and which close (16:00 / 20:00 New York) the countdown counts to */
  timezone: Timezone;
  session: Session;
}

export const VIEW_FLAGS: (keyof ViewSettings)[] = ['gridH', 'gridV', 'crosshair', 'lastPrice', 'ohlc', 'countdown'];
export const TIMEZONES: Timezone[] = ['exchange', 'utc', 'local'];
export const SESSIONS: Session[] = ['regular', 'extended'];
export const defaultView = (): ViewSettings => ({ gridH: true, gridV: true, crosshair: true, lastPrice: true, ohlc: true, countdown: false, timezone: 'exchange', session: 'regular' });

/** Unknown keys are dropped, invalid values fall back to the default (persisted data is never trusted). */
export function sanitizeView(v: unknown): ViewSettings {
  const out = defaultView();
  if (v && typeof v === 'object') {
    const r = v as Record<string, unknown>;
    for (const k of VIEW_FLAGS) if (typeof r[k] === 'boolean') (out as unknown as Record<string, boolean>)[k] = r[k] as boolean;
    if (TIMEZONES.includes(r['timezone'] as Timezone)) out.timezone = r['timezone'] as Timezone;
    if (SESSIONS.includes(r['session'] as Session)) out.session = r['session'] as Session;
  }
  return out;
}
