import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';

export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  peRatio: number;
  dividend: number;
  volume: number;
  avgVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  industry: string;
  sector: string;
}

@Injectable({
  providedIn: 'root'
})
export class StockService {
  private mockStocks: Stock[] = [
    {
      symbol: 'AAPL',
      name: 'Apple Inc.',
      price: 189.45,
      change: 2.35,
      changePercent: 1.25,
      marketCap: 2900000000000,
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
      symbol: 'MSFT',
      name: 'Microsoft Corporation',
      price: 378.91,
      change: 5.23,
      changePercent: 1.40,
      marketCap: 2820000000000,
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
      symbol: 'NVDA',
      name: 'NVIDIA Corporation',
      price: 875.29,
      change: -12.45,
      changePercent: -1.40,
      marketCap: 2150000000000,
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
      symbol: 'TSLA',
      name: 'Tesla, Inc.',
      price: 242.84,
      change: -8.16,
      changePercent: -3.26,
      marketCap: 770000000000,
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
      symbol: 'AMZN',
      name: 'Amazon.com, Inc.',
      price: 183.12,
      change: 4.78,
      changePercent: 2.68,
      marketCap: 1920000000000,
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
      symbol: 'JPM',
      name: 'JPMorgan Chase & Co.',
      price: 191.23,
      change: 1.45,
      changePercent: 0.76,
      marketCap: 535000000000,
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
      symbol: 'GE',
      name: 'General Electric Co.',
      price: 156.32,
      change: 3.12,
      changePercent: 2.03,
      marketCap: 152000000000,
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
      symbol: 'KO',
      name: 'Coca-Cola Company',
      price: 65.43,
      change: 0.92,
      changePercent: 1.42,
      marketCap: 282000000000,
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

  constructor() {}

  getStocks(): Observable<Stock[]> {
    return this.stocks$;
  }

  getStock(symbol: string): Observable<Stock | undefined> {
    const stock = this.mockStocks.find(s => s.symbol === symbol);
    return of(stock);
  }

  searchStocks(query: string): Observable<Stock[]> {
    const filtered = this.mockStocks.filter(s =>
      s.symbol.toLowerCase().includes(query.toLowerCase()) ||
      s.name.toLowerCase().includes(query.toLowerCase())
    );
    return of(filtered);
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
    let filtered = [...this.mockStocks];

    if (criteria.minPrice !== undefined) {
      filtered = filtered.filter(s => s.price >= criteria.minPrice!);
    }
    if (criteria.maxPrice !== undefined) {
      filtered = filtered.filter(s => s.price <= criteria.maxPrice!);
    }
    if (criteria.minPE !== undefined) {
      filtered = filtered.filter(s => s.peRatio >= criteria.minPE!);
    }
    if (criteria.maxPE !== undefined) {
      filtered = filtered.filter(s => s.peRatio <= criteria.maxPE!);
    }
    if (criteria.minDividend !== undefined) {
      filtered = filtered.filter(s => s.dividend >= criteria.minDividend!);
    }
    if (criteria.sector) {
      filtered = filtered.filter(s => s.sector === criteria.sector);
    }
    if (criteria.minVolume !== undefined) {
      filtered = filtered.filter(s => s.volume >= criteria.minVolume!);
    }

    return of(filtered);
  }

  getSectors(): Observable<string[]> {
    const sectors = Array.from(new Set(this.mockStocks.map(s => s.sector)));
    return of(sectors);
  }
}
