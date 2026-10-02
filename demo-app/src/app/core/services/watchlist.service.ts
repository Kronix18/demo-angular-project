import { Injectable, inject, signal } from '@angular/core';
import { ChartDataService } from './chart-data.service';

const KEY = 'watchlist';
const DEFAULT = ['msft', 'nvda', 'qqq', 'pltr', 'mu'];

export interface Quote { last: number; pct: number; }

/** The chart's watchlist: symbols persisted in localStorage, quotes (last close, % change) loaded lazily from the demo data. */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly data = inject(ChartDataService);
  readonly list = signal<string[]>(this.read());
  readonly quotes = signal<Record<string, Quote>>({});
  private readonly requested = new Set<string>();

  private read(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (Array.isArray(raw) && raw.every((s) => typeof s === 'string')) return raw;
    } catch { /* fall through */ }
    return [...DEFAULT];
  }

  private save(): void { try { localStorage.setItem(KEY, JSON.stringify(this.list())); } catch { /* per-session only */ } }

  add(symbol: string): void {
    const s = symbol.trim().toLowerCase().replace(/\.us$/, '');
    if (!/^[a-z0-9.\-]{1,10}$/.test(s) || this.list().includes(s)) return;
    this.list.update((l) => [...l, s]);
    this.save();
  }

  remove(symbol: string): void {
    this.list.update((l) => l.filter((s) => s !== symbol));
    this.save();
  }

  /** Fetches the symbol's data once and keeps the last close and the change from the previous close. */
  loadQuote(symbol: string): void {
    if (this.requested.has(symbol)) return;
    this.requested.add(symbol);
    this.data.getOHLCV(symbol, '1d', 5).subscribe((bars) => {
      if (bars.length < 1) return;
      const last = bars[bars.length - 1].close;
      const prev = bars.length > 1 ? bars[bars.length - 2].close : last;
      this.quotes.update((q) => ({ ...q, [symbol]: { last, pct: prev ? ((last - prev) / prev) * 100 : 0 } }));
    });
  }
}
