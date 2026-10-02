import { Component, HostListener, OnDestroy, OnInit, ViewChild, ElementRef, ChangeDetectorRef, inject, DestroyRef, signal, computed, effect } from '@angular/core';
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
import { ChartStatusComponent } from '../chart-status/chart-status.component';
import { IconComponent } from '../../shared/icons/icon.component';
import { ReplayBarComponent, ReplayState } from '../replay/replay-bar.component';
import { ChartToastsComponent, Toast } from '../replay/chart-toasts.component';
import { ChartSidePanelComponent, PanelTab } from '../side-panel/chart-side-panel.component';
import { WatchlistService } from '../../core/services/watchlist.service';
import { AlertService } from '../../core/services/alert.service';
import { toolDef } from '../drawings/drawing-tools';
import { LayoutsDialogComponent } from '../dialogs/layouts-dialog.component';
import { LayoutService } from '../../core/services/layout.service';
import { GotoDateDialogComponent } from '../dialogs/goto-date-dialog.component';
import { barCountdown, formatClock } from '../market-time';
import { paneBoundaryAt, resizeWeights } from '../pane-resize';
import { ChartSettingsDialogComponent } from '../dialogs/chart-settings-dialog.component';
import '../last-price';
import { SymbolSettingsDialogComponent } from '../dialogs/symbol-settings-dialog.component';
import { PriceSettings, VolumeSettings } from '../../core/models/symbol-settings';
import { DrawingSidebarComponent } from '../drawings/drawing-sidebar.component';
import { DrawingStore } from '../drawings/drawing-store.service';
import { isSelectTool as isSelectToolFn } from '../drawings/drawing-tools';
import { indexForTime, timeForIndex } from '../drawings/drawing-geometry';
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
      if (chart.$cursorStyle === 'demo') { const tr = (chart.$trail ??= []); tr.push({ x: e.x, y: e.y }); if (tr.length > 14) tr.shift(); }
      chart.$crosshairX = e.x;
      chart.$crosshairY = e.y;
    } else if (e?.type === 'mouseout') {
      chart.$trail = [];
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

    if (chart.$cursorStyle === 'demo') { // laser pointer: a glowing red dot with a short fading trail
      const tr: { x: number; y: number }[] = chart.$trail ?? [];
      ctx.save();
      tr.forEach((p, i) => { ctx.globalAlpha = ((i + 1) / tr.length) * 0.5; ctx.fillStyle = cssVar('--c-down'); ctx.beginPath(); ctx.arc(p.x, p.y, 2 + (i / tr.length) * 6, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      return;
    }
    if (chart.$cursorStyle === 'pointer' || chart.$crosshairOn === false) return; // plain arrow / crosshair switched off
    const dot = chart.$cursorStyle === 'dot';
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = cssVar('--c-crosshair');
    if (dot) {
      if (y !== null) { ctx.setLineDash([]); ctx.fillStyle = cssVar('--c-crosshair'); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      if (y !== null && y >= chartArea.top && y <= chartArea.bottom) {
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Price label on the y axis of the pane under the crosshair (TradingView style).
    if (y !== null && y >= chartArea.top && y <= chartArea.bottom) {
      const id = Object.keys(chart.scales).find((k) => k.startsWith('y') && y! >= chart.scales[k].top && y! <= chart.scales[k].bottom);
      const scale = id ? chart.scales[id] : null;
      if (scale) {
        const v = scale.getValueForPixel(y);
        const base = id === 'y' && chart.$percentOn && typeof chart.$percentBase === 'function' ? chart.$percentBase() : null;
        const text = id === 'yVol' ? compactVolume(v) : base ? `${((v / base - 1) * 100).toFixed(2)}%` : v.toFixed(2);
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

/** A compared symbol's closes aligned to our bars (last close at or before each bar), scaled so it equals the price at `base`. */
export function alignCompare(bars: OHLCV[], other: OHLCV[], base: number): (number | null)[] {
  const raw: (number | null)[] = [];
  let j = -1;
  for (const b of bars) {
    while (j + 1 < other.length && other[j + 1].timestamp <= b.timestamp) j++;
    raw.push(j >= 0 ? other[j].close : null);
  }
  let k = base;
  while (k < raw.length && raw[k] === null) k++;
  const c0 = raw[k];
  if (c0 === null || c0 === undefined || !c0 || k >= bars.length) return raw.map(() => null);
  const p0 = bars[k].close;
  return raw.map((v) => (v === null ? null : (v / c0) * p0));
}

const ALT_TOOLS: Record<string, Tool> = { KeyT: 'trend', KeyH: 'hline', KeyV: 'vline', KeyC: 'cross', KeyF: 'fib' };

type Computed = { index: number; resolved: ResolvedIndicator; outputs: Record<string, (number | null)[]> };

/** What the legend needs to show an indicator's value at any bar. */
interface LegendSeries { index: number; label: string; color: string; hidden: boolean; values: (number | null)[]; pane: boolean; compare?: string; }

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
  imports: [CommonModule, ChartToolbarComponent, ChartLegendComponent, IndicatorsDialogComponent, IndicatorSettingsDialogComponent, SymbolSearchDialogComponent, SymbolSettingsDialogComponent, ChartSettingsDialogComponent, GotoDateDialogComponent, LayoutsDialogComponent, ChartStatusComponent, ChartSidePanelComponent, ReplayBarComponent, ChartToastsComponent, IconComponent, DrawingSidebarComponent],
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
          <button type="button" class="tool-btn" data-screenshot title="Save chart as PNG" aria-label="Save chart as PNG" (click)="screenshot()"><app-icon name="camera" [size]="18" /></button>
          <button type="button" class="tool-btn" data-fullscreen title="Toggle fullscreen" aria-label="Toggle fullscreen" (click)="toggleFullscreen()"><app-icon name="fullscreen" [size]="18" /></button>
          <button type="button" class="tool-btn" data-layouts title="Layouts: save / load chart setups" aria-label="Layouts" (click)="layoutsOpen.set(true)"><app-icon name="layouts" [size]="18" />@if (layouts.current()) { <span class="lbl">{{ layouts.current() }}</span> }</button>
          <button type="button" class="tool-btn" data-replay [attr.aria-pressed]="!!replay()" title="Bar replay" aria-label="Bar replay" (click)="toggleReplay()"><app-icon name="replay" [size]="18" /><span class="lbl">Replay</span></button>
          <button type="button" class="tool-btn" data-compare title="Compare or add symbol" aria-label="Compare symbol" (click)="openSearch('', 'compare')"><app-icon name="plus" [size]="18" /><span class="lbl">Compare</span></button>
          <button type="button" class="tool-btn" data-panel [attr.aria-pressed]="panelOpen()" title="Object tree, data window, watchlist, alerts" aria-label="Side panel" (click)="togglePanel()"><app-icon name="panel" [size]="18" /></button>
          <button type="button" class="tool-btn" data-chart-settings title="Chart settings" aria-label="Chart settings" (click)="settingsOpen.set(true)"><app-icon name="gear" [size]="18" /></button>
          <button type="button" class="tool-btn" data-undo title="Undo (Ctrl+Z)" aria-label="Undo" [disabled]="!drawingStore.canUndo(currentSymbol)" (click)="undo()"><app-icon name="undo" [size]="18" /></button>
          <button type="button" class="tool-btn" data-redo title="Redo (Ctrl+Y)" aria-label="Redo" [disabled]="!drawingStore.canRedo(currentSymbol)" (click)="redo()"><app-icon name="redo" [size]="18" /></button>
          <button type="button" class="reset-zoom-btn" title="Reset zoom" aria-label="Reset zoom" (click)="resetZoom()"><app-icon name="reset" [size]="18" /></button>
        </div>
      </header>

      @if (indicatorsOpen()) {
        <app-indicators-dialog [current]="stateIndicators()" (applyTemplate)="applyTemplate($event)" (add)="addIndicatorType($event)" (closed)="indicatorsOpen.set(false)" />
      }
      @if (searchOpen()) {
        <app-symbol-search-dialog [heading]="searchMode() === 'compare' ? 'Compare symbol' : 'Symbol search'" [initial]="searchInitial()" [current]="currentSymbol" (pick)="pickFromSearch($event)" (closed)="searchOpen.set(false)" />
      }
      @if (layoutsOpen()) {
        <app-layouts-dialog (save)="saveLayout($event)" (load)="loadLayout($event)" (remove)="layouts.remove($event)" (closed)="layoutsOpen.set(false)" />
      }
      @if (gotoOpen() && bars.length) {
        <app-goto-date-dialog [min]="bars[0].timestamp" [max]="bars[bars.length - 1].timestamp" (pick)="goToDate($event)" (closed)="gotoOpen.set(false)" />
      }
      @if (settingsOpen()) {
        <app-chart-settings-dialog [view]="chartState.snapshot().view" (save)="chartState.setViewSettings($event)" (closed)="settingsOpen.set(false)" />
      }
      @if (seriesDialog(); as k) {
        <app-symbol-settings-dialog [kind]="k" [settings]="k === 'price' ? chartState.snapshot().price : chartState.snapshot().volume" [lineLike]="lineLike()"
          (save)="saveSeriesSettings(k, $event)" (closed)="seriesDialog.set(null)" />
      }
      @if (settingsFor(); as sf) {
        <app-indicator-settings-dialog [entry]="sf.entry" (save)="saveSettings(sf.index, $event)" (closed)="settingsIndex.set(null)" />
      }

      @if (replay(); as r) {
        <app-replay-bar [state]="r" [max]="replayMax()" [date]="replayDate()" (step)="replayStep($event)" (playToggle)="replayPlay()" (seek)="replaySeek($event)" (speed)="replaySpeed($event)" (exit)="stopReplay()" />
      }
      <div class="chart-body">
      <app-drawing-sidebar [tool]="tool()" [magnet]="magnetOn" [keep]="keepDrawing()"
        [locked]="drawingStore.locked()" [hidden]="drawingStore.hidden()" (pick)="setTool($event)" (magnetToggle)="toggleMagnet()"
        (keepToggle)="keepDrawing.set(!keepDrawing())" (lockToggle)="drawingStore.toggleLocked()"
        (hideToggle)="drawingStore.toggleHidden(); redraw()" (clear)="clearDrawings()" (removeIndicators)="chartState.clearIndicators()"
        (removeAll)="clearDrawings(); chartState.clearIndicators()" (stampPick)="pickStamp($event)" />
      <div class="chart-col">
      <div class="chart-panel" data-pane="panel">
        <canvas #chartCanvas [attr.hidden]="error ? '' : null" [class.drawing]="!isSelectTool(tool())" (dblclick)="onDblClick($event)"
          (contextmenu)="onContextMenu($event)" (mousedown)="pointer('down', $event)" (mousemove)="pointer('move', $event)" (mouseup)="pointer('up', $event)"></canvas>
        @if (selectedDrawing(); as sd) {
          <div class="draw-style" data-draw-style role="group" aria-label="Drawing style">
            <input type="color" data-draw-color aria-label="Colour" [value]="styleColor(sd)" (input)="setDrawStyle(sd.id, { color: $any($event.target).value })" />
            <select data-draw-width aria-label="Line width" (change)="setDrawStyle(sd.id, { width: +$any($event.target).value })">
              @for (w of widths; track w) { <option [value]="w" [selected]="(sd.style?.width ?? 1) === w">{{ w }}px</option> }
            </select>
            <select data-draw-dash aria-label="Line style" (change)="setDrawStyle(sd.id, { dash: $any($event.target).value })">
              @for (d of dashes; track d) { <option [value]="d" [selected]="(sd.style?.dash ?? 'solid') === d">{{ d }}</option> }
            </select>
            <button type="button" data-draw-lock [attr.aria-pressed]="!!sd.locked" aria-label="Lock this drawing" title="Lock this drawing" (click)="setDrawFlag(sd.id, 'locked', !sd.locked)"><app-icon name="lock" [size]="16" /></button>
            <button type="button" data-draw-hide aria-label="Hide this drawing" title="Hide this drawing" (click)="setDrawFlag(sd.id, 'hidden', true)"><app-icon name="eyeoff" [size]="16" /></button>
            <select data-draw-order aria-label="Order" title="Bring to front / send to back" (change)="reorder(sd.id, $any($event.target).value); $any($event.target).value = ''">
              <option value="">Order…</option><option value="front">Bring to front</option><option value="forward">Bring forward</option><option value="backward">Send backward</option><option value="back">Send to back</option>
            </select>
            <button type="button" data-draw-clone aria-label="Clone drawing (Ctrl+D)" title="Clone (Ctrl+D)" [disabled]="drawingStore.locked()" (click)="cloneSelected()"><app-icon name="clone" [size]="16" /></button>
            <button type="button" data-draw-delete aria-label="Delete drawing" title="Delete drawing" [disabled]="drawingStore.locked()" (click)="deleteSelected()"><app-icon name="trash" [size]="16" /></button>
          </div>
        }
        @if (ctxMenu(); as m) {
          <div class="ctx-menu" data-ctx-menu role="menu" [style.left.px]="m.x" [style.top.px]="m.y">
            <button type="button" role="menuitem" data-ctx="reset" (click)="ctxDo('reset')">Reset chart view</button>
            <button type="button" role="menuitem" data-ctx="hline" (click)="ctxDo('hline')">Add horizontal line at {{ m.price.toFixed(2) }}</button>
            <button type="button" role="menuitem" data-ctx="alert" (click)="ctxDo('alert')">Add alert at {{ m.price.toFixed(2) }}</button>
            <button type="button" role="menuitem" data-ctx="clear" (click)="ctxDo('clear')">Remove drawings</button>
            <button type="button" role="menuitem" data-ctx="settings" (click)="ctxDo('settings')">Settings…</button>
          </div>
        }
        @if (editingText(); as et) {
          <input class="text-edit" data-text-edit aria-label="Label text" [style.left.px]="et.x" [style.top.px]="et.y" [value]="et.value"
            (input)="et.value = $any($event.target).value" (keydown)="textKey($event, et)" (blur)="commitText(et)" />
        }
        @if (!error) {
          <app-chart-legend [groups]="legendGroups()" (toggle)="toggleIndicator($event)" (remove)="removeIndicator($event)" (settings)="openSettings($event)" (symbolClick)="openSearch('')" (seriesToggle)="toggleSeries($event)" (seriesSettings)="seriesDialog.set($event)" (compareRemove)="chartState.removeCompare($event)" />
        }
        <app-chart-toasts [toasts]="toasts()" (dismiss)="dismissToast($event)" />
        <app-chart-status [loading]="loading" [error]="error" [title]="errorTitle" [kind]="errorKind" [symbols]="availableSymbols" (pick)="pickSymbol($event)" (retry)="retry()" />
      </div>
      <div class="scale-bar" role="group" aria-label="Price scale">
      <button type="button" class="clock" data-clock title="Chart time (click to change the time zone)" (click)="settingsOpen.set(true)">{{ clockText() }}</button>
      <button type="button" data-goto title="Go to date (Alt+G)" aria-label="Go to date" (click)="gotoOpen.set(true)"><app-icon name="calendar" [size]="16" /></button>
      <button type="button" data-fit title="Fit all data" aria-label="Fit all data" (click)="fitAll()"><app-icon name="fit" [size]="16" /></button>
      <button type="button" data-lock-scale [attr.aria-pressed]="scaleLocked()" title="Lock the price scale (no auto-fit, no vertical drag)" aria-label="Lock price scale" (click)="toggleLockScale()"><app-icon name="lock" [size]="16" /></button>
      <button type="button" data-zoom-out title="Zoom out" aria-label="Zoom out" (click)="zoomBy(1 / 1.25)"><app-icon name="zoomout" [size]="16" /></button>
      <button type="button" data-zoom-in title="Zoom in" aria-label="Zoom in" (click)="zoomBy(1.25)"><app-icon name="zoomin" [size]="16" /></button>
      <button type="button" data-invert [attr.aria-pressed]="invertOn" title="Invert the price scale" (click)="chartState.toggleInvertScale()"><app-icon name="invert" [size]="16" /></button>
      <button type="button" data-percent [attr.aria-pressed]="percentOn" title="Percentage scale: % change from the first visible bar" (click)="chartState.togglePercentScale()"><app-icon name="percent" [size]="16" /></button>
      <button type="button" data-auto [attr.aria-pressed]="autoScale()" title="Auto-fit the price scale to the visible bars (drag the chart vertically to switch it off)" (click)="setAuto()">auto</button>
      <button type="button" data-log [attr.aria-pressed]="logOn" title="Logarithmic price scale (volume too)" (click)="toggleLog()">log</button>
      </div>
      </div>
      @if (panelOpen()) {
        <app-chart-side-panel [tab]="panelTab()" [indicators]="panelIndicators()" [drawings]="panelDrawings()" [selectedId]="selectedId()"
          [data]="panelData()" [watch]="panelWatch()" [current]="currentSymbol" [alerts]="panelAlerts()"
          (tabChange)="setPanelTab($event)" (indicatorToggle)="toggleIndicator($event)" (indicatorRemove)="removeIndicator($event)" (indicatorSettings)="openSettings($event)"
          (drawingSelect)="selectDrawing($event)" (drawingToggleHidden)="toggleDrawingFlag($event, 'hidden')" (drawingToggleLocked)="toggleDrawingFlag($event, 'locked')"
          (drawingRemove)="removeDrawing($event)" (drawingOrder)="reorder($event.id, $event.how)"
          (watchPick)="chartState.setSymbol($event)" (watchAdd)="watchlist.add($event)" (watchRemove)="watchlist.remove($event)"
          (alertAdd)="addAlert($event)" (alertRemove)="alerts.remove($event)" />
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
      .chart-body { display: flex; flex: 1 1 auto; min-height: 0; }
      .chart-col { display: flex; flex: 1 1 0; flex-direction: column; min-width: 0; }
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
      canvas[hidden] { display: none; }
      .scale-bar { display: flex; flex: none; justify-content: flex-end; gap: 2px; padding: 1px 8px; background: var(--c-surface); border-top: 1px solid var(--c-pane-border); }
      .scale-bar .clock { margin-right: auto; font-variant-numeric: tabular-nums; }
      .scale-bar button {
        display: inline-flex; align-items: center;
        padding: 1px 6px; border: none; border-radius: var(--border-radius-sm); background: transparent;
        color: var(--c-text-muted); cursor: pointer; font-size: 0.75rem;
      }
      .scale-bar button:hover { color: var(--c-text); }
      .scale-bar button[aria-pressed='true'] { color: var(--c-primary); font-weight: 600; }
      .ctx-menu { position: absolute; z-index: 8; display: flex; flex-direction: column; min-width: 12rem; padding: 4px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low); }
      .ctx-menu button { padding: 4px 10px; border: none; background: transparent; color: var(--c-text); text-align: left; cursor: pointer; font-size: 0.8125rem; border-radius: var(--border-radius-sm); }
      .ctx-menu button:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .draw-style {
        position: absolute; left: 50%; top: 4px; transform: translateX(-50%); z-index: 5; display: flex; gap: 4px; align-items: center;
        padding: 3px 6px; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius);
      }
      .draw-style input[type='color'] { width: 26px; height: 22px; padding: 0; border: none; background: none; cursor: pointer; }
      .draw-style select, .draw-style button { display: inline-flex; align-items: center; font-size: 0.75rem; padding: 1px 4px; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); }
      .text-edit { position: absolute; z-index: 6; width: 160px; padding: 2px 4px; font-size: 0.8rem; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-primary); border-radius: var(--border-radius-sm); }
      .chart-tools { display: flex; align-items: center; gap: 0.375rem; margin-left: auto; }
      .tool-btn, .reset-zoom-btn { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.2rem 0.4rem; }
      .lbl { font-size: 0.8125rem; }
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
  protected chartState: ChartStateService;
  private indicatorCalc = inject(IndicatorCalculationService);
  private destroyRef = inject(DestroyRef);

  /** All bars fetched for the current symbol (one fetch per symbol, 4.3). */
  private allData: OHLCV[] = [];
  /** Bars the chart indexes into (weekly-aggregated when interval = 1w). */
  protected bars: OHLCV[] = [];
  // ---- symbol search (type anywhere) ------------------------------------------------
  readonly searchOpen = signal(false);
  readonly searchInitial = signal('');
  readonly searchMode = signal<'symbol' | 'compare'>('symbol');
  openSearch(initial: string, mode: 'symbol' | 'compare' = 'symbol'): void { this.searchMode.set(mode); this.searchInitial.set(initial); this.searchOpen.set(true); }
  pickFromSearch(symbol: string): void {
    this.searchOpen.set(false);
    if (this.searchMode() === 'compare') { this.chartState.addCompare(symbol); return; }
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
  protected readonly stateIndicators = signal<IndicatorEntry[]>([]);

  addIndicatorType(type: string): void {
    const item = catalogItem(type);
    if (item) this.chartState.addIndicator({ type: item.type, period: item.defaultPeriod });
  }
  openSettings(index: number): void { this.indicatorsOpen.set(false); this.settingsIndex.set(index); }
  saveSettings(index: number, patch: Partial<IndicatorEntry>): void { this.chartState.updateIndicator(index, patch); }

  // ---- drawings (10.3) ---------------------------------------------------------------
  readonly drawingStore = inject(DrawingStore);
  readonly tool = signal<Tool>('cursor');
  /** The select-type cursor to fall back to after a drawing (cross, dot or arrow). */
  private cursorMode: Tool = 'cursor';
  isSelectTool(t: Tool): boolean { return isSelectToolFn(t); }
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
    stamp: () => this.stampName(),
    committed: () => { if (!this.keepDrawing()) { this.tool.set(this.cursorMode); this.drawings.syncPan(); this.applyCursorStyle(); } },
  });

  private applyCursorStyle(): void {
    const t = this.tool();
    if (this.chart) (this.chart as any).$cursorStyle = t === 'dot' ? 'dot' : t === 'pointer' ? 'pointer' : t === 'demo' ? 'demo' : 'cross';
  }

  setTool(t: Tool): void {
    if (isSelectToolFn(t)) this.cursorMode = t;
    this.tool.set(t);
    this.applyCursorStyle();
    this.drawings.cancel();
    this.selectedId.set(null);
    this.editingText.set(null);
    if (!isSelectToolFn(t) && this.drawingStore.hidden()) this.drawingStore.setHidden(false);
    this.drawings.syncPan();
    this.chart?.draw();
  }

  redraw(): void { this.chart?.draw(); }

  readonly stampName = signal('iconstar');
  pickStamp(n: string): void { this.stampName.set(n); this.setTool('stamp'); }
  setDrawFlag(id: string, flag: 'locked' | 'hidden', on: boolean): void { this.drawings.setFlag(id, flag, on); }
  reorder(id: string, how: string): void {
    if (['front', 'back', 'forward', 'backward'].includes(how)) { this.drawingStore.move(this.currentSymbol, id, how as 'front'); this.chart?.draw(); }
  }

  undo(): void { if (this.drawingStore.undo(this.currentSymbol)) this.afterHistory(); }
  redo(): void { if (this.drawingStore.redo(this.currentSymbol)) this.afterHistory(); }
  private afterHistory(): void { this.drawings.cancel(); this.selectedId.set(null); this.chart?.draw(); }
  cloneSelected(): void { this.drawings.clone(); }
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

  /** Pane sizes the user dragged (scale id -> stack weight), remembered across sessions. */
  private paneWeights: Record<string, number> = ((): Record<string, number> => {
    try {
      const raw = JSON.parse(localStorage.getItem('pane-weights') ?? '{}');
      return Object.fromEntries(Object.entries(raw).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && (v as number) > 0)) as Record<string, number>;
    } catch { return {}; }
  })();
  private paneDrag: { index: number; ids: string[]; lastY: number } | null = null;

  private dragPanes(y: number): void {
    const d = this.paneDrag;
    const c = this.chart as any;
    if (!d || !c?.chartArea) return;
    const ws = d.ids.map((id) => c.options.scales[id]?.stackWeight ?? 1);
    const next = resizeWeights(ws, d.index, y - d.lastY, c.chartArea.bottom - c.chartArea.top);
    d.ids.forEach((id, i) => { if (c.options.scales[id]) { c.options.scales[id].stackWeight = next[i]; this.paneWeights[id] = next[i]; } });
    d.lastY = y;
    try { localStorage.setItem('pane-weights', JSON.stringify(this.paneWeights)); } catch { /* per-session only */ }
    c.update('none');
  }

  pointer(kind: 'down' | 'move' | 'up', e: MouseEvent): void {
    if (isSelectToolFn(this.tool()) && this.chart) {
      if (this.paneDrag) {
        if (kind === 'move') this.dragPanes(e.offsetY);
        else if (kind === 'up') this.paneDrag = null;
        return;
      }
      const b = paneBoundaryAt(this.chart, e.offsetY);
      if (kind === 'move' && !e.buttons && this.chartCanvas) this.chartCanvas.nativeElement.style.cursor = b ? 'ns-resize' : '';
      if (kind === 'down' && e.button === 0 && b) { this.paneDrag = { ...b, lastY: e.offsetY }; return; }
    }
    if (isSelectToolFn(this.tool()) && kind === 'move' && !e.buttons) return; // hover: nothing to do
    if (e.button !== 0 && kind !== 'move') return; // right / middle button: never draws (the context menu handles right-click)
    if (kind === 'down') this.ctxMenu.set(null);
    if (kind === 'down' && isSelectToolFn(this.tool()) && e.button === 0) this.yDrag = this.classifyYDrag(e.offsetX, e.offsetY);
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
    // TradingView shortcuts: Ctrl+Z / Ctrl+Y / Ctrl+D, Alt+T/H/V/C/F pick a tool
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) this.redo(); else this.undo(); return; }
      if (k === 'y') { e.preventDefault(); this.redo(); return; }
      if (k === 'd') { e.preventDefault(); this.cloneSelected(); return; }
    }
    if (!ctrl && !e.altKey && !this.searchOpen() && !this.indicatorsOpen() && this.settingsIndex() === null && !this.seriesDialog() && !this.settingsOpen()) {
      const c = this.chart as any;
      const nav: Record<string, () => void> = {
        ArrowLeft: () => c?.pan({ x: 40 }, undefined, 'none'), ArrowRight: () => c?.pan({ x: -40 }, undefined, 'none'),
        '+': () => this.zoomBy(1.25), '=': () => this.zoomBy(1.25), '-': () => this.zoomBy(1 / 1.25), End: () => this.scrollToLatest(),
      };
      if (nav[e.key] && !this.drawings.view().draft) { e.preventDefault(); nav[e.key](); return; }
    }
    if (e.altKey && !ctrl && e.code === 'KeyG') { e.preventDefault(); this.gotoOpen.set(true); return; }
    if (e.altKey && !ctrl && ALT_TOOLS[e.code]) { e.preventDefault(); this.setTool(ALT_TOOLS[e.code]); return; }
    // keystrokes typed while the search dialog is still opening must not be lost
    if (this.searchOpen() && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-z0-9]$/i.test(e.key)) {
      const box = document.querySelector<HTMLInputElement>('app-symbol-search-dialog input[type="search"]');
      if (box) box.focus(); // the browser then types the character into it
      else { e.preventDefault(); this.searchInitial.update((v) => v + e.key); }
      return;
    }
    const dialogOpen = this.searchOpen() || this.indicatorsOpen() || this.settingsIndex() !== null || this.seriesDialog() !== null || this.gotoOpen() || this.settingsOpen();
    if (!dialogOpen && !e.ctrlKey && !e.metaKey && !e.altKey && /^[a-z0-9]$/i.test(e.key)) {
      e.preventDefault();
      this.openSearch(e.key);
      return;
    }
    if (e.key === 'Escape') { this.ctxMenu.set(null); this.tool.set(this.cursorMode); this.drawings.syncPan(); this.applyCursorStyle(); this.editingText.set(null); }
    this.drawings.key(e.key);
  }

  @HostListener('window:mouseup', ['$event'])
  onWindowMouseUp(e: MouseEvent): void {
    this.yDrag = null;
    this.paneDrag = null;
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
  percentOn = false;
  invertOn = false;

  /** Close of the first visible bar: the 0% of the percentage scale. */
  percentBase(): number {
    const x = (this.chart?.scales?.['x'] as any)?.min;
    const bars = this.bars;
    if (!bars.length) return 1;
    return bars[Math.min(bars.length - 1, Math.max(0, Math.round(typeof x === 'number' ? x : 0)))].close || 1;
  }

  /** Zoom buttons: scale the visible bar span about the centre (factor > 1 zooms in). */
  zoomBy(f: number): void {
    try { (this.chart as any)?.zoom({ x: f }); } catch (e) { console.warn('zoom failed:', (e as Error).message?.slice(0, 80)); }
  }
  private manualY: Range | null = null;
  private yDrag: { mode: 'axis' | 'pan'; startY: number; lastY: number; engaged: boolean } | null = null;

  setAuto(): void {
    if (this.scaleLocked()) return;
    this.manualY = null;
    this.autoScale.set(true);
    this.chart?.update('none');
  }
  toggleLog(): void { this.chartState.toggleLogScale(); }

  private resetPriceScale(): void {
    this.scaleLocked.set(false);
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
    if (!c || !ys || !c.chartArea || this.scaleLocked()) return null;
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
    if (this.drawings.view().draft) { this.drawings.finish(); return; }
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
  private readonly legendSource = signal<{ series: LegendSeries[]; paneKeys: number; priceHidden: boolean; volumeHidden: boolean; volumeColor: string } | null>(null);
  readonly legendGroups = computed<LegendGroup[]>(() => this.buildLegend());

  setHoverIndex(i: number | null): void {
    if (this.hoverIndex() !== i) this.hoverIndex.set(i);
  }
  readonly seriesDialog = signal<'price' | 'volume' | null>(null);
  readonly settingsOpen = signal(false);
  readonly gotoOpen = signal(false);

  // ---- layouts + indicator templates (11.17) ----------------------------------------
  protected readonly layouts = inject(LayoutService);
  readonly layoutsOpen = signal(false);
  saveLayout(name: string): void {
    if (this.layouts.save(name, this.chartState.snapshot(), this.drawingStore.exportAll())) this.layoutsOpen.set(false);
  }
  loadLayout(name: string): void {
    const l = this.layouts.get(name);
    if (!l) return;
    this.drawings.cancel();
    this.drawingStore.importAll(l.drawings);
    this.chartState.restore(l.state);
    this.layouts.setCurrent(name);
    this.layoutsOpen.set(false);
  }
  applyTemplate(list: IndicatorEntry[]): void { this.chartState.setIndicators(list); }

  // ---- bar replay + alert notifications (11.15) -------------------------------------
  readonly replay = signal<ReplayState | null>(null);
  readonly toasts = signal<Toast[]>([]);
  private replayTimer: ReturnType<typeof setInterval> | null = null;
  private toastId = 0;

  private replaySlice(data: OHLCV[]): OHLCV[] {
    const r = this.replay();
    return r ? data.slice(0, r.index + 1) : data;
  }
  replayMax(): number { return Math.max(0, this.allData.length - 1); }
  replayDate(): string { const b = this.allData[this.replay()?.index ?? -1]; return b ? this.formatBarDate(b.timestamp) : ''; }

  toggleReplay(): void { if (this.replay()) this.stopReplay(); else this.startReplay(); }

  startReplay(): void {
    if (!this.allData.length) return;
    this.replay.set({ index: Math.max(0, this.allData.length - 1 - 60), playing: false, speed: 1 });
    this.createChart(this.allData);
  }

  stopReplay(): void {
    this.clearReplayTimer();
    if (!this.replay()) return;
    this.replay.set(null);
    if (this.allData.length) this.createChart(this.allData, this.currentView());
  }

  private clearReplayTimer(): void { if (this.replayTimer) { clearInterval(this.replayTimer); this.replayTimer = null; } }

  private syncReplayTimer(): void {
    this.clearReplayTimer();
    const r = this.replay();
    if (r?.playing) this.replayTimer = setInterval(() => { this.replayStep(1); this.cdr.markForCheck(); }, 1000 / r.speed);
  }

  replayPlay(): void {
    const r = this.replay();
    if (!r) return;
    this.replay.set({ ...r, playing: !r.playing && r.index < this.replayMax() });
    this.syncReplayTimer();
  }

  replaySpeed(speed: number): void {
    const r = this.replay();
    if (r) { this.replay.set({ ...r, speed }); this.syncReplayTimer(); }
  }

  replayStep(dir: number): void { const r = this.replay(); if (r) this.replaySeek(r.index + dir); }

  /** Moves the replay to a bar; walking forward evaluates the price alerts bar by bar. */
  replaySeek(to: number): void {
    const r = this.replay();
    if (!r) return;
    const target = Math.min(this.replayMax(), Math.max(0, Math.round(to)));
    let index = r.index;
    let fired = false;
    if (target > index) {
      for (let j = index + 1; j <= target && !fired; j++) {
        index = j;
        for (const a of this.alerts.evaluate(this.currentSymbol, this.allData[j - 1].close, this.allData[j].close)) {
          fired = true;
          this.toast(`${this.currentSymbol.toUpperCase()} crossed ${a.price.toFixed(2)}`);
        }
      }
    } else index = target;
    const playing = r.playing && !fired && index < this.replayMax();
    this.replay.set({ ...r, index, playing });
    if (playing !== r.playing) this.syncReplayTimer();
    const view = this.currentView();
    // keep the span, and keep the newest bar in sight (a tiny span means the view was framed on very few bars: reframe)
    const usable = !!view && view.max - view.min >= 5;
    const shift = usable && index + 2 > view!.max ? index + 2 - view!.max : 0;
    this.createChart(this.allData, usable ? { min: view!.min + shift, max: view!.max + shift } : undefined);
  }

  private toast(text: string): void {
    const id = ++this.toastId;
    this.toasts.update((t) => [...t, { id, text }]);
    setTimeout(() => this.dismissToast(id), 6000);
  }
  dismissToast(id: number): void { this.toasts.update((t) => t.filter((x) => x.id !== id)); }

  // ---- side panel (11.14) ---------------------------------------------------------
  protected readonly watchlist = inject(WatchlistService);
  protected readonly alerts = inject(AlertService);
  private readonly savedPanel = ((): { open: boolean; tab: PanelTab } => {
    try { const p = JSON.parse(localStorage.getItem('chart-panel') ?? '{}'); return { open: p.open === true, tab: ['objects', 'data', 'watchlist', 'alerts'].includes(p.tab) ? p.tab : 'objects' }; } catch { return { open: false, tab: 'objects' }; }
  })();
  readonly panelOpen = signal(this.savedPanel.open);
  readonly panelTab = signal<PanelTab>(this.savedPanel.tab);
  private savePanel(): void { try { localStorage.setItem('chart-panel', JSON.stringify({ open: this.panelOpen(), tab: this.panelTab() })); } catch { /* per-session only */ } }
  togglePanel(): void { this.panelOpen.update((v) => !v); this.savePanel(); }
  setPanelTab(t: PanelTab): void { this.panelTab.set(t); this.savePanel(); }

  readonly panelIndicators = computed(() => (this.legendSource()?.series ?? []).filter((s) => !s.compare).map((s) => ({ index: s.index, label: s.label, color: s.color, hidden: s.hidden })));
  readonly panelDrawings = computed(() => {
    this.drawingStore.revision();
    this.legendSource(); // a symbol switch rebuilds the chart
    return this.drawingStore.list(this.currentSymbol).map((d) => ({ id: d.id, label: toolDef(d.type)?.label ?? d.type, hidden: !!d.hidden, locked: !!d.locked }));
  });
  readonly panelData = computed(() => {
    const src = this.legendSource();
    const bars = this.bars;
    if (!src || !bars.length) return { date: '', rows: [] };
    const i = Math.min(Math.max(0, this.hoverIndex() ?? bars.length - 1), bars.length - 1);
    const b = bars[i];
    const prev = i > 0 ? bars[i - 1] : null;
    const f = (v: number) => v.toFixed(2);
    const rows = [
      { label: 'Open', value: f(b.open) }, { label: 'High', value: f(b.high) }, { label: 'Low', value: f(b.low) }, { label: 'Close', value: f(b.close) },
      { label: 'Volume', value: compactVolume(b.volume) },
      { label: 'Change', value: prev ? `${b.close - prev.close >= 0 ? '+' : ''}${f(b.close - prev.close)} (${f(((b.close - prev.close) / prev.close) * 100)}%)` : '–' },
      ...src.series.map((s) => { const v = s.values[Math.min(i, s.values.length - 1)]; return { label: s.label, value: typeof v === 'number' ? f(v) : '–', color: s.color }; }),
    ];
    return { date: this.formatBarDate(b.timestamp), rows };
  });
  readonly panelWatch = computed(() => this.watchlist.list().map((symbol) => ({ symbol, ...(this.watchlist.quotes()[symbol] ?? {}) })));
  readonly panelAlerts = computed(() => this.alerts.list());

  toggleDrawingFlag(id: string, flag: 'locked' | 'hidden'): void {
    const d = this.drawingStore.list(this.currentSymbol).find((x) => x.id === id);
    if (d) this.drawings.setFlag(id, flag, !d[flag]);
  }
  selectDrawing(id: string): void { this.drawings.select(id); }
  removeDrawing(id: string): void { this.drawingStore.remove(this.currentSymbol, id); this.drawings.select(null); this.redraw(); }
  addAlert(price: number): void { this.alerts.add(this.currentSymbol, price); this.chart?.draw(); }
  readonly scaleLocked = signal(false);
  readonly clockText = signal('');
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  private tick(): void {
    const view = this.chartState.snapshot().view;
    this.clockText.set(formatClock(new Date(), view.timezone));
    if (view.countdown) this.chart?.draw();
  }

  toggleLockScale(): void {
    if (!this.scaleLocked()) this.enterManual(); // freeze the range as it is
    this.scaleLocked.update((v) => !v);
  }

  fitAll(): void {
    const c = this.chart as any;
    if (!c || !this.bars.length) return;
    try { c.zoomScale('x', { min: 0, max: this.bars.length - 1 }, 'none'); } catch { /* limits */ }
    this.setAuto();
  }

  /** Centre the view on the bar nearest to a date (the visible span stays). */
  goToDate(ts: number): void {
    const c = this.chart as any;
    const x = c?.scales?.x;
    if (!x || !this.bars.length) return;
    const i = indexForTime(this.bars, ts);
    const half = (x.max - x.min) / 2;
    try { c.zoomScale('x', { min: i - half, max: i + half }, 'none'); } catch { /* limits */ }
  }
  readonly ctxMenu = signal<{ x: number; y: number; price: number; t: number } | null>(null);

  onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const canvas = this.chartCanvas?.nativeElement;
    const c = this.chart as any;
    if (!canvas || !c?.scales?.y) return;
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const price = c.scales.y.getValueForPixel(y);
    const idx = c.scales.x.getValueForPixel(x);
    this.ctxMenu.set({ x, y, price: Number.isFinite(price) ? price : 0, t: this.bars.length ? timeForIndex(this.bars, idx) : 0 });
  }

  ctxDo(what: 'reset' | 'hline' | 'alert' | 'clear' | 'settings'): void {
    const m = this.ctxMenu();
    this.ctxMenu.set(null);
    if (what === 'reset') { this.resetZoom(); this.setAuto(); }
    else if (what === 'hline' && m) { this.drawingStore.add(this.currentSymbol, { id: `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, type: 'hline', a: { t: m.t, p: m.price } }); this.redraw(); }
    else if (what === 'alert' && m) this.addAlert(m.price);
    else if (what === 'clear') this.clearDrawings();
    else this.settingsOpen.set(true);
  }

  /** End key: scroll so the latest bar is at the right edge (the visible span stays). */
  scrollToLatest(): void {
    const c = this.chart as any;
    const x = c?.scales?.x;
    if (!x || !this.bars.length) return;
    const span = x.max - x.min;
    const end = this.bars.length - 1 + 1;
    try { c.zoomScale('x', { min: end - span, max: end }, 'none'); } catch { /* limits */ }
  }
  lineLike(): boolean { return ['line', 'markers', 'step', 'area'].includes(this.chartTypeValue); }
  toggleSeries(k: 'price' | 'volume'): void { if (k === 'price') this.chartState.togglePriceHidden(); else this.chartState.toggleVolumeHidden(); }
  saveSeriesSettings(k: 'price' | 'volume', s: PriceSettings | VolumeSettings): void {
    // the hidden flag belongs to the eye, not the dialog
    const cur = k === 'price' ? this.chartState.snapshot().price : this.chartState.snapshot().volume;
    const next = { ...s, ...(cur.hidden ? { hidden: true } : {}) };
    if (k === 'price') this.chartState.setPriceSettings(next); else this.chartState.setVolumeSettings(next);
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
      if (s.compare) {
        const base = s.values.find((x) => typeof x === 'number') as number | undefined;
        const pct = base && typeof v === 'number' ? ((v / base - 1) * 100) : null;
        return { key: `cmp:${s.compare}`, label: s.label, value: pct === null ? '–' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`, color: s.color, hidden: false, compare: s.compare };
      }
      return { key: `ind${s.index}`, label: s.label, value: typeof v === 'number' ? f2(v) : '–', color: s.color, hidden: s.hidden, index: s.index };
    };
    const groups: LegendGroup[] = [
      {
        key: 'price', top: tops['y'] ?? 0,
        header: { symbol: this.currentSymbol.toUpperCase(), interval: this.currentInterval.toUpperCase(), ohlc: this.chartState.snapshot().view.ohlc ? ohlc : null, hidden: src.priceHidden },
        rows: [
          ...src.series.filter((s) => !s.pane).map(row),
          { key: 'volume', label: 'Volume', value: compactVolume(bar.volume), color: src.volumeColor, hidden: src.volumeHidden, builtin: 'volume' as const },
        ],
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
    // quotes are only fetched while the watchlist is on screen
    effect(() => { if (this.panelOpen() && this.panelTab() === 'watchlist') for (const s of this.watchlist.list()) this.watchlist.loadQuote(s); });
    effect(() => { this.alerts.list(); this.chart?.draw(); });
  }

  ngOnInit(): void {
    this.tick();
    this.clockTimer = setInterval(() => { this.tick(); this.cdr.markForCheck(); }, 1000);
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
        this.percentOn = s.percentScale;
        for (const c of s.compare) this.ensureCompare(c);
        this.invertOn = s.invertScale;
        this.clockText.set(formatClock(new Date(), s.view.timezone));
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
        if (symbolChanged) this.replay.set(null);
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

  // ---- compared symbols (11.16) ---------------------------------------------------------
  private compareData: Record<string, OHLCV[]> = {};
  private compareRequested = new Set<string>();
  private ensureCompare(sym: string): void {
    if (this.compareRequested.has(sym)) return;
    this.compareRequested.add(sym);
    this.chartDataService.getOHLCV(sym, '1d', 100000).subscribe((data) => {
      this.compareData[sym] = data;
      if (this.allData.length && this.chartState.snapshot().compare.includes(sym)) this.createChart(this.allData, this.currentView());
    });
  }

  /** Value of a per-bar series sampled at the LAST bar of each bucket. */
  private lineBuilder(values: (number | null)[]): DataBuilder {
    return (pts) => pts.map((p) => {
      const v = values[Math.min(p.i + p.n - 1, values.length - 1)];
      return { x: p.x, y: typeof v === 'number' ? v : null };
    });
  }

  private createChart(fullData: OHLCV[], preserveView?: { min: number; max: number }): void {
    const data = this.replaySlice(fullData);
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

    const ps = this.chartState.snapshot().price;
    const vs = this.chartState.snapshot().volume;
    const priceUp = ps.up ?? up;
    const priceDown = ps.down ?? down;
    for (const entry of buildPriceSeries(ctype, {
      up: priceUp, down: priceDown, muted: cssVar('--c-text-muted'), upFill: cssVar('--c-up-fill'), downFill: cssVar('--c-down-fill'),
      line: ps.line ?? cssVar('--c-price-line'), area: cssVar('--c-price-area'),
      baseline: baselineFor(rangeSlice), box: boxSizeFor(sourceBars),
      byPrevClose: ps.byPrevClose, width: ps.width, source: ps.source,
    })) add(ps.hidden ? { ...entry.dataset, hidden: true } : entry.dataset, entry.builder);
    const volUp = vs.up ?? up;
    const volDown = vs.down ?? down;
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
    // compared symbols: lines on the price scale, normalised so they start where the price does
    this.chartState.snapshot().compare.forEach((sym, k) => {
      const cd = this.compareData[sym];
      if (!cd?.length) return;
      const values = alignCompare(bars, cd, Math.max(0, sliceStart));
      const color = cssVar(`--c-indicator-${((overlays.length + k) % 4) + 1}`);
      add(this.lineDataset(sym.toUpperCase(), 'y', color, 1.5, [], false), this.lineBuilder(values));
      legendSeries.push({ index: -1, label: sym.toUpperCase(), color, hidden: false, values, pane: false, compare: sym });
    });
    add({
      type: 'bar', label: 'Volume', yAxisID: 'yVol', data: [], parsing: false, normalized: true, hidden: !!vs.hidden,
      barPercentage: 1, categoryPercentage: 0.9,
      backgroundColor: (ctx: any) => (ctx.raw?.up ? volUp : volDown),
    }, (pts) => pts.map((p) => ({ x: p.x, y: this.logOn && !(p.v > 0) ? null : p.v, up: vs.byPrevClose ? p.upPc : p.up, t: p.t })));

    const view = this.chartState.snapshot().view;
    const gridV = { color: cssVar('--c-grid'), display: view.gridV };
    const grid = { color: cssVar('--c-grid'), display: view.gridH };
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
        type: 'linear', position: 'right', stack: 'panel', stackWeight: this.paneWeights[id] ?? PANE_WEIGHT,
        afterFit: (s: any) => { s.width = Y_WIDTH; },
        grid,
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
    const scales: Record<string, any> = {
      x: {
        type: 'linear', position: 'bottom', min: viewMin, max: viewMax, grid: gridV,
        ticks: {
          maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
          // First arg is the VALUE = the bar index on this linear scale
          // (the 2nd arg is the tick index — mapping it showed 1986 dates, 4.3).
          callback: (value: any) => dateForIndex(Number(value)),
        },
      },
      y: {
        type: this.logOn ? 'logarithmic' : 'linear', position: 'right', stack: 'panel', stackWeight: this.paneWeights['y'] ?? PRICE_WEIGHT,
        afterFit: (s: any) => { s.width = Y_WIDTH; }, grid,
        reverse: this.invertOn,
        ticks: {
          includeBounds: false,
          ...(this.percentOn ? { callback: (v: any) => { const p = (Number(v) / this.percentBase() - 1) * 100; return `${p > 0.005 ? '+' : ''}${p.toFixed(2)}%`; } } : {}),
        },
        paneLabel: `${this.currentSymbol.toUpperCase()} · ${this.currentInterval.toUpperCase()}`,
      },
      yVol: {
        type: this.logOn ? 'logarithmic' : 'linear', position: 'right', stack: 'panel', stackWeight: this.paneWeights['yVol'] ?? VOLUME_WEIGHT,
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
        // Every loaded point is drawn (the LOD window is already small); Chart.js's "visible points
        // only" shortcut works from stale pixel positions while panning and clips the lines short.
        beforeDatasetUpdate: (_c: Chart, args: any) => { args.meta._sorted = false; },
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
    (this.chart as any).$percentBase = () => this.percentBase();
    (this.chart as any).$percentOn = this.percentOn;
    (this.chart as any).$lastBars = () => this.bars;
    (this.chart as any).$alerts = () => this.alerts.forSymbol(this.currentSymbol);
    (this.chart as any).$countdown = () => { const v = this.chartState.snapshot().view; return v.countdown ? barCountdown(new Date(), this.currentInterval, v.session) : undefined; };
    (this.chart as any).$crosshairOn = view.crosshair;
    (this.chart as any).$lastPriceOn = view.lastPrice;
    this.applyCursorStyle();
    (this.chart as any).$drawings = this.drawings;
    this.drawings.syncPan();
    this.chart.draw(); // the constructor's first render ran before the controller was attached
    this.legendSource.set({ series: legendSeries, paneKeys: panes.length, priceHidden: !!ps.hidden, volumeHidden: !!vs.hidden, volumeColor: volUp });
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
    if (this.clockTimer) clearInterval(this.clockTimer);
    this.clearReplayTimer();
    this.destroyChart();
  }
}
