import { Component, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';
import { ChartDataService } from '../../core/services/chart-data.service';
import { ActivatedRoute, Router } from '@angular/router';
import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartToolbarComponent } from '../chart-toolbar/chart-toolbar.component';
// 2.2 (task file): chart-setup MUST be imported before chartjs-chart-financial
// anywhere — it registers registerables + adapter + zoom + the financial
// controllers/elements (side-effect import alone is unreliable: ESM/CJS
// dual-package hazard, verified empirically 2026-09-24).
import '../chart-setup';
import 'chartjs-chart-financial';

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

      @if (loading) {
        <div class="loading-overlay">Loading chart...</div>
      }

      <!-- Canvas ALWAYS in DOM (2.2 timing fix: the pre-fix *ngIf hid it while
           loading, so @ViewChild was undefined when data arrived and
           createChart crashed on nativeElement). -->
      <div class="canvas-wrap">
        <canvas #chartCanvas></canvas>
      </div>

      @if (error) {
        <div class="error-message">
          <p>Error loading chart: {{ error }}</p>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .chart-container {
        position: relative;
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .canvas-wrap {
        position: relative;
        flex: 1 1 auto;
        min-height: 320px;
        width: 100%;
      }
      canvas {
        width: 100% !important;
        height: 100% !important;
      }
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--c-surface, rgba(255, 255, 255, 0.7));
        z-index: 5;
      }
      .error-message {
        padding: 1rem;
        color: var(--auth-error-color, #dc3545);
        text-align: center;
      }
    `,
  ],
})
export class ChartViewerComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;
  protected chart: Chart | null = null;
  loading = true;
  error: string | null = null;
  currentSymbol: string = '';
  currentInterval: string = '1d';

  private chartDataService: ChartDataService;
  private route: ActivatedRoute;
  private router: Router;
  // ZONELESS app (no zone.js polyfill): async callbacks (HTTP subscribe) do
  // NOT trigger change detection — markForCheck() after state updates makes
  // the @if(loading)/@if(error) blocks re-render (2.2 fix, verified live:
  // without it the loading overlay stays stuck over the rendered chart).
  private cdr: ChangeDetectorRef;

  constructor(
    chartDataService: ChartDataService,
    route: ActivatedRoute,
    router: Router,
    cdr: ChangeDetectorRef
  ) {
    this.chartDataService = chartDataService;
    this.route = route;
    this.router = router;
    this.cdr = cdr;
  }

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const symbol = params['symbol'] || 'msft';
      // Skip re-fire when the symbol is unchanged (router.navigate with
      // replaceUrl re-emits params without re-creating the component; without
      // this guard every toolbar symbol change fetched TWICE).
      if (symbol === this.currentSymbol) return;
      this.currentSymbol = symbol;
      this.loadChartData(symbol, this.currentInterval);
    });
  }

  // Public since 2.2 (was private): the toolbar/state refactor (2.3/4.x) and
  // the specs drive reloads through it.
  loadChartData(symbol: string, interval: string): void {
    this.loading = true;
    this.error = null;
    this.chartDataService.getOHLCV(symbol, interval, 100).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.createChart(data);
        } else {
          this.error = 'No data available';
        }
        this.loading = false;
        this.cdr.markForCheck(); // zoneless: schedule CD after async state change
      },
      error: (err) => {
        console.error('Failed to load chart data:', err);
        this.error = 'Failed to load chart data';
        this.loading = false;
        this.cdr.markForCheck(); // zoneless: schedule CD after async state change
      },
    });
  }

  onToolbarSymbolChange(symbol: string): void {
    this.currentSymbol = symbol;
    // Keep the URL in sync (2.3): refresh/deep-link preserves the symbol.
    // replaceState — no navigation, no component re-creation.
    this.router.navigate(['/charts', symbol], { replaceUrl: true });
    this.loadChartData(symbol, this.currentInterval);
  }

  onToolbarIntervalChange(interval: string): void {
    this.currentInterval = interval;
    this.loadChartData(this.currentSymbol, interval);
  }

  private createChart(data: OHLCV[]): void {
    // Belt-and-braces guard (2.2): never crash on a missing canvas reference
    // (the pre-fix failure mode).
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) {
      console.warn('createChart: canvas not ready; skipping chart creation');
      return;
    }

    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const priceData = data.map((d) => ({
      x: d.timestamp,
      o: d.open,
      h: d.high,
      l: d.low,
      c: d.close,
    }));
    const volumeData = data.map((d) => ({
      x: d.timestamp,
      y: d.volume,
    }));

    const datasets: any = [
      {
        type: 'candlestick',
        label: 'Price',
        data: priceData,
        yAxisID: 'y-price',
      },
      {
        type: 'bar',
        label: 'Volume',
        data: volumeData,
        yAxisID: 'y-volume',
        backgroundColor: 'rgba(75, 192, 192, 0.5)',
        borderColor: 'rgba(75, 192, 192, 1)',
      },
    ];

    // Pass the CANVAS (not the context): Chart.js acquires the context itself
    // and expects item.getContext('2d') — passing a pre-acquired context breaks
    // its context.canvas === item identity check.
    this.chart = new Chart(canvas, {
      type: 'candlestick',
      data: { datasets } as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'top' as const },
          tooltip: { enabled: true, mode: 'index', intersect: false },
        },
        scales: {
          x: {
            type: 'time',
            time: { unit: 'day' },
            ticks: { source: 'data', maxRotation: 0, autoSkip: true },
          },
          'y-price': { type: 'linear', position: 'left' as const },
          'y-volume': {
            type: 'linear',
            position: 'right' as const,
            grid: { drawOnChartArea: false },
            beginAtZero: true,
          },
        },
      } as any,
    });
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
}
