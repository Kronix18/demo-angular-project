import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '../api-url';
import { OHLCV } from '../models/ohlcv.model';

export type OhlcvInterval = '1d' | '1w' | '1mo';

export interface OhlcvQuery {
  interval?: OhlcvInterval;
  /** epoch-ms or YYYY-MM-DD */
  from?: string | number;
  to?: string | number;
  limit?: number;
  /** `columnar` is ~3x smaller on the wire; both map to the same bars. */
  format?: 'json' | 'columnar';
  /** point-in-time: only bars not later than this date */
  asOf?: string;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isBar = (b: any): b is OHLCV => !!b && num(b.timestamp) && num(b.open) && num(b.high) && num(b.low) && num(b.close) && num(b.volume);

/**
 * Maps either v2 body shape (array of v1 bars, or `format=columnar` arrays) to internal bars:
 * junk rows dropped, unequal columns rejected, ascending by timestamp.
 */
export function mapOhlcv(body: unknown): OHLCV[] {
  let rows: unknown[] = [];
  if (Array.isArray(body)) {
    rows = body;
  } else if (body && typeof body === 'object') {
    const c = body as Record<string, unknown>;
    const cols = ['timestamp', 'open', 'high', 'low', 'close', 'volume'].map((k) => c[k]);
    if (cols.every(Array.isArray)) {
      const n = (cols[0] as unknown[]).length;
      if ((cols as unknown[][]).every((a) => a.length === n)) {
        rows = Array.from({ length: n }, (_, i) => ({ timestamp: (cols[0] as unknown[])[i], open: (cols[1] as unknown[])[i], high: (cols[2] as unknown[])[i], low: (cols[3] as unknown[])[i], close: (cols[4] as unknown[])[i], volume: (cols[5] as unknown[])[i] }));
      }
    }
  }
  return rows.filter(isBar).map((b) => ({ timestamp: b.timestamp, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })).sort((a, b) => a.timestamp - b.timestamp);
}

/** `GET /api/chart/{symbol}/ohlcv` (docs/api/02-prices.md). Prices are always split-adjusted: no `adjust` param is ever sent. */
@Injectable({ providedIn: 'root' })
export class OhlcvApiClient {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_URL);

  constructor() {
    if (typeof window !== 'undefined') (window as unknown as Record<string, unknown>)['__ohlcvApi'] = this; // e2e hook (like __charts)
  }

  get(symbol: string, q: OhlcvQuery = {}): Observable<OHLCV[]> {
    let params = new HttpParams().set('interval', q.interval ?? '1d');
    if (q.from !== undefined) params = params.set('from', String(q.from));
    if (q.to !== undefined) params = params.set('to', String(q.to));
    if (q.limit !== undefined) params = params.set('limit', String(q.limit));
    if (q.format === 'columnar') params = params.set('format', 'columnar');
    if (q.asOf) params = params.set('as_of', q.asOf);
    return this.http
      .get<unknown>(`${this.api}/api/chart/${encodeURIComponent(symbol.toUpperCase())}/ohlcv`, { params })
      .pipe(map(mapOhlcv));
  }
}
