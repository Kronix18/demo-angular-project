import { Injectable, signal } from '@angular/core';

export interface PriceAlert { id: string; symbol: string; price: number; triggered: boolean; }

const KEY = 'alerts';

/**
 * Price alerts ("crossing"): stored in localStorage, evaluated against consecutive closes.
 * The demo data is static, so alerts fire while the replay plays (or when bars change), not in real time.
 */
@Injectable({ providedIn: 'root' })
export class AlertService {
  readonly list = signal<PriceAlert[]>(this.read());

  private read(): PriceAlert[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
      return Array.isArray(raw)
        ? raw.filter((a) => a && typeof a.id === 'string' && typeof a.symbol === 'string' && Number.isFinite(a.price) && typeof a.triggered === 'boolean')
        : [];
    } catch { return []; }
  }

  private save(): void { try { localStorage.setItem(KEY, JSON.stringify(this.list())); } catch { /* per-session only */ } }

  forSymbol(symbol: string): PriceAlert[] { return this.list().filter((a) => a.symbol === symbol.toLowerCase()); }

  add(symbol: string, price: number): PriceAlert | null {
    if (!Number.isFinite(price) || price <= 0) return null;
    const a: PriceAlert = { id: `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, symbol: symbol.toLowerCase(), price, triggered: false };
    this.list.update((l) => [...l, a]);
    this.save();
    return a;
  }

  remove(id: string): void { this.list.update((l) => l.filter((a) => a.id !== id)); this.save(); }

  rearm(id: string): void { this.list.update((l) => l.map((a) => (a.id === id ? { ...a, triggered: false } : a))); this.save(); }

  clearTriggered(): void { this.list.update((l) => l.filter((a) => !a.triggered)); this.save(); }

  /** Marks and returns the alerts whose level lies between the previous and the new close (touching counts). */
  evaluate(symbol: string, prevClose: number, close: number): PriceAlert[] {
    const lo = Math.min(prevClose, close), hi = Math.max(prevClose, close);
    const hit = this.forSymbol(symbol).filter((a) => !a.triggered && prevClose !== close && a.price >= lo && a.price <= hi);
    if (!hit.length) return [];
    const ids = new Set(hit.map((a) => a.id));
    this.list.update((l) => l.map((a) => (ids.has(a.id) ? { ...a, triggered: true } : a)));
    this.save();
    return hit;
  }
}
