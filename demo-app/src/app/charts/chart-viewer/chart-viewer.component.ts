import { Component, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject, DestroyRef, signal, computed } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';
import { ChartDataService, AVAILABLE_SYMBOLS } from '../../core/services/chart-data.service';
import { ChartStateService } from '../../core/services/chart-state.service';
import { filterByRange, aggregateWeeklyWFri } from '../../core/services/data-aggregation';
import { ActivatedRoute, Router } from '@angular/router';
import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartToolbarComponent } from '../chart-toolbar/chart-toolbar.component';
import { IndicatorPanel } from '../indicator-panel/indicator-panel';
import { ChartLegendComponent, LegendGroup, LegendRow } from '../chart-legend/chart-legend.component';
import { IndicatorCalculationService } from '../../core/services/indicator-calculation.service';
import { ResolvedIndicator, resolveEntry } from '../../core/indicators/indicator-catalog';
import { OutputSpec } from '../../core/indicators/indicator-definitions';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { cssVar, resolveColor } from '../chart-theme';
import { LodPoint, bucketWindow, chooseBucket, fitRange, loadWindow } from '../chart-lod';
// 2.2 (task file): chart-setup MUST be imported before chartjs-chart-financial
// anywhere — it registers registerables + adapter + zoom + the financial
// controllers/elements (side-effect import alone is unreliable: ESM/CJS
// dual-package hazard, verified empirically 2026-09-24).
import '../chart-setup';
import 'chartjs-chart-financial';

/**
 * Crosshair (3.3): a dashed vertical line through the WHOLE panel (price,
 * volume and indicator panes are ONE chart now, so a single line spans them
 * all). Snaps to the hovered bar via the tooltip's active element.
 */
const crosshairPlugin = {
  id: 'crosshair',
  afterEvent(chart: any, args: any): void {
    const e = args.event;
    if (e?.type === 'mousemove' && typeof e.x === 'number') chart.$crosshairX = e.x;
    else if (e?.type === 'mouseout') chart.$crosshairX = null;
  },
  afterDatasetsDraw(chart: any): void {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    const x = active.length ? active[0].element?.x : chart.$crosshairX;
    const { ctx, chartArea } = chart;
    if (typeof x !== 'number' || !isFinite(x) || !ctx || !chartArea) return;
    if (x < chartArea.left || x > chartArea.right) return;
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar('--c-crosshair');
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};
Chart.register(crosshairPlugin);

/**
 * Pane decoration: a thin separator above every stacked pane except the first.
 * The panes share ONE canvas, x-axis and grid, so they read as a single panel.
 * Pane labels/values are the HTML legend's job (chart-legend component, 10.2).
 */
const paneDecorPlugin = {
  id: 'paneDecor',
  afterDraw(chart: any): void {
    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;
    const border = cssVar('--c-pane-border');
    const ids = Object.keys(chart.scales).filter((k) => k.startsWith('y'));
    ctx.save();
    ids.forEach((id, idx) => {
      const scale = chart.scales[id];
      if (idx > 0) {
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = border;
        ctx.moveTo(chartArea.left, Math.round(scale.top) + 0.5);
        ctx.lineTo(chartArea.right, Math.round(scale.top) + 0.5);
        ctx.stroke();
      }
    });
    ctx.restore();
  },
};
Chart.register(paneDecorPlugin);

/** Compact volume formatting (Kevin): 1,000,000 → 1M, 100,000 → 100K,
 *  1,000,000,000 → 1B, 1,500 → 1.5K, 1,000 → 1K (no trailing .0). */
function compactVolume(v: number): string {
  const abs = Math.abs(v);
  const trim = (s: string) => s.replace(/\.0$/, '');
  if (abs >= 1e9) return trim((v / 1e9).toFixed(1)) + 'B';
  if (abs >= 1e6) return trim((v / 1e6).toFixed(1)) + 'M';
  if (abs >= 1e3) return trim((v / 1e3).toFixed(1)) + 'K';
  return String(v);
}

/** One index-mode tooltip for the whole panel: O/H/L/C, Vol and every indicator
 *  value at the hovered bar (TradingView-style readouts). */
const tooltipLabel = (item: any): string => {
  const ds = item?.dataset ?? {};
  const raw = item?.raw ?? {};
  if (ds.type === 'candlestick') {
    const fmt = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? '-'));
    return `O ${fmt(raw.o)}  H ${fmt(raw.h)}  L ${fmt(raw.l)}  C ${fmt(raw.c)}`;
  }
  if (ds.type === 'bar') {
    return `Vol ${typeof raw.y === 'number' ? compactVolume(raw.y) : String(raw.y ?? '-')}`;
  }
  return `${ds.label} ${typeof raw.y === 'number' ? raw.y.toFixed(2) : '-'}`;
};

