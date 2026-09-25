import { OHLCV } from '../models/ohlcv.model';

/**
 * Data aggregation helpers (task 4.3) — ports of the Python viewer's
 * `stock_service.py` W-FRI weekly resample and `range_presets.py` last-bar-
 * anchored range presets. Semantics verified against the Python source via the
 * PORT-INVENTORY (0.2) rulings:
 * - Weekly = W-FRI anchored (week ENDING Friday): open=first, high=max,
 *   low=min, close=last, volume=sum; bar date = the last bar's date.
 * - Range presets anchor to the LAST AVAILABLE BAR's date, not today.
 * - Range bars (1R/10R/...) are a non-goal (Python raises NotImplementedError).
 */

/** 4.3 button set (Python has 3M/6M/YTD/1Y/2Y/5Y/ALL — the Angular app adds
 *  1M as an add-on and drops 2Y/5Y). */
export const RANGE_PRESETS = ['1M', '3M', '6M', 'YTD', '1Y', 'ALL'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/**
 * Aggregate daily bars into W-FRI weeks: bars are grouped by the week ending
 * on the Friday at-or-after each bar's date (a bar ON a Friday ends its own
 * week). open=first, high=max, low=min, close=last, volume=sum; the weekly
 * bar's timestamp = the LAST bar's date in the week.
 */
export function aggregateWeeklyWFri(bars: OHLCV[]): OHLCV[] {
  if (!bars.length) return [];
  // W-FRI week key: the Friday ending the week containing this bar.
  // Fri = weekday 5. Bars on Fri belong to their own date's week.
  const weekEndFriday = (ts: number): number => {
    const d = new Date(ts);
    const weekday = d.getUTCDay(); // 0=Sun..5=Fri..6=Sat
    const daysUntilFriday = (5 - weekday + 7) % 7;
    const end = new Date(ts);
    end.setUTCDate(d.getUTCDate() + daysUntilFriday);
    end.setUTCHours(0, 0, 0, 0);
    return end.getTime();
  };

  const groups = new Map<number, OHLCV[]>();
  for (const b of bars) {
    const key = weekEndFriday(b.timestamp);
    const list = groups.get(key);
    if (list) list.push(b);
    else groups.set(key, [b]);
  }

  const out: OHLCV[] = [];
  for (const [, group] of groups) {
    // group is in insertion order (bars arrive ASC per the 3.1 sort fix)
    const first = group[0];
    const last = group[group.length - 1];
    out.push({
      timestamp: last.timestamp, // bar date = LAST bar's date (W-FRI anchor)
      open: first.open,
      high: Math.max(...group.map((b) => b.high)),
      low: Math.min(...group.map((b) => b.low)),
      close: last.close,
      volume: group.reduce((sum, b) => sum + b.volume, 0),
    });
  }
  // output ascending by week-end date (Chart.js financial requirement)
  out.sort((a, b) => a.timestamp - b.timestamp);
  return out;
}

/**
 * Index of the FIRST bar within the range preset, anchored to the LAST
 * AVAILABLE bar's date (port of range_presets.get_start_index). Returns the
 * index into `bars` (which must be ascending).
 */
export function rangeStartIndex(bars: OHLCV[], preset: RangePreset): number {
  if (!bars.length) return 0;
  const last = bars[bars.length - 1];
  const lastDate = new Date(last.timestamp);

  let target: Date;
  switch (preset) {
    case 'ALL':
      return 0;
    case 'YTD':
      // Jan 1 of the LAST BAR's year (not the current year)
      target = new Date(Date.UTC(lastDate.getUTCFullYear(), 0, 1));
      break;
    case '1M':
      target = addMonths(lastDate, -1);
      break;
    case '3M':
      target = addMonths(lastDate, -3);
      break;
    case '6M':
      target = addMonths(lastDate, -6);
      break;
    case '1Y':
      target = addMonths(lastDate, -12);
      break;
    default: {
      // exhaustive guard — never reached with the RANGE_PRESETS union
      target = addMonths(lastDate, -3);
    }
  }

  // searchsorted left (port of pandas searchsorted side='left'), clamped
  let lo = 0;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (bars[mid].timestamp < target.getTime()) lo = mid + 1;
    else hi = mid;
  }
  return Math.min(lo, bars.length - 1);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d.getTime());
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  // clamp day-of-month to the target month's length (Jan 31 - 1M = Feb 29/28)
  const daysInMonth = new Date(
    Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)
  ).getUTCDate();
  out.setUTCDate(Math.min(day, daysInMonth));
  return out;
}

/**
 * Client-side range slice (decision: the data file is ONE fetch; the range
 * slices it in the browser). Optionally aggregates to weekly afterwards.
 */
export function filterByRange(bars: OHLCV[], preset: RangePreset, interval?: string): OHLCV[] {
  const startIdx = rangeStartIndex(bars, preset);
  const sliced = bars.slice(startIdx);
  if (interval === '1w') {
    return aggregateWeeklyWFri(sliced);
  }
  return sliced;
}
