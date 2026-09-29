import { Component, HostListener, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject, DestroyRef, signal, computed } from '@angular/core';
import { Chart } from 'chart.js';
import { CommonModule } from '@angular/common';
import { ChartDataService, AVAILABLE_SYMBOLS } from '../../core/services/chart-data.service';
import { ChartStateService, ChartType } from '../../core/services/chart-state.service';
import { CHART_TYPE_GROUPS, NON_TIME_TYPES } from '../../core/models/chart-type';
import { boxSizeFor, transformBars } from '../chart-types/bar-transforms';
import { DataBuilder, baselineFor, buildPriceSeries, lineDataset } from '../chart-types/price-series';
import { filterByRange, aggregateWeeklyWFri } from '../../core/services/data-aggregation';
import { ActivatedRoute, Router } from '@angular/router';
import { OHLCV } from '../../core/models/ohlcv.model';
import { ChartToolbarComponent } from '../chart-toolbar/chart-toolbar.component';
import { SymbolSearchDialogComponent } from '../dialogs/symbol-search-dialog.component';
import { IndicatorsDialogComponent } from '../dialogs/indicators-dialog.component';
import { IndicatorSettingsDialogComponent } from '../dialogs/indicator-settings-dialog.component';
import { ChartLegendComponent, LegendGroup, LegendRow } from '../chart-legend/chart-legend.component';
import { IndicatorCalculationService } from '../../core/services/indicator-calculation.service';
import { IndicatorEntry, ResolvedIndicator, catalogItem, resolveEntry } from '../../core/indicators/indicator-catalog';
import { OutputSpec } from '../../core/indicators/indicator-definitions';
import { finalize } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { cssVar, resolveColor } from '../chart-theme';
import { DrawingController, Tool, ZoomRegion } from '../drawings/drawing-controller';
import { DrawingStore } from '../drawings/drawing-store.service';
import { Range, fitRangeLog, panRange, scaleRange } from '../y-scale-math';
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
    if (e?.type === 'mousemove' && typeof e.x === 'number') {
      chart.$crosshairX = e.x;
      chart.$crosshairY = e.y;
    } else if (e?.type === 'mouseout') {
      chart.$crosshairX = null;
      chart.$crosshairY = null;
    }
  },
  afterDatasetsDraw(chart: any): void {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    const x = active.length ? active[0].element?.x : chart.$crosshairX;
    const { ctx, chartArea } = chart;
    if (typeof x !== 'number' || !isFinite(x) || !ctx || !chartArea) return;
    if (x < chartArea.left || x > chartArea.right) return;

    // Horizontal line: at the mouse y, or (magnet) snapped to the hovered bar's close.
    let y: number | null = typeof chart.$crosshairY === 'number' ? chart.$crosshairY : null;
    if (chart.$magnet && active.length && chart.scales?.y) {
      const raw = chart.data?.datasets?.[0]?.data?.[active[0].index];
      const v = typeof raw?.c === 'number' ? raw.c : raw?.y;
      if (typeof v === 'number') y = chart.scales.y.getPixelForValue(v);
    }

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar('--c-crosshair');
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    if (y !== null && y >= chartArea.top && y <= chartArea.bottom) {
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
    }
    ctx.stroke();
    ctx.restore();

    // Price label on the y axis of the pane under the crosshair (TradingView style).
    if (y !== null && y >= chartArea.top && y <= chartArea.bottom) {
      const id = Object.keys(chart.scales).find((k) => k.startsWith('y') && y! >= chart.scales[k].top && y! <= chart.scales[k].bottom);
      const scale = id ? chart.scales[id] : null;
      if (scale) {
        const v = scale.getValueForPixel(y);
        const text = id === 'yVol' ? compactVolume(v) : v.toFixed(2);
        ctx.save();
        ctx.font = '11px sans-serif';
        ctx.textBaseline = 'middle';
        const w = 62;
        ctx.fillStyle = cssVar('--c-tooltip-bg');
        ctx.fillRect(chartArea.right, y - 9, w, 18);
        ctx.fillStyle = cssVar('--c-tooltip-text');
        ctx.fillText(text, chartArea.right + 6, y);
        ctx.restore();
      }
    }
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

import '../drawings/drawings-plugin'; // registers the drawing renderer


/**
 * Point & Figure glyphs: the price dataset carries the column envelopes
 * (o/h/l/c on the box grid) invisibly; this paints one X (rising column) or
 * O (falling column) per box, clipped to the price pane.
 */
const pnfGlyphsPlugin = {
  id: 'pnfGlyphs',
  afterDatasetsDraw(chart: any): void {
    const ds = chart.data?.datasets?.[0];
    const { ctx } = chart;
    const xs = chart.scales?.x;
    const ys = chart.scales?.y;
    if (!ds?.pnf || !ctx || !xs || !ys || !(ds.box > 0) || !ds.data?.length) return;
    const box: number = ds.box;
    const dx = ds.data.length > 1 ? Math.max(1, ds.data[1].x - ds.data[0].x) : 1;
    ctx.save();
    ctx.beginPath();
    ctx.rect(chart.chartArea.left, ys.top, chart.chartArea.right - chart.chartArea.left, ys.bottom - ys.top);
    ctx.clip();
    ctx.lineWidth = 1.5;
    const up = cssVar('--c-up');
    const down = cssVar('--c-down');
    for (const p of ds.data) {
      if (p.x < xs.min - dx || p.x > xs.max + dx) continue;
      const rising = p.c > p.o;
      const cx = xs.getPixelForValue(p.x);
      const colW = Math.abs(xs.getPixelForValue(p.x + dx) - cx);
      const first = Math.round(p.l / box);
      const last = Math.round(p.h / box) - 1;
      ctx.strokeStyle = rising ? up : down;
      for (let lvl = first; lvl <= last; lvl++) {
        const y1 = ys.getPixelForValue(lvl * box);
        const y2 = ys.getPixelForValue((lvl + 1) * box);
        const cy = (y1 + y2) / 2;
        const r = Math.max(1.5, (Math.min(colW * 0.8, Math.abs(y1 - y2)) / 2) * 0.8);
        ctx.beginPath();
        if (rising) {
          ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
          ctx.moveTo(cx - r, cy + r); ctx.lineTo(cx + r, cy - r);
        } else {
          ctx.ellipse(cx, cy, r, r, 0, 0, Math.PI * 2);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
Chart.register(pnfGlyphsPlugin);

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
  if (ds.type === 'candlestick' || ds.type === 'ohlc' || ds.type === 'tvbar') {
    const fmt = (v: unknown) => (typeof v === 'number' ? v.toFixed(2) : String(v ?? '-'));
    return `O ${fmt(raw.o)}  H ${fmt(raw.h)}  L ${fmt(raw.l)}  C ${fmt(raw.c)}`;
  }
  if (ds.type === 'bar' && ds.label === 'Price') {
    return `Close ${typeof raw.y === 'number' ? raw.y.toFixed(2) : '-'}`;
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
  imports: [CommonModule, ChartToolbarComponent, ChartLegendComponent, IndicatorsDialogComponent, IndicatorSettingsDialogComponent, SymbolSearchDialogComponent],
  template: `
    <div class="chart-page">
      <header class="chart-header">
        <app-chart-toolbar />
        <button type="button" class="tool-btn indicators-btn" data-indicators title="Indicators" (click)="indicatorsOpen.set(true)">ƒx Indicators</button>
        <div class="chart-tools" role="group" aria-label="Chart tools">
          <select name="chartType" aria-label="Chart type" (change)="setChartType($any($event.target).value)">
            @for (g of typeGroups; track g.label) {
              <optgroup [label]="g.label">
                @for (t of g.types; track t.id) {
                  <option [value]="t.id" [selected]="t.id === chartTypeValue">{{ t.label }}</option>
                }
              </optgroup>
            }
          </select>
          <button type="button" class="tool-btn" data-screenshot title="Save chart as PNG" aria-label="Save chart as PNG" (click)="screenshot()">Snapshot</button>
          <button type="button" class="tool-btn" data-fullscreen title="Toggle fullscreen" aria-label="Toggle fullscreen" (click)="toggleFullscreen()">Fullscreen</button>
          <button type="button" class="reset-zoom-btn" (click)="resetZoom()">Reset zoom</button>
        </div>
      </header>

      @if (indicatorsOpen()) {
        <app-indicators-dialog (add)="addIndicatorType($event)" (closed)="indicatorsOpen.set(false)" />
      }
      @if (searchOpen()) {
        <app-symbol-search-dialog [initial]="searchInitial()" [current]="currentSymbol" (pick)="pickFromSearch($event)" (closed)="searchOpen.set(false)" />
      }
      @if (settingsFor(); as sf) {
        <app-indicator-settings-dialog [entry]="sf.entry" (save)="saveSettings(sf.index, $event)" (closed)="settingsIndex.set(null)" />
      }

      <div class="chart-panel" data-pane="panel">
        <canvas #chartCanvas [attr.hidden]="error ? '' : null" [class.drawing]="tool() !== 'cursor'" (dblclick)="onDblClick($event)"
          (mousedown)="pointer('down', $event)" (mousemove)="pointer('move', $event)" (mouseup)="pointer('up', $event)"></canvas>
        <div class="scale-btns" role="group" aria-label="Price scale">
          <button type="button" data-auto [attr.aria-pressed]="autoScale()" title="Auto-fit the price scale to the visible bars (drag the chart vertically to switch it off)" (click)="setAuto()">auto</button>
          <button type="button" data-log [attr.aria-pressed]="logOn" title="Logarithmic price scale (volume too)" (click)="toggleLog()">log</button>
        </div>
        <div class="draw-tools" role="group" aria-label="Drawing tools">
          @for (t of drawTools; track t.id) {
            <button type="button" class="draw-btn" [attr.data-tool]="t.id" [attr.aria-pressed]="tool() === t.id"
              [attr.aria-label]="t.title" [title]="t.title" (click)="setTool(t.id)">{{ t.icon }}</button>
          }
          <span class="draw-sep" aria-hidden="true"></span>
          <button type="button" class="draw-btn" data-magnet [attr.aria-pressed]="magnetOn" aria-label="Magnet: snap the crosshair and new drawings to the bar's OHLC"
            title="Magnet: snap the crosshair and new drawings to the bar's OHLC" (click)="toggleMagnet()">🧲</button>
          <button type="button" class="draw-btn" data-keep [attr.aria-pressed]="keepDrawing()" aria-label="Stay in drawing mode"
            title="Stay in drawing mode after each drawing" (click)="keepDrawing.set(!keepDrawing())">⟳</button>
          <button type="button" class="draw-btn" data-lock [attr.aria-pressed]="drawingStore.locked()" aria-label="Lock all drawings"
            title="Lock all drawings (no selecting, moving or deleting)" (click)="drawingStore.toggleLocked()">🔒</button>
          <button type="button" class="draw-btn" data-hide [attr.aria-pressed]="drawingStore.hidden()" aria-label="Hide all drawings"
            title="Hide all drawings" (click)="drawingStore.toggleHidden(); redraw()">👁</button>
          <button type="button" class="draw-btn" data-tool-clear aria-label="Delete all drawings on this symbol"
            title="Delete all drawings on this symbol" (click)="clearDrawings()">⌫</button>
        </div>
        @if (selectedDrawing(); as sd) {
          <div class="draw-style" data-draw-style role="group" aria-label="Drawing style">
            <input type="color" data-draw-color aria-label="Colour" [value]="styleColor(sd)" (input)="setDrawStyle(sd.id, { color: $any($event.target).value })" />
            <select data-draw-width aria-label="Line width" (change)="setDrawStyle(sd.id, { width: +$any($event.target).value })">
              @for (w of widths; track w) { <option [value]="w" [selected]="(sd.style?.width ?? 1) === w">{{ w }}px</option> }
            </select>
            <select data-draw-dash aria-label="Line style" (change)="setDrawStyle(sd.id, { dash: $any($event.target).value })">
              @for (d of dashes; track d) { <option [value]="d" [selected]="(sd.style?.dash ?? 'solid') === d">{{ d }}</option> }
            </select>
            <button type="button" data-draw-delete aria-label="Delete drawing" title="Delete drawing" [disabled]="drawingStore.locked()" (click)="deleteSelected()">🗑</button>
          </div>
        }
        @if (editingText(); as et) {
          <input class="text-edit" data-text-edit aria-label="Label text" [style.left.px]="et.x" [style.top.px]="et.y" [value]="et.value"
            (input)="et.value = $any($event.target).value" (keydown)="textKey($event, et)" (blur)="commitText(et)" />
        }
        @if (!error) {
          <app-chart-legend [groups]="legendGroups()" (toggle)="toggleIndicator($event)" (remove)="removeIndicator($event)" (settings)="openSettings($event)" (symbolClick)="openSearch('')" />
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
      canvas.drawing { cursor: crosshair; }
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
      .scale-btns { position: absolute; right: 4px; bottom: 3px; z-index: 4; display: flex; gap: 2px; }
      .scale-btns button {
        padding: 1px 6px; border: none; border-radius: var(--border-radius-sm); background: transparent;
        color: var(--c-text-muted); cursor: pointer; font-size: 0.75rem;
      }
      .scale-btns button:hover { color: var(--c-text); }
      .scale-btns button[aria-pressed='true'] { color: var(--c-primary); font-weight: 600; }
      .draw-tools {
        position: absolute; left: 4px; top: 50%; transform: translateY(-50%); z-index: 4;
        display: flex; flex-direction: column; gap: 2px; padding: 2px;
        background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius);
      }
      .draw-btn {
        width: 28px; height: 28px; padding: 0; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; font-size: 1rem; line-height: 1;
      }
      .draw-sep { height: 1px; margin: 2px 4px; background: var(--c-border); }
      .draw-style {
        position: absolute; left: 50%; top: 4px; transform: translateX(-50%); z-index: 5; display: flex; gap: 4px; align-items: center;
        padding: 3px 6px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius);
      }
      .draw-style input[type='color'] { width: 26px; height: 22px; padding: 0; border: none; background: none; cursor: pointer; }
      .draw-style select, .draw-style button { font-size: 0.75rem; padding: 1px 4px; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); }
      .text-edit { position: absolute; z-index: 6; width: 160px; padding: 2px 4px; font-size: 0.8rem; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-primary); border-radius: var(--border-radius-sm); }
      .draw-btn:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .draw-btn[aria-pressed='true'] { background: var(--c-primary); color: var(--c-on-primary); }
      .chart-tools { display: flex; align-items: center; gap: 0.375rem; margin-left: auto; }
      .chart-tools select, .tool-btn {
        padding: 0.25rem 0.5rem;
        border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm);
        background: var(--c-surface);
        color: var(--c-text);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .tool-btn:hover, .chart-tools select:hover { border-color: var(--c-primary); color: var(--c-primary); }
      .tool-btn[aria-pressed='true'] { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .reset-zoom-btn {
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
  // ---- symbol search (type anywhere) ------------------------------------------------
  readonly searchOpen = signal(false);
  readonly searchInitial = signal('');
  openSearch(initial: string): void { this.searchInitial.set(initial); this.searchOpen.set(true); }
  pickFromSearch(symbol: string): void {
    this.searchOpen.set(false);
    this.chartState.setSymbol(symbol);
  }

  // ---- indicator dialogs -----------------------------------------------------------
  readonly indicatorsOpen = signal(false);
  readonly settingsIndex = signal<number | null>(null);
  readonly settingsFor = computed(() => {
    const i = this.settingsIndex();
    const entry = i === null ? undefined : this.stateIndicators()[i];
    return entry ? { index: i as number, entry } : null;
  });
  /** signal mirror of the persisted indicator list (state$ is an Observable) */
  private readonly stateIndicators = signal<IndicatorEntry[]>([]);

  addIndicatorType(type: string): void {
    const item = catalogItem(type);
    if (item) this.chartState.addIndicator({ type: item.type, period: item.defaultPeriod });
  }
  openSettings(index: number): void { this.indicatorsOpen.set(false); this.settingsIndex.set(index); }
  saveSettings(index: number, patch: Partial<IndicatorEntry>): void { this.chartState.updateIndicator(index, patch); }

  // ---- drawings (10.3) ---------------------------------------------------------------
  readonly drawingStore = inject(DrawingStore);
  readonly tool = signal<Tool>('cursor');
  readonly keepDrawing = signal(false);
  readonly selectedId = signal<string | null>(null);
  readonly editingText = signal<{ id: string; x: number; y: number; value: string } | null>(null);
  readonly widths = [1, 2, 3, 4];
  readonly dashes = ['solid', 'dash', 'dot'];
  readonly selectedDrawing = computed(() => {
    this.drawingStore.revision();
    const id = this.selectedId();
    if (!id || this.drawingStore.hidden()) return null;
    return this.drawingStore.list(this.currentSymbol).find((d) => d.id === id) ?? null;
  });
  readonly drawTools: { id: Tool; icon: string; title: string }[] = [
    { id: 'cursor', icon: '↖', title: 'Cursor: select / move drawings, pan the chart' },
    { id: 'trend', icon: '⟋', title: 'Trend line: drag from point A to B' },
    { id: 'arrow', icon: '➚', title: 'Arrow: drag from point A to B' },
    { id: 'ray', icon: '⟶', title: 'Ray: click a bar; extends to the right' },
    { id: 'hline', icon: '―', title: 'Horizontal line: click a price level' },
    { id: 'vline', icon: '¦', title: 'Vertical line: click a bar' },
    { id: 'channel', icon: '⫽', title: 'Parallel channel: drag the base line, then click the offset' },
    { id: 'rect', icon: '▭', title: 'Rectangle: drag a corner to the opposite corner' },
    { id: 'ellipse', icon: '◯', title: 'Ellipse: drag its bounding box' },
    { id: 'fib', icon: 'Fib', title: 'Fib retracement: drag from the low to the high' },
    { id: 'brush', icon: '✎', title: 'Brush: draw freehand' },
    { id: 'text', icon: 'T', title: 'Text label: click, then type' },
    { id: 'measure', icon: '⇔', title: 'Measure: drag to read price change, bars and time' },
    { id: 'zoom', icon: '⌕', title: 'Zoom: drag a region to zoom into it' },
  ];
  private drawings = new DrawingController({
    chart: () => this.chart,
    bars: () => this.bars,
    store: this.drawingStore,
    symbol: () => this.currentSymbol,
    tool: () => this.tool(),
    changed: () => { this.selectedId.set(this.drawings.view().selectedId); this.chart?.draw(); },
    magnet: () => this.magnetOn,
    zoomTo: (r) => this.zoomToRegion(r),
    editText: (id) => this.openTextEditor(id),
    committed: () => { if (!this.keepDrawing()) { this.tool.set('cursor'); this.drawings.syncPan(); } },
  });

  setTool(t: Tool): void {
    this.tool.set(t);
    this.drawings.cancel();
    this.selectedId.set(null);
    this.editingText.set(null);
    if (t !== 'cursor' && this.drawingStore.hidden()) this.drawingStore.setHidden(false);
    this.drawings.syncPan();
    this.chart?.draw();
  }

  redraw(): void { this.chart?.draw(); }
  styleColor(d: { style?: { color?: string } }): string {
    const c = resolveColor(d.style?.color ?? 'var(--c-primary)');
    return /^#[0-9a-f]{6}$/i.test(c) ? c : cssVar('--c-text');
  }
  setDrawStyle(id: string, patch: { color?: string; width?: number; dash?: string }): void {
    this.drawings.setStyle(id, patch as any);
  }
  deleteSelected(): void { this.drawings.key('Delete'); }

  private openTextEditor(id: string): void {
    const d = this.drawingStore.list(this.currentSymbol).find((x) => x.id === id);
    const p = d && this.drawings.pixel(d.a);
    if (!d || !p) return;
    this.editingText.set({ id, x: p.x, y: p.y - 10, value: d.text ?? '' });
    setTimeout(() => this.chartCanvas?.nativeElement.parentElement?.querySelector<HTMLInputElement>('[data-text-edit]')?.focus());
  }
  textKey(e: KeyboardEvent, et: { id: string; value: string }): void {
    e.stopPropagation();
    if (e.key === 'Enter') this.commitText(et);
    else if (e.key === 'Escape') { this.editingText.set(null); this.drawings.setText(et.id, this.textOf(et.id)); }
  }
  commitText(et: { id: string; value: string }): void {
    if (this.editingText()?.id !== et.id) return;
    this.editingText.set(null);
    this.drawings.setText(et.id, et.value);
  }
  private textOf(id: string): string { return this.drawingStore.list(this.currentSymbol).find((d) => d.id === id)?.text ?? ''; }

  /** Zoom tool: x to the region's bars, y to its price range (manual scale, auto off). */
  zoomToRegion(r: ZoomRegion): void {
    this.tool.set('cursor');
    this.drawings.syncPan();
    const c = this.chart as any;
    if (!c) return;
    const pad = Math.max(1, (r.x1 - r.x0) * 0.02);
    try { c.zoomScale?.('x', { min: r.x0 - pad, max: r.x1 + pad }, 'none'); } catch { /* keep going */ }
    this.manualY = { min: r.p0, max: r.p1 };
    this.autoScale.set(false);
    c.update('none');
  }

  clearDrawings(): void {
    this.drawingStore.clear(this.currentSymbol);
    this.drawings.cancel();
  }

  pointer(kind: 'down' | 'move' | 'up', e: MouseEvent): void {
    if (this.tool() === 'cursor' && kind === 'move' && !e.buttons) return; // hover: nothing to do
    if (kind === 'down' && this.tool() === 'cursor' && e.button === 0) this.yDrag = this.classifyYDrag(e.offsetX, e.offsetY);
    if (this.yDragEvent(kind, e.offsetY)) return; // price-axis scaling
    if (kind === 'down') this.drawings.pointerDown(e.offsetX, e.offsetY);
    else if (kind === 'move') this.drawings.pointerMove(e.offsetX, e.offsetY);
    else this.drawings.pointerUp(e.offsetX, e.offsetY);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement | null;
    if (t && (/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) || t.isContentEditable)) return;
    // TradingView: start typing anywhere on the chart -> symbol search opens with that character
    const dialogOpen = this.searchOpen() || this.indicatorsOpen() || this.settingsIndex() !== null;
    if (!dialogOpen && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-z0-9]$/i.test(e.key)) {
      e.preventDefault();
      this.openSearch(e.key);
      return;
    }
    if (e.key === 'Escape') { this.tool.set('cursor'); this.drawings.syncPan(); this.editingText.set(null); }
    this.drawings.key(e.key);
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(e: MouseEvent): void {
    this.yDrag = null;
    // finish a drag that ended outside the canvas
    if (e.target !== this.chartCanvas?.nativeElement) {
      const r = this.chartCanvas?.nativeElement.getBoundingClientRect();
      if (r) this.drawings.pointerUp(e.clientX - r.left, e.clientY - r.top);
    }
  }

  // ---- price scale: auto / manual / log (11.4) -------------------------------------
  /** Auto-fit the price pane to the visible bars; off once the user pans/scales it vertically. */
  readonly autoScale = signal(true);
  logOn = false;
  private manualY: Range | null = null;
  private yDrag: { mode: 'axis' | 'pan'; startY: number; lastY: number; engaged: boolean } | null = null;

  setAuto(): void {
    this.manualY = null;
    this.autoScale.set(true);
    this.chart?.update('none');
  }
  toggleLog(): void { this.chartState.toggleLogScale(); }

  private resetPriceScale(): void {
    this.manualY = null;
    this.autoScale.set(true);
  }

  private enterManual(): void {
    const y = this.chart?.scales?.['y'] as any;
    if (!y || !this.autoScale()) return;
    this.manualY = { min: y.min, max: y.max };
    this.autoScale.set(false);
  }

  private applyManual(next: Range): void {
    this.manualY = next;
    this.chart?.update('none');
  }

  private classifyYDrag(x: number, y: number): typeof this.yDrag {
    const c = this.chart as any;
    const ys = c?.scales?.y;
    if (!c || !ys || !c.chartArea) return null;
    const inPane = y >= ys.top && y <= ys.bottom;
    if (inPane && x > c.chartArea.right) return { mode: 'axis', startY: y, lastY: y, engaged: false };
    if (inPane && x >= c.chartArea.left && x <= c.chartArea.right) return { mode: 'pan', startY: y, lastY: y, engaged: false };
    return null;
  }

  /** Returns true when the event was consumed by the price-scale interaction. */
  private yDragEvent(kind: 'down' | 'move' | 'up', y: number): boolean {
    const d = this.yDrag;
    const ys = (this.chart as any)?.scales?.y;
    if (!d || !ys) return false;
    if (kind === 'up') { this.yDrag = null; return d.mode === 'axis' && d.engaged; }
    if (kind !== 'move') return false;
    const dy = y - d.lastY;
    d.lastY = y;
    if (d.mode === 'axis') {
      d.engaged = true;
      this.enterManual();
      const cur = this.manualY ?? { min: ys.min, max: ys.max };
      this.applyManual(scaleRange(cur, dy, this.logOn));
      return true;
    }
    // pan: a drag that started on a drawing belongs to the drawing
    if (this.drawings.isDragging()) { this.yDrag = null; return false; }
    if (!d.engaged && Math.abs(y - d.startY) < 8) return false; // ignore jitter of a horizontal drag
    if (!d.engaged) { d.engaged = true; this.enterManual(); }
    const cur = this.manualY ?? { min: ys.min, max: ys.max };
    this.applyManual(panRange(cur, dy, ys.bottom - ys.top, this.logOn));
    return false;
  }

  onDblClick(e: MouseEvent): void {
    const tid = this.drawings.textAt(e.offsetX, e.offsetY);
    if (tid) { this.openTextEditor(tid); return; }
    const c = this.chart as any;
    if (c?.chartArea && e.offsetX > c.chartArea.right) this.setAuto(); // double-click the price axis: back to auto
    else this.resetZoom();
  }

  // ---- tools (10.5) --------------------------------------------------------------
  readonly typeGroups = CHART_TYPE_GROUPS;
  chartTypeValue: ChartType = 'candles';
  magnetOn = false;

  setChartType(t: string): void { this.chartState.setChartType(t as ChartType); }
  toggleMagnet(): void { this.chartState.toggleMagnet(); }

  /** Downloads the chart canvas as `<symbol>-<interval>.png`. */
  screenshot(): void {
    if (!this.chart) return;
    const a = document.createElement('a');
    a.download = `${this.currentSymbol}-${this.currentInterval}.png`;
    a.href = this.chart.toBase64Image('image/png', 1);
    a.click();
  }

  toggleFullscreen(): void {
    const doc = document as any;
    const root = document.documentElement as any;
    if (doc.fullscreenElement) doc.exitFullscreen?.();
    else root.requestFullscreen?.();
  }

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
      o: f2(bar.open), h: f2(bar.high), l: f2(bar.low), c: f2(bar.close), v: compactVolume(bar.volume),
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
    ];
    src.series.filter((s) => s.pane).forEach((s, k) => {
      groups.push({ key: `yInd${k}`, top: tops[`yInd${k}`] ?? 0, rows: [row(s)] });
    });
    return groups;
  }

  /** Per-dataset data builders + the window currently loaded into the chart. */
  private builders: DataBuilder[] = [];
  private lastKey = '';
  private keyOf(s: { magnet: boolean } & object): string { const { magnet, ...rest } = s as any; return JSON.stringify(rest); }
  private sameExceptMagnet(s: { magnet: boolean } & object): boolean { return this.keyOf(s) === this.lastKey; }
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
        const logChanged = s.logScale !== this.logOn;
        this.logOn = s.logScale;
        if (symbolChanged || intervalChanged || rangeChanged || logChanged) this.resetPriceScale();
        const typeChanged = s.chartType !== this.chartTypeValue;
        const bricksInvolved = typeChanged && (NON_TIME_TYPES.includes(s.chartType) || NON_TIME_TYPES.includes(this.chartTypeValue));
        if (bricksInvolved) this.resetPriceScale();
        this.chartTypeValue = s.chartType;
        this.stateIndicators.set(s.indicators);
        const magnetOnly = s.magnet !== this.magnetOn && this.sameExceptMagnet(s);
        this.magnetOn = s.magnet;
        this.lastKey = this.keyOf(s);
        if (this.chart) (this.chart as any).$magnet = s.magnet;
        if (magnetOnly) { this.cdr.markForCheck(); return; }
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
          const reframe = rangeChanged || intervalChanged || bricksInvolved;
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

  private lineDataset = lineDataset;

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
    const ctype: ChartType = this.chartState.snapshot().chartType;
    const sourceBars = this.currentInterval === '1w' ? aggregateWeeklyWFri(data) : data;
    // Heikin Ashi / Renko / Kagi / P&F / Range / Line break replace the bars with synthetic ones
    const bars = transformBars(sourceBars, ctype);
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

    for (const entry of buildPriceSeries(ctype, {
      up, down, muted: cssVar('--c-text-muted'), upFill: cssVar('--c-up-fill'), downFill: cssVar('--c-down-fill'),
      line: cssVar('--c-price-line'), area: cssVar('--c-price-area'),
      baseline: baselineFor(rangeSlice), box: boxSizeFor(sourceBars),
    })) add(entry.dataset, entry.builder);
    const legendSeries: LegendSeries[] = [];
    const interval = this.currentInterval;
    overlays.forEach(({ index, resolved, outputs }, i) => {
      const key = Object.keys(outputs)[0];
      const values = key ? outputs[key] : undefined;
      if (!values) return;
      const st = resolved.styles[key] ?? {};
      const color = st.color ?? cssVar(`--c-indicator-${(i % 4) + 1}`);
      const hidden = resolved.hidden || !resolved.visibleOn(interval) || st.visible === false;
      // a moving average OF VOLUME belongs on the volume scale
      const axis = resolved.params['source'] === 'volume' ? 'yVol' : 'y';
      add(this.lineDataset(resolved.label, axis, color, st.width ?? 1.5, st.dash ? DASHES[st.dash] : [], hidden), this.lineBuilder(values));
      legendSeries.push({ index, label: resolved.label, color, hidden: resolved.hidden || !resolved.visibleOn(interval), values, pane: false });
    });
    add({
      type: 'bar', label: 'Volume', yAxisID: 'yVol', data: [], parsing: false, normalized: true,
      barPercentage: 1, categoryPercentage: 0.9,
      backgroundColor: (ctx: any) => (ctx.raw?.up ? up : down),
    }, (pts) => pts.map((p) => ({ x: p.x, y: this.logOn && !(p.v > 0) ? null : p.v, up: p.up, t: p.t })));

    const paneScales: Record<string, any> = {};
    panes.forEach(({ index, resolved, outputs }, i) => {
      const id = `yInd${i}`;
      const def = this.indicatorCalc.definition(resolved.definitionId);
      let main = true;
      const rowHidden = resolved.hidden || !resolved.visibleOn(interval);
      for (const o of def.outputs) {
        if (!outputs[o.key]) continue;
        const st = resolved.styles[o.key] ?? {};
        const color = st.color ?? resolveColor(o.defaultColor);
        add(this.lineDataset(o.label, id, color, st.width ?? o.defaultWidth, DASHES[st.dash ?? o.defaultLineStyle], rowHidden || st.visible === false),
          this.lineBuilder(outputs[o.key]));
        if (main) {
          legendSeries.push({ index, label: resolved.label, color, hidden: rowHidden, values: outputs[o.key], pane: true });
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
        type: this.logOn ? 'logarithmic' : 'linear', position: 'right', stack: 'panel', stackWeight: PRICE_WEIGHT,
        afterFit: (s: any) => { s.width = Y_WIDTH; }, grid,
        ticks: { includeBounds: false },
        paneLabel: `${this.currentSymbol.toUpperCase()} · ${this.currentInterval.toUpperCase()}`,
      },
      yVol: {
        type: this.logOn ? 'logarithmic' : 'linear', position: 'right', stack: 'panel', stackWeight: VOLUME_WEIGHT,
        ...(this.logOn ? {} : { beginAtZero: true, min: 0 }), afterFit: (s: any) => { s.width = Y_WIDTH; }, grid,
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

    (this.chart as any).$magnet = this.chartState.snapshot().magnet;
    (this.chart as any).$drawings = this.drawings;
    this.drawings.syncPan();
    this.chart.draw(); // the constructor's first render ran before the controller was attached
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
    const isLog = (id: string) => chart.options.scales[id]?.type === 'logarithmic';
    for (const ds of chart.data.datasets) {
      const id = ds.yAxisID as string;
      const log = isLog(id);
      const e = (ext[id] ??= { min: Infinity, max: -Infinity });
      for (const p of ds.data) {
        if (p.x < lo || p.x > hi) continue;
        if (ds.type === 'candlestick' || ds.type === 'ohlc' || ds.type === 'tvbar') {
          if (log && !(p.l > 0)) continue;
          if (p.l < e.min) e.min = p.l;
          if (p.h > e.max) e.max = p.h;
        } else if (typeof p.y === 'number') {
          if (log && !(p.y > 0)) continue;
          if (p.y < e.min) e.min = p.y;
          if (p.y > e.max) e.max = p.y;
        }
      }
    }
    for (const [id, e] of Object.entries(ext)) {
      const cfg = chart.options.scales[id];
      if (!cfg || cfg.fixedRange) continue;
      let r: Range;
      if (id === 'y' && !this.autoScale() && this.manualY) {
        r = this.manualY; // user-scaled price pane: keep their range while panning in x
      } else {
        if (!isFinite(e.min) || !isFinite(e.max)) continue;
        if (id === 'yVol') r = isLog(id) ? fitRangeLog(e.min * 0.6, e.max * 1.2, 0) : { min: 0, max: e.max > 0 ? e.max * 1.1 : 1 };
        else r = isLog(id) ? fitRangeLog(e.min, e.max, 0.06) : fitRange(e.min, e.max, 0.06);
      }
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
