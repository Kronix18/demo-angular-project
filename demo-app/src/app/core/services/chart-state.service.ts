import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';

/** Chart state shape (4.1). Indicators list: {type, period} entries — wired in 5.x. */
export interface ChartState {
  symbol: string;
  interval: string;
  range: string;
  indicators: Array<{ type: string; period: number }>;
}

const STORAGE_KEY = 'chart-state';

const DEFAULTS: ChartState = {
  symbol: 'msft',
  interval: '1d',
  range: '6m',
  indicators: [],
};

/**
 * Central chart state store (4.1): single source of truth for symbol, interval,
 * range, and active indicators. Toolbar (4.2) writes; the chart viewer reads
 * and derives data loads from state changes. Persists to sessionStorage on
 * every change; rehydrates on construction (survives refresh — the same
 * pattern as AuthService in 1.1).
 */
@Injectable({ providedIn: 'root' })
export class ChartStateService {
  private readonly subject: BehaviorSubject<ChartState>;

  constructor() {
    this.subject = new BehaviorSubject<ChartState>(this.readPersisted());
  }

  /** The state stream — distinct-until-changed for downstream derived loads. */
  get state$(): Observable<ChartState> {
    return this.subject.asObservable().pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

  /** Synchronous snapshot for one-off reads (guards, initial seeds). */
  snapshot(): ChartState {
    return this.subject.value;
  }

  setSymbol(symbol: string): void {
    this.update({ symbol: symbol.trim().toLowerCase() });
  }

  setInterval(interval: string): void {
    this.update({ interval });
  }

  setRange(range: string): void {
    this.update({ range });
  }

  /** Indicator CRUD (5.2/5.3 use this): add (dedup by type+period), remove by index. */
  addIndicator(entry: { type: string; period: number }): boolean {
    const exists = this.subject.value.indicators.some(
      (i) => i.type === entry.type && i.period === entry.period
    );
    if (exists) return false;
    this.update({ indicators: [...this.subject.value.indicators, entry] });
    return true;
  }

  removeIndicator(index: number): void {
    const next = this.subject.value.indicators.filter((_, i) => i !== index);
    this.update({ indicators: next });
  }

  /** Restore defaults and clear the persisted state. */
  reset(): void {
    sessionStorage.removeItem(STORAGE_KEY);
    this.subject.next({ ...DEFAULTS, indicators: [] });
  }

  private update(partial: Partial<ChartState>): void {
    const next = { ...this.subject.value, ...partial };
    this.subject.next(next);
    this.persist(next);
  }

  private persist(state: ChartState): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // storage full/unavailable — state still works in-memory
      console.warn('chart-state persist failed:', (e as Error).message?.slice(0, 80));
    }
  }

  private readPersisted(): ChartState {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS, indicators: [] };
      const parsed = JSON.parse(raw);
      return {
        symbol: typeof parsed.symbol === 'string' ? parsed.symbol : DEFAULTS.symbol,
        interval: typeof parsed.interval === 'string' ? parsed.interval : DEFAULTS.interval,
        range: typeof parsed.range === 'string' ? parsed.range : DEFAULTS.range,
        indicators: Array.isArray(parsed.indicators) ? parsed.indicators : [],
      };
    } catch {
      return { ...DEFAULTS, indicators: [] };
    }
  }
}
