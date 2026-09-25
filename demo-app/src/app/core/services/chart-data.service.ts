import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { OHLCV } from '../models/ohlcv.model';

/**
 * Symbols with demo data (single source of truth — 0.3 spec). No AAPL.
 * The toolbar datalist (2.3) and the error-page hint (6.3) both read this.
 */
export const AVAILABLE_SYMBOLS = [
  'ia',
  'msft',
  'mu',
  'nvda',
  'pltr',
  'qqew',
  'qqq',
  'qqqe',
] as const;

/**
 * Demo-phase chart data source: Stooq daily `.us.txt` files served as static
 * assets from `public/test-data/` (see API-BACKEND-SPEC.md — the data contract).
 *
 * Symbol normalization: `MSFT`, `msft`, `msft.us`, `MSFT.US` all resolve to
 * `test-data/msft.us.txt` (lowercase, `.us` suffix stripped then re-appended).
 * Timestamps are Unix epoch MILLISECONDS (UTC), per the spec.
 */
@Injectable({
  providedIn: 'root'
})
export class ChartDataService {

  constructor(private http: HttpClient) { }

  getOHLCV(symbol: string, interval: string, limit: number = 100): Observable<OHLCV[]> {
    // Normalize: lowercase, strip a trailing .us exchange suffix, re-append the
    // file suffix — never a double suffix (was: MSFT.US.us.txt, always 404).
    const normalized = symbol.trim().toLowerCase().replace(/\.us$/, '');
    const url = `test-data/${normalized}.us.txt`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(data => this.parseStockData(data, limit)),
      catchError(error => {
        console.warn(`Test data not found for ${symbol} (${url}), falling back to empty data.`, error);
        return of([]);
      })
    );
  }

  private parseStockData(data: string, limit: number): OHLCV[] {
    // Stooq files are CRLF; split both endings so no \r rides along in a field.
    const lines = data.trim().split(/\r?\n/);
    // Skip the <TICKER>,<PER>,... header line
    const dataLines = lines.slice(1);

    const ohlcvArray: OHLCV[] = [];

    for (const line of dataLines) {
      const parts = line.split(',');
      // Malformed row: Stooq rows have 10 fields
      if (parts.length < 10) continue;

      const dateStr = parts[2].trim();
      const timeStr = parts[3].trim();

      // DATE = YYYYMMDD, TIME = HHMMSS (daily files use 000000)
      if (!/^\d{8}$/.test(dateStr) || !/^\d{6}$/.test(timeStr)) continue;

      const year = Number(dateStr.slice(0, 4));
      const month = Number(dateStr.slice(4, 6));
      const day = Number(dateStr.slice(6, 8));
      const hours = Number(timeStr.slice(0, 2));
      const minutes = Number(timeStr.slice(2, 4));
      const seconds = Number(timeStr.slice(4, 6));

      // Real epoch milliseconds, not YYYYMMDDHHMMSS integers.
      const timestamp = Date.UTC(year, month - 1, day, hours, minutes, seconds);

      // Reject rolled-over dates (e.g. month 13 becomes next January)
      const roundTrip = new Date(timestamp);
      if (
        roundTrip.getUTCFullYear() !== year ||
        roundTrip.getUTCMonth() !== month - 1 ||
        roundTrip.getUTCDate() !== day
      ) continue;

      const open = parseFloat(parts[4]);
      const high = parseFloat(parts[5]);
      const low = parseFloat(parts[6]);
      const close = parseFloat(parts[7]);
      const volume = parseFloat(parts[8]);

      if (
        isNaN(open) || isNaN(high) || isNaN(low) ||
        isNaN(close) || isNaN(volume)
      ) continue;

      ohlcvArray.push({ timestamp, open, high, low, close, volume });
    }

    // Sort ASCENDING (oldest -> newest): Chart.js financial charts require
    // ascending data — with DESC order the controller's range computation
    // DROPS the oldest point(s) (proven by the 3.1 RED spec: 3 rows in,
    // 2 points on the chart, oldest missing).
    ohlcvArray.sort((a, b) => a.timestamp - b.timestamp);

    // Apply limit AFTER the sort so callers get the newest `limit` bars
    // (the tail of the ascending array = most recent N).
    return ohlcvArray.slice(-limit);
  }
}