const Y_WIDTH = 72; // fixed y-axis width: every pane's axis is the same size
const PRICE_WEIGHT = 6;
const VOLUME_WEIGHT = 1.5;
const PANE_WEIGHT = 2;
const DASHES: Record<OutputSpec['defaultLineStyle'], number[]> = {
  solid: [], dash: [6, 4], dot: [2, 3], dash_dot: [6, 3, 2, 3],
};

type Computed = { index: number; resolved: ResolvedIndicator; outputs: Record<string, (number | null)[]> };

/** What the legend needs to show an indicator's value at any bar. */
interface LegendSeries { index: number; label: string; color: string; hidden: boolean; values: (number | null)[]; pane: boolean; }

/** Builds the data array of one dataset from the current LOD points. */
type DataBuilder = (pts: LodPoint[]) => any[];

/**
 * Chart viewer: price candles, volume and indicator panes in ONE Chart.js
 * instance with vertically STACKED y-scales (`stack` + `stackWeight`), so they
 * share a single canvas, x-axis, grid, zoom state and crosshair — one panel.
 *
 * Performance: the chart only ever holds a window of the data around the
 * visible range, aggregated to <= ~500 points (see chart-lod.ts); the window
 * and the y-axis fits are recomputed (rAF-throttled) as the user pans/zooms.
 */
