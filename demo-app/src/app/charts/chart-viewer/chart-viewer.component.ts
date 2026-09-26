import { Component, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject, DestroyRef } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';
import { ChartDataService } from '../../core/services/chart-data.service';
import { ChartStateService } from '../../core/services/chart-state.service';
import { filterByRange } from '../../core/services/data-aggregation';
import { ActivatedRoute, Router } from '@angular/router';
import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartToolbarComponent } from '../chart-toolbar/chart-toolbar.component';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
// 2.2 (task file): chart-setup MUST be imported before chartjs-chart-financial
// anywhere — it registers registerables + adapter + zoom + the financial
// controllers/elements (side-effect import alone is unreliable: ESM/CJS
// dual-package hazard, verified empirically 2026-09-24).
import '../chart-setup';
import 'chartjs-chart-financial';

/**
 * 3.3 Crosshair plugin (module-level const): draws a 1px vertical line at the
 * active tooltip's x-position on the pane being drawn — the TradingView
 * crosshair behavior (port of the Python viewer's crosshair.py UX contract).
 * Color read from the CSS custom property at runtime (token compliance; the
 * fallback hardcode is a fallback only).
 */
const crosshairPlugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart: Chart): void {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length) return;
    const x = active[0].element?.x;
    if (typeof x !== 'number' || !isFinite(x)) return;
    const { ctx, chartArea, scales } = chart;
    if (!ctx || !chartArea) return;
    // crosshair color from CSS var (fallback included)
    let color = '#758696';
    try {
      const v = getComputedStyle(chart.canvas).getPropertyValue('--c-crosshair').trim();
      if (v) color = v;
    } catch { /* jsdom/non-DOM: fallback */ }
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

/** Tooltip label callbacks (3.3): O/H/L/C for the price pane, Vol for the volume
 *  pane — TradingView-style readouts. */
const priceTooltipCallbacks = {
  label(item: any): string {
    const raw = item?.raw ?? {};
    const fmt = (v: unknown) => typeof v === 'number' ? v.toFixed(2) : String(v ?? '-');
    return `O ${fmt(raw.o)}  H ${fmt(raw.h)}  L ${fmt(raw.l)}  C ${fmt(raw.c)}`;
  },
};
const volumeTooltipCallbacks = {
  label(item: any): string {
    const v = item?.raw?.y;
    return `Vol ${typeof v === 'number' ? v.toLocaleString('en-US') : String(v ?? '-')}`;
  },
};

