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
  private mockStocks: Stock[] = [
    {
      ticker: 'AAPL',
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 189.45,
      change: 2.35,
      change_percent: 1.25,
      market_cap: 2900000000000,
      peRatio: 28.5,
      dividend: 0.96,
      volume: 52000000,
      avgVolume: 48000000,
      fiftyTwoWeekHigh: 199.62,
      fiftyTwoWeekLow: 155.33,
      industry: 'Consumer Electronics',
      sector: 'Technology'
    },
    {
      ticker: 'MSFT',
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      price: 378.91,
      change: 5.23,
      change_percent: 1.40,
      market_cap: 2820000000000,
      peRatio: 35.2,
      dividend: 0.68,
      volume: 18000000,
      avgVolume: 21000000,
      fiftyTwoWeekHigh: 417.49,
      fiftyTwoWeekLow: 305.84,
      industry: 'Software',
      sector: 'Technology'
    },
    {
      ticker: 'NVDA',
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 875.29,
      change: -12.45,
      change_percent: -1.40,
      market_cap: 2150000000000,
      peRatio: 55.3,
      dividend: 0.04,
      volume: 35000000,
      avgVolume: 39000000,
      fiftyTwoWeekHigh: 999.02,
      fiftyTwoWeekLow: 398.26,
      industry: 'Semiconductors',
      sector: 'Technology'
    },
    {
      ticker: 'TSLA',
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      price: 242.84,
      change: -8.16,
      change_percent: -3.26,
      market_cap: 770000000000,
      peRatio: 68.9,
      dividend: 0,
      volume: 125000000,
      avgVolume: 110000000,
      fiftyTwoWeekHigh: 299.29,
      fiftyTwoWeekLow: 138.80,
      industry: 'Auto Manufacturers',
      sector: 'Consumer Cyclical'
    },
    {
      ticker: 'AMZN',
      symbol: 'AMZN',
      name: 'Amazon.com, Inc.',
      price: 183.12,
      change: 4.78,
      change_percent: 2.68,
      market_cap: 1920000000000,
      peRatio: 42.1,
      dividend: 0,
      volume: 42000000,
      avgVolume: 48000000,
      fiftyTwoWeekHigh: 198.48,
      fiftyTwoWeekLow: 118.57,
      industry: 'Retail',
      sector: 'Consumer Cyclical'
    },
    {
      ticker: 'JPM',
      symbol: 'JPM',
      name: 'JPMorgan Chase & Co.',
      price: 191.23,
      change: 1.45,
      change_percent: 0.76,
      market_cap: 535000000000,
      peRatio: 12.4,
      dividend: 4.20,
      volume: 8900000,
      avgVolume: 9200000,
      fiftyTwoWeekHigh: 209.98,
      fiftyTwoWeekLow: 164.91,
      industry: 'Banks',
      sector: 'Financial'
    },
    {
      ticker: 'GE',
      symbol: 'GE',
      name: 'General Electric Co.',
      price: 156.32,
      change: 3.12,
      change_percent: 2.03,
      market_cap: 152000000000,
      peRatio: 18.6,
      dividend: 0.80,
      volume: 6300000,
      avgVolume: 5800000,
      fiftyTwoWeekHigh: 168.45,
      fiftyTwoWeekLow: 98.50,
      industry: 'Diversified Industrials',
      sector: 'Industrials'
    },
    {
      ticker: 'KO',
      symbol: 'KO',
      name: 'Coca-Cola Company',
      price: 65.43,
      change: 0.92,
      change_percent: 1.42,
      market_cap: 282000000000,
      peRatio: 25.3,
      dividend: 1.84,
      volume: 9800000,
      avgVolume: 10200000,
      fiftyTwoWeekHigh: 71.28,
      fiftyTwoWeekLow: 54.37,
      industry: 'Beverages',
      sector: 'Consumer Defensive'
    }
  ];

  private stocksSubject = new BehaviorSubject<Stock[]>(this.mockStocks);
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