@Component({
  selector: 'app-chart-viewer',
  standalone: true,
  imports: [CommonModule, ChartToolbarComponent, IndicatorPanel, ChartLegendComponent],
  template: `
    <div class="chart-page">
      <header class="chart-header">
        <app-chart-toolbar />
        <app-indicator-panel />
        <button type="button" class="reset-zoom-btn" (click)="resetZoom()">Reset zoom</button>
      </header>

      <div class="chart-panel" data-pane="panel">
        <canvas #chartCanvas [attr.hidden]="error ? '' : null"></canvas>
        @if (!error) {
          <app-chart-legend [groups]="legendGroups()" (toggle)="toggleIndicator($event)" (remove)="removeIndicator($event)" />
        }
        @if (loading) {
          <div class="loading-overlay skeleton" role="status" aria-live="polite">
            <span class="skeleton-label">Loading chart...</span>
          </div>
        }
        @if (error && !loading) {
          <div class="error-message">
            <div class="error-card" role="alert">
              <h2>{{ errorTitle }}</h2>
              <p>{{ error }}</p>
              @if (errorKind === 'unknown-symbol') {
                <p class="hint">Available symbols:</p>
                <div class="symbol-list">
                  @for (s of availableSymbols; track s) {
                    <button type="button" class="symbol-btn" [attr.data-symbol]="s" (click)="pickSymbol(s)">{{ s }}</button>
                  }
                </div>
              }
              <button type="button" class="retry-btn" data-retry (click)="retry()">Retry</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      /* Fill whatever the shell gives us — the page itself never scrolls. */
      :host {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
      }
      .chart-page {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        min-height: 0;
      }
      .chart-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.25rem 0.75rem;
        padding: 0.25rem 0.5rem;
        background: var(--c-surface);
        border-bottom: 1px solid var(--c-pane-border);
      }
      .chart-panel {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        overflow: hidden;
        background: var(--c-chart-bg);
      }
      canvas {
        position: absolute;
        inset: 0;
        display: block;
      }
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--c-surface);
        z-index: 5;
      }
      canvas[hidden] { display: none; }
      /* CSS-only shimmer skeleton: pane-shaped placeholder while loading */
      .skeleton {
        background: linear-gradient(
          100deg,
          var(--c-surface) 30%,
          var(--c-grid) 50%,
          var(--c-surface) 70%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      .skeleton-label { color: var(--c-text-muted); font-size: 0.875rem; }
      @keyframes shimmer { to { background-position: -200% 0; } }
      .error-message {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 6;
      }
      .error-card {
        max-width: 32rem;
        padding: 1.25rem 1.5rem;
        text-align: center;
        border: 1px solid var(--c-pane-border);
        border-radius: var(--border-radius);
        background: var(--c-surface);
        color: var(--c-text);
      }
      .error-card h2 { margin: 0 0 0.5rem; font-size: 1.125rem; color: var(--auth-error-color); }
      .error-card p { margin: 0.25rem 0; }
      .hint { color: var(--c-text-muted); font-size: 0.8125rem; }
      .symbol-list { display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center; margin: 0.5rem 0 0.75rem; }
      .symbol-btn, .retry-btn {
        padding: 0.25rem 0.75rem;
        border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm);
        background: var(--c-surface);
        color: var(--c-text);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .retry-btn { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .symbol-btn:hover { border-color: var(--c-primary); color: var(--c-primary); }
      .reset-zoom-btn {
        margin-left: auto;
        padding: 0.25rem 0.625rem;
        border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm);
        background: var(--c-surface);
        color: var(--c-text);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .reset-zoom-btn:hover {
        border-color: var(--c-primary);
        color: var(--c-primary);
      }
    `,
  ],
})
export class ChartViewerComponent implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas?: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  loading = true;
  error: string | null = null;
  errorTitle = '';
  errorKind: 'unknown-symbol' | 'no-data' | 'failed' | null = null;
  readonly availableSymbols = [...AVAILABLE_SYMBOLS];
  /** The symbol/interval of the last load attempt (Retry re-runs it). */
  private lastLoad = { symbol: 'msft', interval: '1d' };
  currentSymbol: string = '';
  currentInterval: string = '1d';
  currentRange: string = '6m';

  private chartDataService: ChartDataService;
  private route: ActivatedRoute;
  private router: Router;
  // ZONELESS app: async callbacks don't trigger change detection — markForCheck()
  // after state updates makes the @if(loading)/@if(error) blocks re-render.
  private cdr: ChangeDetectorRef;
  private chartState: ChartStateService;
  private indicatorCalc = inject(IndicatorCalculationService);
  private destroyRef = inject(DestroyRef);

  /** All bars fetched for the current symbol (one fetch per symbol, 4.3). */
  private allData: OHLCV[] = [];
  /** Bars the chart indexes into (weekly-aggregated when interval = 1w). */
  private bars: OHLCV[] = [];
  // ---- legend (10.2) ----------------------------------------------------------
  /** Bar under the crosshair (null = show the latest bar). */
  readonly hoverIndex = signal<number | null>(null);
  private readonly paneTops = signal<Record<string, number>>({});
  private readonly legendSource = signal<{ series: LegendSeries[]; paneKeys: number } | null>(null);
  readonly legendGroups = computed<LegendGroup[]>(() => this.buildLegend());

  setHoverIndex(i: number | null): void {
    if (this.hoverIndex() !== i) this.hoverIndex.set(i);
  }
  toggleIndicator(index: number): void { this.chartState.toggleHidden(index); }
  removeIndicator(index: number): void { this.chartState.removeIndicator(index); }

  private feedHover(chart: Chart, e: any): void {
    if (!e) return;
    if (e.type === 'mouseout') return this.setHoverIndex(null);
    if (e.type !== 'mousemove' || typeof e.x !== 'number') return;
    const a = chart.chartArea;
    if (!a || e.x < a.left || e.x > a.right || e.y < a.top || e.y > a.bottom) return this.setHoverIndex(null);
    const v = (chart.scales['x'] as any)?.getValueForPixel(e.x);
    if (typeof v !== 'number' || !this.bars.length) return;
    this.setHoverIndex(Math.min(this.bars.length - 1, Math.max(0, Math.round(v))));
  }

  private feedPaneTops(chart: Chart): void {
    const tops: Record<string, number> = {};
    for (const id of Object.keys(chart.scales)) if (id.startsWith('y')) tops[id] = Math.round((chart.scales[id] as any).top);
    const cur = this.paneTops();
    const same = Object.keys(tops).length === Object.keys(cur).length && Object.keys(tops).every((k) => cur[k] === tops[k]);
    if (!same) this.paneTops.set(tops);
  }

  private buildLegend(): LegendGroup[] {
    const src = this.legendSource();
    const bars = this.bars;
    if (!src || !bars.length) return [];
    const tops = this.paneTops();
    const i = this.hoverIndex() ?? bars.length - 1;
    const bar = bars[Math.min(Math.max(0, i), bars.length - 1)];
    const prev = i > 0 ? bars[i - 1] : null;
    const f2 = (v: number) => v.toFixed(2);
    const diff = prev ? bar.close - prev.close : 0;
    const ohlc = {
      o: f2(bar.open), h: f2(bar.high), l: f2(bar.low), c: f2(bar.close),
      change: prev ? `${diff >= 0 ? '+' : ''}${f2(diff)} (${diff >= 0 ? '+' : ''}${f2((diff / prev.close) * 100)}%)` : '',
      up: bar.close >= bar.open,
    };
    const row = (s: LegendSeries): LegendRow => {
      const v = s.values[Math.min(Math.max(0, i), s.values.length - 1)];
      return { key: `ind${s.index}`, label: s.label, value: typeof v === 'number' ? f2(v) : '–', color: s.color, hidden: s.hidden, index: s.index };
    };
    const groups: LegendGroup[] = [
      {
        key: 'price', top: tops['y'] ?? 0,
        header: { symbol: this.currentSymbol.toUpperCase(), interval: this.currentInterval.toUpperCase(), ohlc },
        rows: src.series.filter((s) => !s.pane).map(row),
      },
      { key: 'volume', top: tops['yVol'] ?? 0, rows: [{ key: 'vol', label: 'Volume', value: compactVolume(bar.volume), color: '', hidden: false }] },
    ];
    src.series.filter((s) => s.pane).forEach((s, k) => {
      groups.push({ key: `yInd${k}`, top: tops[`yInd${k}`] ?? 0, rows: [row(s)] });
    });
    return groups;
  }

  /** Per-dataset data builders + the window currently loaded into the chart. */
  private builders: DataBuilder[] = [];
  private loaded: { from: number; to: number; bucket: number } | null = null;

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
    // Symbol/interval changes refetch/reaggregate; range/indicator changes
    // re-render from the cached data (4.3: one fetch per symbol).
    this.chartState.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((s) => {
        const symbolChanged = s.symbol !== this.currentSymbol;
        const intervalChanged = s.interval !== this.currentInterval;
        const rangeChanged = s.range !== this.currentRange;
        this.currentSymbol = s.symbol;
        this.currentInterval = s.interval;
        this.currentRange = s.range;
        // Keep the URL in sync (2.3): refresh/deep-link preserves the symbol.
        if (symbolChanged) {
          this.router.navigate(['/charts', s.symbol], { replaceUrl: true });
        }
        if (symbolChanged) {
          this.loadChartData(s.symbol, s.interval);
        } else if (this.allData.length) {
          // The file holds daily bars; weekly is aggregated client-side, so an
          // interval/range/indicator change re-renders from cache (no refetch).
          // Only indicator-only changes keep the user's current pan/zoom view.
          const reframe = rangeChanged || intervalChanged;
          this.createChart(this.allData, reframe ? undefined : this.currentView());
        }
      });
  }

  // Public since 2.2: specs drive reloads through it.
  loadChartData(symbol: string, interval: string): void {
    this.loading = true;
    this.clearError();
    this.lastLoad = { symbol, interval };
    // 4.3 PAN FIX: fetch the FULL file; the range preset only FRAMES the view.
    this.chartDataService
      .getOHLCV(symbol, interval, 100000)
      .pipe(finalize(() => { this.loading = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: (data) => {
          this.allData = data;
          if (data && data.length > 0) {
            this.createChart(data);
          } else {
            // ChartDataService maps 404s to [] (2.1 contract), so tell "not one of
            // ours" from "ours but empty" by the symbol list.
            const known = (AVAILABLE_SYMBOLS as readonly string[]).includes(symbol.toLowerCase().replace(/\.us$/, ''));
            this.showError(
              known ? 'no-data' : 'unknown-symbol',
              known ? 'No data' : `Unknown symbol ${symbol.toUpperCase()}`,
              known ? `No data available for ${symbol.toUpperCase()}.` : `There is no demo data for ${symbol.toUpperCase()}.`,
            );
          }
        },
        error: (err) => {
          console.error('Failed to load chart data:', err);
          this.showError('failed', 'Could not load chart', 'Failed to load chart data');
        },
      });
  }

  /** Error card actions. */
  retry(): void {
    this.loadChartData(this.lastLoad.symbol, this.lastLoad.interval);
  }

  pickSymbol(symbol: string): void {
    this.chartState.setSymbol(symbol);
  }

  private clearError(): void {
    this.error = null;
    this.errorTitle = '';
    this.errorKind = null;
  }

  /** Error state: message + no stale chart behind the card. */
  private showError(kind: 'unknown-symbol' | 'no-data' | 'failed', title: string, message: string): void {
    this.destroyChart();
    this.errorKind = kind;
    this.errorTitle = title;
    this.error = message;
  }

  private formatBarDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
  }

  /** The chart's current x view (bar-index units), if a chart exists. */
  private currentView(): { min: number; max: number } | undefined {
    const x = this.chart?.scales?.['x'] as any;
    return x && typeof x.min === 'number' && typeof x.max === 'number' ? { min: x.min, max: x.max } : undefined;
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.builders = [];
    this.loaded = null;
  }

  /** Resolve + calculate every state indicator; bad entries are skipped, not fatal. */
  private computeIndicators(bars: OHLCV[]): { overlays: Computed[]; panes: Computed[] } {
    const overlays: Computed[] = [];
    const panes: Computed[] = [];
    this.chartState.snapshot().indicators.forEach((entry, index) => {
      try {
        const resolved = resolveEntry(entry);
        const outputs = this.indicatorCalc.calculate(resolved.definitionId, resolved.params, bars);
        (resolved.kind === 'overlay' ? overlays : panes).push({ index, resolved, outputs });
      } catch (e) {
        console.warn('indicator skipped:', entry, (e as Error).message);
      }
    });
    return { overlays, panes };
  }

  /** Max points on screen: ~1 per 4px of canvas, clamped. */
  private maxPoints(): number {
    const w = this.chartCanvas?.nativeElement?.clientWidth || 1200;
    return Math.min(500, Math.max(120, Math.floor(w / 4)));
  }

  private lineDataset(label: string, yAxisID: string, color: string, width: number, dash: number[], hidden = false) {
    return {
      type: 'line' as const, label, yAxisID, data: [] as any[], hidden,
      borderColor: color, backgroundColor: color, borderWidth: width, borderDash: dash,
      pointRadius: 0, pointHoverRadius: 3, tension: 0, spanGaps: false,
      parsing: false, normalized: true,
    };
  }

  /** Value of a per-bar series sampled at the LAST bar of each bucket. */
  private lineBuilder(values: (number | null)[]): DataBuilder {
    return (pts) => pts.map((p) => {
      const v = values[Math.min(p.i + p.n - 1, values.length - 1)];
      return { x: p.x, y: typeof v === 'number' ? v : null };
    });
  }

  private createChart(data: OHLCV[], preserveView?: { min: number; max: number }): void {
    // Belt-and-braces guard: never crash on a missing canvas reference.
    const el = this.chartCanvas?.nativeElement;
    if (!el) {
      console.warn('createChart: canvas not ready; skipping chart creation');
      return;
    }
    this.destroyChart();

    // The range preset only FRAMES the view (4.3); all bars stay reachable by pan/zoom.
    const rangeSlice = filterByRange(data, this.currentRange as any, this.currentInterval);
    if (!rangeSlice.length) {
      this.showError('no-data', 'No data', 'No data in range');
      return;
    }
    // Weekly aggregation applies to the whole file so pan-left shows weekly bars.
    const bars = this.currentInterval === '1w' ? aggregateWeeklyWFri(data) : data;
    this.bars = bars;

    // X = bar INDEX on a LINEAR scale (root-caused in 4.3: category scales break
    // under the zoom plugin's numeric min/max; indices also drop weekend gaps).
    const dateForIndex = (i: number) => {
      const b = bars[Math.min(Math.max(0, Math.round(i)), bars.length - 1)];
      return b ? this.formatBarDate(b.timestamp) : '';
    };

    // View = the preset window as an index range (MATCH BY TIMESTAMP: the weekly
    // path re-aggregates into new bar objects, so reference lookups fail).
    const sliceStartTs = rangeSlice[0].timestamp;
    const sliceEndTs = rangeSlice[rangeSlice.length - 1].timestamp;
    let sliceStart = bars.findIndex((b) => b.timestamp >= sliceStartTs);
    if (sliceStart < 0) sliceStart = 0;
    let sliceEnd = sliceStart;
    for (let i = sliceStart; i < bars.length; i++) {
      if (bars[i].timestamp <= sliceEndTs) sliceEnd = i; else break;
    }
    const viewMin = preserveView ? preserveView.min : Math.max(0, sliceStart - 1);
    const viewMax = preserveView ? preserveView.max : Math.min(bars.length - 1, sliceEnd + 1);
    const fullMax = bars.length - 1;

    const { overlays, panes } = this.computeIndicators(bars);

    // ---- datasets + their data builders (order = builders order) -------------
    const up = cssVar('--c-up');
    const down = cssVar('--c-down');
    const datasets: any[] = [];
    this.builders = [];
    const add = (ds: any, b: DataBuilder) => { datasets.push(ds); this.builders.push(b); };

    add({
      type: 'candlestick', label: 'Price', yAxisID: 'y', data: [],
      // token colours (the plugin's defaults are hardcoded rgba)
      color: { up, down, unchanged: cssVar('--c-text-muted') },
      borderColor: { up, down, unchanged: cssVar('--c-text-muted') },
    },
      (pts) => pts.map((p) => ({ x: p.x, o: p.o, h: p.h, l: p.l, c: p.c, t: p.t })));
    const legendSeries: LegendSeries[] = [];
    overlays.forEach(({ index, resolved, outputs }, i) => {
      const color = cssVar(`--c-indicator-${(i % 4) + 1}`);
      const first = Object.values(outputs)[0];
      if (first) {
        add(this.lineDataset(resolved.label, 'y', color, 1.5, [], resolved.hidden), this.lineBuilder(first));
        legendSeries.push({ index, label: resolved.label, color, hidden: resolved.hidden, values: first, pane: false });
      }
    });
    add({
      type: 'bar', label: 'Volume', yAxisID: 'yVol', data: [], parsing: false, normalized: true,
      barPercentage: 1, categoryPercentage: 0.9,
      backgroundColor: (ctx: any) => (ctx.raw?.up ? up : down),
    }, (pts) => pts.map((p) => ({ x: p.x, y: p.v, up: p.up, t: p.t })));

    const paneScales: Record<string, any> = {};
    panes.forEach(({ index, resolved, outputs }, i) => {
      const id = `yInd${i}`;
      const def = this.indicatorCalc.definition(resolved.definitionId);
      let main = true;
      for (const o of def.outputs) {
        if (!outputs[o.key]) continue;
        add(this.lineDataset(o.label, id, resolveColor(o.defaultColor), o.defaultWidth, DASHES[o.defaultLineStyle], resolved.hidden),
          this.lineBuilder(outputs[o.key]));
        if (main) {
          legendSeries.push({ index, label: resolved.label, color: resolveColor(o.defaultColor), hidden: resolved.hidden, values: outputs[o.key], pane: true });
          main = false;
        }
      }
      paneScales[id] = {
        type: 'linear', position: 'right', stack: 'panel', stackWeight: PANE_WEIGHT,
        afterFit: (s: any) => { s.width = Y_WIDTH; },
        grid: { color: cssVar('--c-grid') },
        ticks: { includeBounds: false },
        paneLabel: resolved.label,
        ...(def.defaultYRange
          ? {
              min: def.defaultYRange[0], max: def.defaultYRange[1], fixedRange: true,
              // fixed-range panes (RSI 0-100): label 20/50/80 — bound labels would
              // collide with the neighbouring pane's axis at the boundary
              afterBuildTicks: (scale: any) => {
                const r = scale.max - scale.min;
                scale.ticks = [0.2, 0.5, 0.8].map((f) => ({ value: scale.min + r * f }));
              },
            }
          : {}),
      };
    });

    // ---- scales: one x, stacked y's ------------------------------------------
    const grid = { color: cssVar('--c-grid') };
    const scales: Record<string, any> = {
      x: {
        type: 'linear', position: 'bottom', min: viewMin, max: viewMax, grid,
        ticks: {
          maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
          // First arg is the VALUE = the bar index on this linear scale
          // (the 2nd arg is the tick index — mapping it showed 1986 dates, 4.3).
          callback: (value: any) => dateForIndex(Number(value)),
        },
      },
      y: {
        type: 'linear', position: 'right', stack: 'panel', stackWeight: PRICE_WEIGHT,
        afterFit: (s: any) => { s.width = Y_WIDTH; }, grid,
        ticks: { includeBounds: false },
        paneLabel: `${this.currentSymbol.toUpperCase()} · ${this.currentInterval.toUpperCase()}`,
      },
      yVol: {
        type: 'linear', position: 'right', stack: 'panel', stackWeight: VOLUME_WEIGHT,
        beginAtZero: true, min: 0, afterFit: (s: any) => { s.width = Y_WIDTH; }, grid,
        ticks: { maxTicksLimit: 3, includeBounds: false, callback: (v: any) => compactVolume(Number(v)) },
        paneLabel: 'Volume',
      },
      ...paneScales,
    };

    this.chart = new Chart(el, {
      type: 'candlestick',
      data: { datasets } as any,
      plugins: [{
        id: 'lodWindow',
        beforeUpdate: (c: Chart) => this.syncView(c),
        // y-fit must run once the scales exist but before they're laid out
        // (beforeUpdate is too early: the resolved scale options are stale then)
        beforeLayout: (c: Chart) => this.fitYAxes(c),
      }, {
        // legend feed (10.2): hovered bar index + each pane's top edge
        id: 'legendFeed',
        afterEvent: (c: Chart, args: any) => this.feedHover(c, args?.event),
        afterLayout: (c: Chart) => this.feedPaneTops(c),
      }],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false, // animations are the main source of jank on pan/zoom
        color: cssVar('--c-text-muted'), // axis labels
        interaction: { mode: 'index', axis: 'x', intersect: false },
        plugins: {
          legend: { display: false }, // TradingView hides the legend; 10.2 adds rows
          tooltip: {
            enabled: true, mode: 'index', axis: 'x', intersect: false,
            backgroundColor: cssVar('--c-tooltip-bg'),
            titleColor: cssVar('--c-tooltip-text'),
            bodyColor: cssVar('--c-tooltip-text'),
            // guide lines (overbought/stretched/...) are noise in the readout
            filter: (item: any) => !(item.dataset?.borderDash?.length),
            callbacks: {
              title: (items: any[]) => dateForIndex(Number(items?.[0]?.parsed?.x ?? 0)),
              label: tooltipLabel,
            },
          },
          // 3.2: wheel/pinch/drag on x only, clamped to the data extent (min ~10 bars).
          zoom: {
            zoom: {
              wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x',
            },
            pan: {
              enabled: true, mode: 'x',
            },
            limits: { x: { min: 0, max: fullMax, minRange: 10 } },
          },
          crosshair: true,
        },
        scales,
      } as any,
    });

    this.legendSource.set({ series: legendSeries, paneKeys: panes.length });
    this.hoverIndex.set(null);
    // Dev-only test handle for the Playwright verification scripts.
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      (window as any).__charts = { chart: this.chart };
    }
  }

  /**
   * Runs from the chart's own `beforeUpdate` hook, i.e. INSIDE every update
   * cycle (initial render, zoom/pan, resize): (re)load the data window for the
   * requested x-range when needed and refit the y-axes to the VISIBLE bars.
   * Doing it here — instead of a second update afterwards — means one render
   * per frame while panning. The window is only rebuilt when the bucket size
   * changes or the view leaves the loaded window; a pure pan inside it only
   * refits the y-axes.
   */
  private syncView(chart: Chart): void {
    // NB: no `chart === this.chart` check — the very first update runs inside the
    // Chart constructor, before `this.chart` is assigned.
    if (!this.bars.length || !this.builders.length) return;
    const xo = (chart.options.scales as any)['x'];
    const min = typeof xo?.min === 'number' ? xo.min : 0;
    const max = typeof xo?.max === 'number' ? xo.max : this.bars.length - 1;
    const bucket = chooseBucket(max - min, this.maxPoints());
    const L = this.loaded;
    const outside = !L || L.bucket !== bucket || (min < L.from && L.from > 0) || (max > L.to && L.to < this.bars.length - 1);
    if (outside) {
      const w = loadWindow(min, max, this.bars.length);
      const pts = bucketWindow(this.bars, w.from, w.to, bucket);
      chart.data.datasets.forEach((ds: any, i: number) => { ds.data = this.builders[i](pts); });
      this.loaded = { from: w.from, to: w.to, bucket };
    }
  }

  /** Fit every y-scale to the data inside the x-range (fixed-range panes keep theirs). */
  private fitYAxes(chart: any): void {
    if (!this.builders.length) return;
    const xo = chart.options.scales.x;
    const min = typeof xo?.min === 'number' ? xo.min : 0;
    const max = typeof xo?.max === 'number' ? xo.max : this.bars.length - 1;
    const bucket = this.loaded?.bucket ?? 1;
    const lo = min - bucket;
    const hi = max + bucket;
    const ext: Record<string, { min: number; max: number }> = {};
    for (const ds of chart.data.datasets) {
      const id = ds.yAxisID as string;
      const e = (ext[id] ??= { min: Infinity, max: -Infinity });
      for (const p of ds.data) {
        if (p.x < lo || p.x > hi) continue;
        if (ds.type === 'candlestick') {
          if (p.l < e.min) e.min = p.l;
          if (p.h > e.max) e.max = p.h;
        } else if (typeof p.y === 'number') {
          if (p.y < e.min) e.min = p.y;
          if (p.y > e.max) e.max = p.y;
        }
      }
    }
    for (const [id, e] of Object.entries(ext)) {
      const cfg = chart.options.scales[id];
      if (!cfg || cfg.fixedRange || !isFinite(e.min) || !isFinite(e.max)) continue;
      const r = id === 'yVol' ? { min: 0, max: e.max > 0 ? e.max * 1.1 : 1 } : fitRange(e.min, e.max, 0.06);
      // write the config (persists across updates) AND the live scale: Chart.js
      // caches the user bounds at init (_userMin/_userMax), before our hook runs,
      // so without this the fit would apply one update late.
      cfg.min = r.min;
      cfg.max = r.max;
      const live = chart.scales[id];
      if (live) {
        live.options.min = r.min;
        live.options.max = r.max;
        live._userMin = r.min;
        live._userMax = r.max;
      }
    }
  }

  /** Reset-zoom button (3.2): back to the preset's framing. */
  resetZoom(): void {
    try {
      this.chart?.resetZoom();
    } catch (e) {
      console.error('resetZoom THREW:', (e as Error).message?.slice(0, 120));
    }
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }
}
