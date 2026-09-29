/** Time helpers for the clock and the bar-close countdown (the demo market is the US exchange). */
export type TimezoneChoice = 'exchange' | 'utc' | 'local';
export type SessionChoice = 'regular' | 'extended';

const NY = 'America/New_York';
const pad = (n: number) => String(n).padStart(2, '0');

function wall(d: Date, tz: string): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get('year'), mo: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Minutes the time zone is ahead of UTC at that instant. */
function offsetMinutes(d: Date, tz: string): number {
  const w = wall(d, tz);
  return Math.round((Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

const offsetLabel = (min: number) => {
  if (min === 0) return 'UTC';
  const a = Math.abs(min);
  return `UTC${min < 0 ? '-' : '+'}${Math.floor(a / 60)}${a % 60 ? ':' + pad(a % 60) : ''}`;
};

/** `HH:MM:SS UTC-4` in the chosen time zone. */
export function formatClock(now: Date, tz: TimezoneChoice): string {
  if (tz === 'utc') return `${now.toISOString().slice(11, 19)} UTC`;
  const zone = tz === 'exchange' ? NY : undefined;
  const w = wall(now, zone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const off = zone ? offsetMinutes(now, zone) : -now.getTimezoneOffset();
  return `${pad(w.h)}:${pad(w.mi)}:${pad(w.s)} ${offsetLabel(off)}`;
}

/** The instant at which it is `hour`:00 in New York on that calendar date. */
function nyInstant(y: number, mo: number, d: number, hour: number): number {
  const guess = Date.UTC(y, mo - 1, d, hour);
  const first = guess - offsetMinutes(new Date(guess), NY) * 60000;
  return guess - offsetMinutes(new Date(first), NY) * 60000; // second pass settles DST edges
}

/** Time until the current bar closes: the next weekday's close (daily) or Friday's (weekly). `Nd HH:MM:SS` beyond a day. */
export function barCountdown(now: Date, interval: string, session: SessionChoice): string {
  const closeHour = session === 'extended' ? 20 : 16;
  const w = wall(now, NY);
  for (let k = 0; k < 14; k++) {
    const day = new Date(Date.UTC(w.y, w.mo - 1, w.d + k));
    const dow = day.getUTCDay();
    if (interval === '1w' ? dow !== 5 : dow === 0 || dow === 6) continue;
    const close = nyInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), closeHour);
    if (close > now.getTime()) {
      const ms = close - now.getTime();
      const days = Math.floor(ms / 86_400_000);
      const rest = Math.floor((ms % 86_400_000) / 1000);
      return `${days ? days + 'd ' : ''}${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}:${pad(rest % 60)}`;
    }
  }
  return '';
}
