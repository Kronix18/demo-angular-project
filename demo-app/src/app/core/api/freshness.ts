export type FreshnessState = 'fresh' | 'stale' | 'unknown';
export interface Freshness {
  state: FreshnessState;
  asOf: string | null;
  lagBusinessDays: number | null;
}

/** Stale when the newest data is older than this many business days (daily import is manual today). */
export const STALE_AFTER_BUSINESS_DAYS = 3;

/** Weekdays strictly after `asOf` (YYYY-MM-DD) up to and including the UTC day of `to`. */
export function businessDaysBetween(asOf: string, to: Date): number {
  const start = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(start)) return NaN;
  const end = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  let n = 0;
  for (let t = start + 86_400_000; t <= end; t += 86_400_000) {
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return n;
}

export function freshness(dataAsOf: Record<string, string | null>, now: Date, key = 'prices'): Freshness {
  const asOf = dataAsOf[key] ?? null;
  const lag = asOf ? businessDaysBetween(asOf, now) : NaN;
  if (!asOf || !Number.isFinite(lag)) return { state: 'unknown', asOf: null, lagBusinessDays: null };
  return { state: lag > STALE_AFTER_BUSINESS_DAYS ? 'stale' : 'fresh', asOf, lagBusinessDays: lag };
}
