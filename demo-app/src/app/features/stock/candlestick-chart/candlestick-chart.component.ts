import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, registerables } from 'chart.js';
import { CandlestickController, CandlestickElement, OhlcController, OhlcElement } from 'chartjs-chart-financial';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import { StockPrice } from '../../../core/services/stock.service';

Chart.register(...registerables, CandlestickController, CandlestickElement, OhlcController, OhlcElement, zoomPlugin);

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
  chartType: 'candlestick' | 'ohlc' | 'bar' | 'line' = 'candlestick';
  scaleType: 'linear' | 'logarithmic' = 'linear';

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
    
    // Prepare data based on chart type
    let chartData: any;
    let datasetConfig: any;

    if (this.chartType === 'line') {
      // Line chart uses close prices only
      chartData = filteredPrices.map(p => ({
        x: new Date(p.date).getTime(),
        y: p.close
      }));
      datasetConfig = {
        label: this.title,
        data: chartData,
        borderColor: '#26a69a',
        backgroundColor: 'rgba(38, 166, 154, 0.1)',
        fill: true,
        tension: 0.1
      };
    } else if (this.chartType === 'bar') {
      // Bar chart uses close prices
      chartData = filteredPrices.map(p => ({
        x: new Date(p.date).getTime(),
        y: p.close
      }));
      datasetConfig = {
        label: this.title,
        data: chartData,
        backgroundColor: filteredPrices.map((p, i) => {
          if (i === 0) return '#999';
          return p.close >= filteredPrices[i-1].close ? 'rgba(38, 166, 154, 0.8)' : 'rgba(239, 83, 80, 0.8)';
        })
      };
    } else {
      // OHLC and Candlestick use full price data
      chartData = filteredPrices.map(p => ({
        x: new Date(p.date).getTime(),
        o: p.open,
        h: p.high,
        l: p.low,
        c: p.close
      }));
      datasetConfig = {
        label: this.title,
        data: chartData,
        borderColor: '#26a69a',
        color: {
          up: '#26a69a',
          down: '#ef5350',
          unchanged: '#999'
        }
      };
    }

    console.log('Creating', this.chartType, 'chart with', chartData.length, 'data points');

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context');
      return;
    }

    this.chart = new Chart(ctx, {
      type: this.chartType as any,
      data: {
        datasets: [datasetConfig]
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
                if (this.chartType === 'line' || this.chartType === 'bar') {
                  return `Close: $${data.y.toFixed(2)}`;
                } else {
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
            zoom: {
              zoom: {
                wheel: {
                  enabled: true,
                  speed: 0.1
                },
                pinch: {
                  enabled: true
                },
                mode: 'x'
              },
              pan: {
                enabled: true,
                mode: 'x',
                modifierKey: null
              },
              limits: {
                x: { min: 'original', max: 'original' }
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
            type: this.scaleType,
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

  changeChartType(type: 'candlestick' | 'ohlc' | 'bar' | 'line'): void {
    console.log('Changing chart type to:', type);
    this.chartType = type;
    this.createChart();
  }

  changeScaleType(scale: 'linear' | 'logarithmic'): void {
    console.log('Changing scale type to:', scale);
    this.scaleType = scale;
    this.createChart();
  }

  resetZoom(): void {
    if (this.chart) {
      this.chart.resetZoom();
    }
  }

  getFilteredPrices(): StockPrice[] {
    if (this.timeRange === 'all') {
      return this.prices;
    }

    const now = new Date();
    let cutoffDate = new Date();
    
    switch (this.timeRange) {
      case '1m':
        // Go back 1 month properly
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case '3m':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        break;
      case '6m':
        cutoffDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
        break;
      case '1y':
        cutoffDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
    }

    console.log('Filtering prices. Range:', this.timeRange, 'Cutoff date:', cutoffDate, 'Total prices:', this.prices.length);
    const filtered = this.prices.filter(p => {
      const priceDate = new Date(p.date);
      return priceDate >= cutoffDate;
    });
    console.log('Filtered to:', filtered.length, 'prices');
    return filtered;
  }
}
