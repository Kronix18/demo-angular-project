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

  constructor(
    private route: ActivatedRoute,
    private stockService: StockService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const symbol = params['symbol'];
      if (symbol) {
        this.stockService.getStock(symbol).subscribe(stock => {
          this.stock = stock || null;
        });
      }
    });
  }

  getRangePercent(): number {
    if (!this.stock) return 0;
    const range = this.stock.fiftyTwoWeekHigh - this.stock.fiftyTwoWeekLow;
    const position = this.stock.price - this.stock.fiftyTwoWeekLow;
    return (position / range) * 100;
  }
}
