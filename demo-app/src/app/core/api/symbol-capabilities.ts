import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, Signal, inject, signal } from '@angular/core';
import { API_URL } from '../api-url';
import { SILENT_ERRORS } from './errors';
import { ChartMetaResponse } from './types';

export interface SymbolCaps {
  status: 'loading' | 'ready' | 'unavailable';
  meta: ChartMetaResponse | null;
}

/** Per-symbol capability probe (`GET /api/chart/{symbol}/meta`), cached for the session. */
@Injectable({ providedIn: 'root' })
export class SymbolCapabilities {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);
  private readonly cache = new Map<string, ReturnType<typeof signal<SymbolCaps>>>();

  constructor() {
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)['__symbolCaps'] = this; // e2e hook
  }

  load(symbol: string): Signal<SymbolCaps> {
    const key = symbol.toUpperCase();
    const hit = this.cache.get(key);
    if (hit) return hit.asReadonly();
    const s = signal<SymbolCaps>({ status: 'loading', meta: null });
    this.cache.set(key, s);
    this.http
      .get<ChartMetaResponse>(`${this.api}/api/chart/${encodeURIComponent(key)}/meta`, { context: new HttpContext().set(SILENT_ERRORS, true) })
      .subscribe({
        next: (m) => s.set({ status: 'ready', meta: m }),
        error: () => s.set({ status: 'unavailable', meta: null }),
      });
    return s.asReadonly();
  }

  get(symbol: string): ChartMetaResponse | null {
    return this.cache.get(symbol.toUpperCase())?.().meta ?? null;
  }

  /** True only when the backend explicitly says this symbol has the dataset. */
  supports(symbol: string, dataset: string): boolean {
    return this.get(symbol)?.datasets?.[dataset] === true;
  }

  hasInterval(symbol: string, interval: string): boolean {
    return this.get(symbol)?.intervals?.includes(interval) ?? false;
  }
}
