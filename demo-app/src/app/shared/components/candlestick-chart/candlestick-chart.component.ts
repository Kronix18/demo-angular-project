import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import { StockPrice } from '../../../core/services/stock.service';

Chart.register(...registerables, CandlestickController, CandlestickElement, OhlcController, OhlcElement);

@Component({
  selector: 'app-candlestick-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candlestick-chart.component.html',
  styleUrl: './candlestick-chart.component.scss'
})
export class CandlestickChartComponent implements OnInit, OnChanges, OnDestroy {
  @Input() prices: StockPrice[] = [];
  @Input() title: string = 'Price History';
  
  private chart: Chart | null = null;
  timeRange: 'all' | '1y' | '6m' | '3m' | '1m' = 'all';
  chartType: 'candlestick' | 'line' = 'candlestick';

  ngOnInit(): void {
    console.log('CandlestickChartComponent initialized with', this.prices.length, 'price points');
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['prices'] && !changes['prices'].firstChange) {
      console.log('Prices updated, recreating chart');
      this.createChart();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }

  createChart(): void {
    const canvas = document.getElementById('stockChart') as HTMLCanvasElement;
    if (!canvas) {
      console.error('Canvas element not found');
      return;
    }

    if (this.chart) {
      this.chart.destroy();
    }

    const filteredPrices = this.getFilteredPrices();
    const chartData = filteredPrices.map(p => ({
      x: new Date(p.date).getTime(),
      o: p.open,
      h: p.high,
      l: p.low,
      c: p.close
    }));

    console.log('Creating chart with', chartData.length, 'data points');

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context');
      return;
    }

    this.chart = new Chart(ctx, {
      type: this.chartType,
      data: {
        datasets: [{
          label: this.title,
          data: chartData,
          borderColor: '#26a69a',
          backgroundColor: 'rgba(38, 166, 154, 0.5)'
        } as any]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const data = context.raw;
                return [
                  `Open: $${data.o.toFixed(2)}`,
                  `High: $${data.h.toFixed(2)}`,
                  `Low: $${data.l.toFixed(2)}`,
                  `Close: $${data.c.toFixed(2)}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day'
            },
            grid: {
              display: false
            }
          },
          y: {
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    });
  }

  changeTimeRange(range: 'all' | '1y' | '6m' | '3m' | '1m'): void {
    console.log('Changing time range to:', range);
    this.timeRange = range;
    this.createChart();
  }

  changeChartType(type: 'candlestick' | 'line'): void {
    console.log('Changing chart type to:', type);
    this.chartType = type;
    this.createChart();
  }

  getFilteredPrices(): StockPrice[] {
    if (this.timeRange === 'all') {
      return this.prices;
    }

    const now = new Date();
    const cutoffDate = new Date();
    
    switch (this.timeRange) {
      case '1m':
        cutoffDate.setDate(now.getDate() - 30);
        break;
      case '3m':
        cutoffDate.setDate(now.getDate() - 90);
        break;
      case '6m':
        cutoffDate.setDate(now.getDate() - 180);
        break;
      case '1y':
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
