import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import 'chartjs-chart-financial'; // Import for side effects (registers candlestick chart type)
import { ChartDataService } from '../../core/services/chart-data.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartToolbarComponent } from '../chart-toolbar/chart-toolbar.component';

@Component({
  selector: 'app-chart-viewer',
  standalone: true,
  imports: [CommonModule, ChartToolbarComponent],
  template: `
    <div class="chart-container">
      <app-chart-toolbar 
        (symbolChange)="onToolbarSymbolChange($event)" 
        (intervalChange)="onToolbarIntervalChange($event)">
      </app-chart-toolbar>
      
      <div *ngIf="loading; else chartView">
        <p>Loading chart...</p>
      </div>
      <ng-template #chartView>
        <canvas #chartCanvas></canvas>
        <div *ngIf="error" class="error-message">
          <p>Error loading chart: {{ error }}</p>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    canvas {
      flex: 1 1 auto;
      width: 100%;
    }
    .error-message {
      padding: 1rem;
      color: red;
      text-align: center;
    }
  `]
})
export class ChartViewerComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;
  protected chart: Chart | null = null;
  loading = true;
  error: string | null = null;
  currentSymbol: string = '';
  currentInterval: string = '1d'; // default interval

  constructor(
    private chartDataService: ChartDataService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.currentSymbol = params['symbol'] || 'AAPL';
      this.loadChartData(this.currentSymbol, this.currentInterval);
    });
  }

  ngAfterViewInit(): void {
    // Chart will be created when data loads
  }

  private loadChartData(symbol: string, interval: string): void {
    this.loading = true;
    this.error = null;
    // Fetch OHLCV data for the last 100 days (adjust as needed)
    this.chartDataService.getOHLCV(symbol, interval, 100).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.createChart(data);
          this.loading = false;
        } else {
          this.error = 'No data available';
          this.loading = false;
        }
      },
      error: (err) => {
        console.error('Failed to load chart data:', err);
        this.error = 'Failed to load chart data';
        this.loading = false;
      }
    });
  }

  // NEW: Handler methods for toolbar events
  onToolbarSymbolChange(symbol: string): void {
    this.currentSymbol = symbol;
    this.loadChartData(symbol, this.currentInterval);
  }

  onToolbarIntervalChange(interval: string): void {
    this.currentInterval = interval;
    this.loadChartData(this.currentSymbol, interval);
  }

  private createChart(data: OHLCV[]): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) {
      this.error = 'Could not get canvas context';
      this.loading = false;
      return;
    }

    // Destroy existing chart if any
    if (this.chart) {
      this.chart.destroy();
    }

    // Prepare data for candlestick and volume
    const priceData = data.map(d => ({
      x: d.timestamp,
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close
    }));
    const volumeData = data.map(d => ({
      x: d.timestamp,
      y: d.volume
    }));

    // Use 'any' to avoid type issues with mixed dataset types
    const datasets: any = [
      {
        type: 'candlestick',
        label: 'Price',
        data: priceData,
        yAxisID: 'y-price',
        // Optional: customize candlestick colors
        candleColor: (context: any) => {
          const candle = context.dataset.data[context.dataIndex] as { o: number; c: number };
          return candle.c >= candle.o ? 'green' : 'red';
        }
      },
      {
        type: 'bar',
        label: 'Volume',
        data: volumeData,
        yAxisID: 'y-volume',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWeight: 1
      }
    ];

    this.chart = new Chart(ctx, {
      type: 'candlestick', // default type, but overridden per dataset
      data: {
        datasets: datasets
      } as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top' as const
          },
          tooltip: {
            enabled: true,
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day'
            },
            ticks: {
              source: 'data'
            }
          },
          'y-price': {
            type: 'linear',
            position: 'left' as const
          },
          'y-volume': {
            type: 'linear',
            position: 'right' as const,
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              // Only show if needed
              callback: (value: number | string) => {
                return typeof value === 'number' ? value : '';
              }
            }
          }
        }
      }
    });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}