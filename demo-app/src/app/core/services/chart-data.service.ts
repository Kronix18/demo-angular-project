import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { OHLCV } from '../models/ohlcv.model';

@Injectable({
  providedIn: 'root'
})
export class ChartDataService {

  constructor(private http: HttpClient) { }

  getOHLCV(symbol: string, interval: string, limit: number = 100): Observable<OHLCV[]> {
    // Convert symbol to uppercase and ensure it has .US suffix if not present
    const formattedSymbol = symbol.toUpperCase().endsWith('.US') ? symbol.toUpperCase() : `${symbol.toUpperCase()}.US`;
    const url = `assets/test-data/${formattedSymbol}.us.txt`;

    return this.http.get(url, { responseType: 'text' }).pipe(
      map(data => this.parseStockData(data, limit)),
      catchError(error => {
        console.warn(`Test data not found for ${formattedSymbol}, falling back to empty data.`, error);
        return of([]);
      })
    );
  }

  private parseStockData(data: string, limit: number): OHLCV[] {
    const lines = data.trim().split('\n');
    // Skip header line
    const dataLines = lines.slice(1);

    const ohlcvArray: OHLCV[] = [];

    for (const line of dataLines) {
      const parts = line.split(',');
      if (parts.length < 10) continue;

      const [ticker, per, dateStr, timeStr, openStr, highStr, lowStr, closeStr, volStr] = parts;

      // We only care about daily data for now; ignore interval
      // Convert date (YYYYMMDD) and time (HHMMSS) to timestamp
      const date = dateStr.trim();
      const time = timeStr.trim().padStart(6, '0'); // Ensure 6 digits
      const timestamp = parseInt(`${date}${time}`, 10); // YYYYMMDDHHMMSS

      const open = parseFloat(openStr);
      const high = parseFloat(highStr);
      const low = parseFloat(lowStr);
      const close = parseFloat(closeStr);
      const volume = parseFloat(volStr);

      if (!isNaN(timestamp) && !isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) && !isNaN(volume)) {
        ohlcvArray.push({
          timestamp,
          open,
          high,
          low,
          close,
          volume
        });
      }
    }

    // Sort by timestamp descending (most recent first)
    ohlcvArray.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    return ohlcvArray.slice(0, limit);
  }
}