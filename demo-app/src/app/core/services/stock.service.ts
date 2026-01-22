import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ApiService } from './api.service';

export interface StockPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  adjusted_close: number | null;
}

export interface Company {
  ticker: string;
  name: string;
  sector: string;
  industry: string;
  market_cap: number | null;
  pe_ratio: number | null;
  eps: number | null;
  dividend_yield: number | null;
  description: string | null;
  website: string | null;
}

export interface StockDetail {
  company: Company;
  prices: StockPrice[];
}

// Legacy interface for screener results
export interface Stock {
  ticker: string;
  name: string;
  price: number;
  volume: number;
  change_percent: number;
  market_cap: number | null;
  date?: string;
  sector?: string;
  industry?: string;
  // Legacy fields (optional, for backwards compatibility)
  symbol?: string;
  change?: number;
  peRatio?: number;
  dividend?: number;
  avgVolume?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {

  private stocksSubject = new BehaviorSubject<Stock[]>([]);
  stocks$ = this.stocksSubject.asObservable();

  constructor(private apiService: ApiService) {}

  getStocks(): Observable<Stock[]> {
    return this.apiService.get<Stock[]>('stocks');
  }

  getStock(symbol: string): Observable<StockDetail> {
    console.log('StockService.getStock called with symbol:', symbol);
    return this.apiService.get<StockDetail>(`api/stocks/${symbol}`);
  }

  searchStocks(query: string): Observable<Stock[]> {
    return this.apiService.get<Stock[]>(`api/stocks/search?q=${encodeURIComponent(query)}`);
  }

  filterStocks(criteria: {
    minPrice?: number;
    maxPrice?: number;
    minPE?: number;
    maxPE?: number;
    minDividend?: number;
    sector?: string;
    minVolume?: number;
  }): Observable<Stock[]> {
    const params = new URLSearchParams();
    if (criteria.minPrice !== undefined) params.append('minPrice', criteria.minPrice.toString());
    if (criteria.maxPrice !== undefined) params.append('maxPrice', criteria.maxPrice.toString());
    if (criteria.minPE !== undefined) params.append('minPE', criteria.minPE.toString());
    if (criteria.maxPE !== undefined) params.append('maxPE', criteria.maxPE.toString());
    if (criteria.minDividend !== undefined) params.append('minDividend', criteria.minDividend.toString());
    if (criteria.sector) params.append('sector', criteria.sector);
    if (criteria.minVolume !== undefined) params.append('minVolume', criteria.minVolume.toString());
    
    return this.apiService.get<Stock[]>(`api/stocks/filter?${params.toString()}`);
  }

  getSectors(): Observable<string[]> {
    return this.apiService.get<string[]>('api/stocks/sectors');
  }
}
