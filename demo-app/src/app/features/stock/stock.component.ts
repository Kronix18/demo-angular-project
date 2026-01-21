import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { StockService, Stock } from '../../core/services/stock.service';

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss'
})
export class StockComponent implements OnInit {
  stock: Stock | null = null;
  isLoading = false;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const symbol = params['symbol'];
      if (symbol) {
        this.isLoading = true;
        this.error = '';
        this.stockService.getStock(symbol).subscribe({
          next: (stock) => {
            this.stock = stock;
            this.isLoading = false;
          },
          error: (err) => {
            this.isLoading = false;
            this.error = `Failed to load stock data for ${symbol}. Please try again.`;
            console.error('Error loading stock:', err);
          }
        });
      }
    });
  }

  getRangePercent(): number {
    if (!this.stock || !this.stock.fiftyTwoWeekHigh || !this.stock.fiftyTwoWeekLow) return 0;
    const range = this.stock.fiftyTwoWeekHigh - this.stock.fiftyTwoWeekLow;
    const position = this.stock.price - this.stock.fiftyTwoWeekLow;
    return (position / range) * 100;
  }
}
