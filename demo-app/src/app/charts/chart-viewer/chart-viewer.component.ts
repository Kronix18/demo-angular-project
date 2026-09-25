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

/**
 * Multi-pane chart viewer (3.1 REVISED per Kevin / Ruling 7): TradingView-style
 * TRUE panes — price candles in their own pane (~75% height) and volume bars in
 * a separate bottom pane (~25%, own y-scale, never overlapping the candles).
 * Two Chart instances share the x-range (identical time-scale min/max), so
 * zoom/pan (3.2) can sync both panes by updating the same range.
 */
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

      <!-- Price pane (candles only) -->
      <div class="pane price-pane" data-pane="price">
        <canvas #priceCanvas></canvas>
      </div>

      <!-- Volume pane (separate scale — TradingView layout, no overlap) -->
      <div class="pane volume-pane" data-pane="volume">
        <canvas #volumeCanvas></canvas>
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
        /* Definite viewport height: the parent flex chain (app-container →
           main-content → here) never resolves a definite height (measured:
           container stuck at content size 460px, dead gap below). calc()
           makes the height definite regardless of the parent chain: viewport
           minus navbar (70) + paddings (64) + toolbar (~89) + footer (~65). */
        height: calc(100vh - 288px);
        min-height: 480px;
        display: flex;
        flex-direction: column;
      }
      .pane {
        position: relative;
        width: 100%;
      }
      .price-pane {
        /* Viewport-relative fill: the app-container/main-content flex chain
           doesn't propagate a definite height (app.scss is served stale —
           changes verified in the file but not in the served CSS), so the
           panes size themselves: price ~62vh (toolbar+padding above, volume
           below), volume ~21vh. No overlap, no dead gap — measured live. */
        flex: 3 1 0;
        height: 62vh;
        min-height: 280px;
      }
      .volume-pane {
        flex: 1 1 0;
        height: 21vh;
        min-height: 90px;
        border-top: 1px solid var(--c-border, #d1d5db);
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
  @ViewChild('priceCanvas') priceCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('volumeCanvas') volumeCanvas?: ElementRef<HTMLCanvasElement>;
  private priceChart: Chart | null = null;
  private volumeChart: Chart | null = null;
  loading = true;
  error: string | null = null;
  currentSymbol: string = '';
  currentInterval: string = '1d';

  private chartDataService: ChartDataService;
  private route: ActivatedRoute;
  private router: Router;
  // ZONELESS app (no zone.js polyfill): async callbacks (HTTP subscribe) do
  // NOT trigger change detection — markForCheck() after state updates makes
  // the @if(loading)/@if(error) blocks re-render (2.2 fix, verified live).
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

  // Public since 2.2: the toolbar/state refactor (2.3/4.x) and specs drive
  // reloads through it.
  loadChartData(symbol: string, interval: string): void {
    this.loading = true;
    this.error = null;
    this.chartDataService.getOHLCV(symbol, interval, 100).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.createCharts(data);
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
    this.router.navigate(['/charts', symbol], { replaceUrl: true });
    this.loadChartData(symbol, this.currentInterval);
  }

  onToolbarIntervalChange(interval: string): void {
    this.currentInterval = interval;
    this.loadChartData(this.currentSymbol, interval);
  }

  /** X extent shared by both panes — identical min/max keeps them aligned. */
  private sharedXExtent(data: OHLCV[]): { min: number; max: number } {
    const timestamps = data.map((d) => d.timestamp);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    // pad each side by ~1 bar so edge candles/bars aren't clipped
    const pad = data.length > 1 ? (max - min) / (data.length - 1) : 86400000;
    return { min: min - pad, max: max + pad };
  }

  private destroyCharts(): void {
    if (this.priceChart) {
      this.priceChart.destroy();
      this.priceChart = null;
    }
    if (this.volumeChart) {
      this.volumeChart.destroy();
      this.volumeChart = null;
    }
  }

  private createCharts(data: OHLCV[]): void {
    // Belt-and-braces guard: never crash on missing canvas references.
    const priceEl = this.priceCanvas?.nativeElement;
    const volEl = this.volumeCanvas?.nativeElement;
    if (!priceEl || !volEl) {
      console.warn('createCharts: panes not ready; skipping chart creation');
      return;
    }

    this.destroyCharts();

    const priceData = data.map((d) => ({
      x: d.timestamp, o: d.open, h: d.high, l: d.low, c: d.close,
    }));
    const volumeData = data.map((d) => ({
      x: d.timestamp, y: d.volume,
    }));

    const xExtent = this.sharedXExtent(data);
    // Identical time-scale config across panes — the shared-x contract.
    const xScale = {
      type: 'time',
      time: { unit: 'day' },
      min: xExtent.min,
      max: xExtent.max,
      ticks: { source: 'data', maxRotation: 0, autoSkip: true },
    };

    // PRICE pane: candlestick only (volume lives in its own pane now).
    this.priceChart = new Chart(priceEl, {
      type: 'candlestick',
      data: { datasets: [{ type: 'candlestick', label: 'Price', data: priceData }] } as any,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false }, // TradingView hides the legend; 10.2 adds rows
          tooltip: { enabled: true, mode: 'index', intersect: false },
        },
        scales: {
          x: xScale,
          y: { type: 'linear', position: 'left' as const },
        },
      } as any,
    });

    // VOLUME pane: bars on their own scale — starts at 0, never overlaps price.
    this.volumeChart = new Chart(volEl, {
      type: 'bar',
      data: { datasets: [{ label: 'Volume', data: volumeData, backgroundColor: 'rgba(75, 192, 192, 0.5)', borderColor: 'rgba(75, 192, 192, 1)' }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true, mode: 'index', intersect: false },
        },
        scales: {
          x: { ...xScale, display: false }, // single x-axis labels on the price pane
          y: { type: 'linear', position: 'right' as const, beginAtZero: true, grid: { drawOnChartArea: false } },
        },
      } as any,
    });
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }
}