// 3.3: register the crosshair plugin globally (after its definition — no TDZ).
// The `crosshair: true` option key on each chart enables it per chart.
Chart.register(crosshairPlugin);

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
      <app-chart-toolbar>
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

      <div class="chart-actions">
        <button type="button" class="reset-zoom-btn" (click)="resetZoom()">Reset zoom</button>
      </div>
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
      .chart-actions {
        display: flex;
        justify-content: flex-end;
        padding: 0.5rem 0;
      }
      .reset-zoom-btn {
        padding: 0.375rem 0.875rem;
        border: 1px solid var(--c-border, #d1d5db);
        border-radius: var(--border-radius-sm, 4px);
        background: var(--c-surface, #fff);
        color: var(--c-text, #1f2937);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .reset-zoom-btn:hover {
        border-color: var(--c-primary, #2563eb);
        color: var(--c-primary, #2563eb);
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
  currentRange: string = '6m';

  private chartDataService: ChartDataService;
  private route: ActivatedRoute;
  private router: Router;
  // ZONELESS app (no zone.js polyfill): async callbacks (HTTP subscribe) do
  // NOT trigger change detection — markForCheck() after state updates makes
  // the @if(loading)/@if(error) blocks re-render (2.2 fix, verified live).
  private cdr: ChangeDetectorRef;
  private chartState: ChartStateService;
  private destroyRef = inject(DestroyRef);

  constructor(
    chartDataService: ChartDataService,
    route: ActivatedRoute,
    router: Router,
    cdr: ChangeDetectorRef,
    chartState: ChartStateService
  ) {
    this.chartDataService = chartDataService;
    this.route = route;
    this.router = router;
    this.cdr = cdr;
    this.chartState = chartState;
  }

  ngOnInit(): void {
    // 4.2 wiring: the toolbar writes to ChartStateService; the viewer derives
    // its data loads from state changes. Route param seeds the state ONCE.
    this.route.params.subscribe((params) => {
      const symbol = params['symbol'] || 'msft';
      if (symbol !== this.chartState.snapshot().symbol) {
        this.chartState.setSymbol(symbol);
      }
    });
    // Derive loads from state: symbol changes refetch (new data file);
    // interval/range changes re-render from the cached data (4.3: one fetch).
    this.chartState.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        const symbolChanged = s.symbol !== this.currentSymbol;
        const intervalChanged = s.interval !== this.currentInterval;
        this.currentSymbol = s.symbol;
        this.currentInterval = s.interval;
        this.currentRange = s.range;
        // Keep the URL in sync (2.3): refresh/deep-link preserves the symbol.
        if (symbolChanged) {
          this.router.navigate(['/charts', s.symbol], { replaceUrl: true });
        }
        if (symbolChanged || intervalChanged) {
          this.loadChartData(s.symbol, s.interval);
        } else if (this.allData.length) {
          // range change (or anything else): re-render from cached data
          this.createCharts(this.allData);
        }
      });
  }

  /** All bars fetched for the current symbol (one fetch per symbol, 4.3). */
  private allData: OHLCV[] = [];

  // Public since 2.2: the toolbar/state refactor (2.3/4.x) and specs drive
  // reloads through it.
  loadChartData(symbol: string, interval: string): void {
    this.loading = true;
    this.error = null;
    // 4.3: fetch enough bars for the widest range (daily data: 1Y ≈ 260 bars,
    // ALL = everything — the service's limit caps it; 1000 covers ~4y of msft).
    const barsNeeded = this.currentRange === 'ALL' ? 1000 : 400;
    this.chartDataService.getOHLCV(symbol, interval, barsNeeded).subscribe({
      next: (data) => {
        this.allData = data;
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

    // 4.3: display data = range slice (last-bar-anchored, client-side) +
    // weekly aggregation when the interval is 1w.
    const display = filterByRange(data, this.currentRange as any, this.currentInterval);
    if (!display.length) {
      this.error = 'No data in range';
      return;
    }

    const priceData = display.map((d) => ({
      x: d.timestamp, o: d.open, h: d.high, l: d.low, c: d.close,
    }));
    const volumeData = display.map((d) => ({
      x: d.timestamp, y: d.volume,
    }));

    // 4.3 FIX (Kevin: "it just chops off the dates before hand instead of
    // zooming in the amount it should be"): the VIEW extent must come from the
    // DISPLAYED data (the range slice), not the full array — otherwise the
    // sliced bars are compressed into a corner of the full-width scale instead
    // of the view zooming to frame them. The zoom LIMITS still span the full
    // data extent (zooming back out to ALL stays possible).
    const viewExtent = this.sharedXExtent(display);
    const fullExtent = this.sharedXExtent(data);
    // Raw bar width from the DISPLAYED data — feeds the zoom minRange limit.
    const rawSpan = viewExtent.max - viewExtent.min;
    this.currentBarWidth = display.length > 1 ? rawSpan / (display.length + 1) : 86400000;

    const xExtent = viewExtent; // VIEW extent (displayed data) — frames the slice
    // Identical time-scale config across panes — the shared-x contract.
    const xScale = {
      type: 'time',
      time: { unit: 'day' },
      min: xExtent.min,
      max: xExtent.max,
      ticks: { source: 'data', maxRotation: 0, autoSkip: true },
    };

    // 3.2: zoom/pan on the x-axis only, clamped to the data extent (no panning
    // into the void; min 10 visible bars per the Python range_controller port).
    // BOTH callback variants hooked: onZoom/onPan fire on API-triggered changes
    // (zoomScale/pan calls — tests, chart-type switch); onZoomComplete/
    // onPanComplete fire after real user gestures (wheel/drag/pinch). The
    // gesture variants fire INSIDE the update cycle, so syncXRange defers.
    const zoomOptions = (extent: { min: number; max: number }) => ({
      zoom: {
        wheel: { enabled: true, speed: 0.1 },
        pinch: { enabled: true },
        mode: 'x' as const,
        onZoom: ({ chart }: any) => this.syncXRange(chart),
        onZoomComplete: ({ chart }: any) => this.syncXRange(chart),
      },
      pan: {
        enabled: true,
        mode: 'x' as const,
        onPan: ({ chart }: any) => this.syncXRange(chart),
        onPanComplete: ({ chart }: any) => this.syncXRange(chart),
      },
      limits: {
        x: {
          min: extent.min,
          max: extent.max,
          minRange: this.minVisibleRange(extent),
        },
      },
    });

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
          tooltip: { enabled: true, mode: 'index', intersect: false, callbacks: priceTooltipCallbacks },
          zoom: zoomOptions(fullExtent),
          crosshair: true, // enables the crosshair plugin (3.3)
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
          tooltip: { enabled: true, mode: 'index', intersect: false, callbacks: volumeTooltipCallbacks },
          zoom: zoomOptions(fullExtent),
          crosshair: true, // enables the crosshair plugin (3.3)
        },
        scales: {
          x: { ...xScale, display: false }, // single x-axis labels on the price pane
          y: { type: 'linear', position: 'right' as const, beginAtZero: true, grid: { drawOnChartArea: false } },
        },
      } as any,
    });
    // Dev-only test handle: expose the chart instances for the Playwright
    // verification scripts (window.Chart is module-scoped in this app).
    // ngDevMode is stripped in production builds — no production pollution.
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      (window as any).__charts = { price: this.priceChart, volume: this.volumeChart };
    }
  }

  /** Minimum visible x-range: ~10 bars (Python range_controller port) — prevents
   *  zooming in past ~10 candles so the chart stays readable. */
  private minVisibleRange(extent: { min: number; max: number }): number {
    // 10 bars' width; the caller passes the padded extent — derive bar width
    // from the raw extent stored on the component.
    return this.currentBarWidth || (extent.max - extent.min) / 10;
  }

  /** Bar width in ms (raw data extent / count) — set at chart creation. */
  private currentBarWidth = 0;

  /** 3.2: apply the price pane's current x-range to the volume pane so pan/zoom
   *  stays synchronized across panes. DEFERRED via queueMicrotask: the zoom
   *  plugin fires onZoomComplete/onPanComplete INSIDE the source chart's update
   *  cycle — mutating the other chart's options and updating it re-entrantly
   *  mid-cycle throws inside Chart.js option resolution (name.startsWith crash,
   *  caught live). Deferring runs the sync after the cycle completes. */
  private syncXRange(sourceChart: Chart): void {
    queueMicrotask(() => {
      const target = sourceChart === this.priceChart ? this.volumeChart : this.priceChart;
      if (!target || target === sourceChart) return;
      const scale = sourceChart.scales['x'] as any;
      if (scale?.min == null || scale?.max == null) return;
      (target.options.scales as any).x = {
        ...(target.options.scales as any).x,
        min: scale.min,
        max: scale.max,
      };
      try {
        target.update('none'); // no animation — instant sync
      } catch (e) {
        console.error('syncXRange update threw:', (e as Error).message?.slice(0, 120));
      }
    });
  }

  /** Reset-zoom button (3.2): restores the full data extent on BOTH panes. */
  resetZoom(): void {
    try {
      this.priceChart?.resetZoom();
      console.log('resetZoom: price done');
      this.volumeChart?.resetZoom();
      console.log('resetZoom: volume done');
    } catch (e) {
      console.error('resetZoom THREW:', (e as Error).message?.slice(0, 120));
    }
    const price = this.priceChart as any;
    const vol = this.volumeChart as any;
    if (price?.options?.scales?.x) price.update('none');
    if (vol?.options?.scales?.x) vol.update('none');
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }
}
