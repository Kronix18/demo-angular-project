import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IgxFinancialChartModule } from 'igniteui-angular-charts';
import { StockPrice } from '../../../core/services/stock.service';

interface OhlcData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

@Component({
  selector: 'app-candlestick-chart',
  standalone: true,
  imports: [CommonModule, IgxFinancialChartModule],
  templateUrl: './candlestick-chart.component.html',
  styleUrl: './candlestick-chart.component.scss'
})
export class CandlestickChartComponent implements OnInit, OnDestroy {
  @Input() prices: StockPrice[] = [];
  @Input() title: string = 'Price History';
  
  chartData: OhlcData[] = [];
  timeRange: 'all' | '1y' | '6m' | '3m' | '1m' = 'all';
  chartType: 'Candlestick' | 'Line' = 'Candlestick';

  ngOnInit(): void {
    console.log('CandlestickChartComponent initialized with', this.prices.length, 'price points');
    this.updateChartData();
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  updateChartData(): void {
    const filteredPrices = this.getFilteredPrices();
    this.chartData = filteredPrices.map(p => ({
      date: new Date(p.date),
      open: p.open,
      high: p.high,
      low: p.low,
      close: p.close,
      volume: p.volume
    }));
    console.log('Chart data updated with', this.chartData.length, 'data points');
  }

  changeTimeRange(range: 'all' | '1y' | '6m' | '3m' | '1m'): void {
    console.log('Changing time range to:', range);
    this.timeRange = range;
    this.updateChartData();
  }

  changeChartType(type: 'Candlestick' | 'Line'): void {
    console.log('Changing chart type to:', type);
    this.chartType = type;
  }

  getFilteredPrices(): StockPrice[] {
    if (this.timeRange === 'all') {
      return this.prices;
    }

    const now = new Date();
    const cutoffDate = new Date();
    
    // Use date arithmetic instead of setMonth to avoid edge cases
    switch (this.timeRange) {
      case '1m':
        // Go back 30 days
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        // Go back 90 days
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        // Go back 180 days
        cutoffDate.setDate(now.getDate() - 180);
        break;
      case '1y':
        // Go back 365 days
        cutoffDate.setDate(now.getDate() - 365);
        break;
    }

    console.log('Filtering prices. Cutoff date:', cutoffDate, 'Total prices:', this.prices.length);
    const filtered = this.prices.filter(p => {
      const priceDate = new Date(p.date);
      return priceDate >= cutoffDate;
    });
    console.log('Filtered to:', filtered.length, 'prices');
    return filtered;
  }
}
