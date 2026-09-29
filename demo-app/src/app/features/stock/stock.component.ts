import { IconComponent } from '../../shared/icons/icon.component';
import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StockService, StockDetail, Company, StockPrice } from '../../core/services/stock.service';
import { CandlestickChartComponent } from './candlestick-chart/candlestick-chart.component';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, RouterLink, CandlestickChartComponent, IconComponent],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StockComponent implements OnInit {
  company: Company | null = null;
  prices: StockPrice[] = [];
  currentPrice: number = 0;
  priceChange: number = 0;
  priceChangePercent: number = 0;
  isLoading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const symbol = params['symbol'];
      console.log('Stock component initialized with symbol:', symbol);
      if (symbol) {
        this.isLoading = true;
        this.error = '';
        console.log('Fetching stock data for:', symbol);
        this.stockService.getStock(symbol).subscribe({
          next: (data: StockDetail) => {
            console.log('Raw stock data received:', data);
            console.log('Company data:', data.company);
            console.log('Prices count:', data.prices?.length);
            
            this.company = data.company;
            this.prices = data.prices || [];
            
            // Calculate current price and changes from most recent price data
            if (this.prices.length > 0) {
              const sortedPrices = [...this.prices].sort((a, b) => 
                new Date(b.date).getTime() - new Date(a.date).getTime()
              );
              this.currentPrice = sortedPrices[0].close;
              
              if (sortedPrices.length > 1) {
                const previousClose = sortedPrices[1].close;
                this.priceChange = this.currentPrice - previousClose;
                this.priceChangePercent = (this.priceChange / previousClose) * 100;
              }
            }
            
            this.isLoading = false;
            console.log('Stock component state:', { 
              company: this.company, 
              pricesCount: this.prices.length,
              currentPrice: this.currentPrice,
              isLoading: this.isLoading
            });
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.isLoading = false;
            this.error = `Failed to load stock data for ${symbol}. Please try again.`;
            console.error('Error loading stock:', err);
            this.cdr.markForCheck();
          }
        });
      } else {
        console.warn('No symbol provided in route params');
      }
    });
  }

  getRangePercent(): number {
    if (this.prices.length === 0) return 0;
    
    const closes = this.prices.map(p => p.close);
    const high = Math.max(...closes);
    const low = Math.min(...closes);
    const range = high - low;
    
    if (range === 0) return 0;
    
    const position = this.currentPrice - low;
    return (position / range) * 100;
  }
}
