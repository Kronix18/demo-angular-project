import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../shared/icons/icon.component';

export interface LegendRow {
  key: string;
  label: string;
  value: string;
  /** Resolved CSS colour of the series (canvas colour, applied to the chip). */
  color: string;
  hidden: boolean;
  /** Index into the chart state's indicator list; absent for non-indicator rows (Volume). */
  index?: number;
  /** The built-in Volume row (eye + settings, no remove). */
  builtin?: 'volume';
  /** A compared symbol (remove only). */
  compare?: string;
}

export interface LegendGroup {
  key: string;
  /** Pixel offset from the top of the chart panel (= the pane's top edge). */
  top: number;
  header?: {
    symbol: string;
    interval: string;
    /** the price series is hidden with the eye */
    hidden?: boolean;
    ohlc: { o: string; h: string; l: string; c: string; v: string; change: string; up: boolean } | null;
  };
  rows: LegendRow[];
}

/**
 * TradingView-style legend: one group per pane, overlaid on the chart panel.
 * Price group: `SYMBOL · 1D  O H L C  change` for the hovered bar, then the
 * overlay indicators; every indicator row has a colour chip, live value, eye
 * (visibility) toggle and remove ✕. Dumb component — the viewer owns the model.
 */
@Component({
  selector: 'app-chart-legend',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (g of groups(); track g.key) {
      <div class="group" [attr.data-legend-group]="g.key" [style.top.px]="g.top">
        @if (g.header; as h) {
          <div class="header" data-legend-header [class.hidden]="h.hidden">
            <button type="button" class="symbol symbol-btn" data-symbol-btn aria-label="Search symbol" title="Search symbol (or just start typing)"
              (click)="symbolClick.emit()">{{ h.symbol }} · {{ h.interval }}</button>
            @if (h.ohlc; as b) {
              <span class="ohlc" data-ohlc [class.up]="b.up" [class.down]="!b.up">
                <span>O <b>{{ b.o }}</b></span>
                <span>H <b>{{ b.h }}</b></span>
                <span>L <b>{{ b.l }}</b></span>
                <span>C <b>{{ b.c }}</b></span>
                <span data-vol>V <b>{{ b.v }}</b></span>
                <span class="change">{{ b.change }}</span>
              </span>
            }
            <button type="button" class="ctl" data-price-eye [attr.aria-pressed]="!h.hidden" [attr.aria-label]="h.hidden ? 'Show symbol' : 'Hide symbol'"
              [title]="h.hidden ? 'Show' : 'Hide'" (click)="seriesToggle.emit('price')"><app-icon [name]="h.hidden ? 'eyeoff' : 'eye'" [size]="14" /></button>
            <button type="button" class="ctl" data-price-settings aria-label="Symbol settings" title="Settings" (click)="seriesSettings.emit('price')"><app-icon name="gear" [size]="14" /></button>
          </div>
        }
        @for (r of g.rows; track r.key) {
          @if (r.index !== undefined) {
            <div class="row" data-indicator-row [class.hidden]="r.hidden" (dblclick)="settings.emit(r.index!)">
              <span class="chip" data-chip [style.background]="r.color"></span>
              <span class="label">{{ r.label }}</span>
              <span class="value">{{ r.value }}</span>
              <button type="button" class="ctl" data-eye [attr.aria-pressed]="!r.hidden"
                [attr.aria-label]="(r.hidden ? 'Show ' : 'Hide ') + r.label"
                [title]="r.hidden ? 'Show' : 'Hide'" (click)="toggle.emit(r.index!)"><app-icon [name]="r.hidden ? 'eyeoff' : 'eye'" [size]="14" /></button>
              <button type="button" class="ctl" data-settings [attr.aria-label]="'Settings for ' + r.label"
                title="Settings" (click)="settings.emit(r.index!)"><app-icon name="gear" [size]="14" /></button>
              <button type="button" class="ctl" data-remove [attr.aria-label]="'Remove ' + r.label"
                title="Remove" (click)="remove.emit(r.index!)"><app-icon name="close" [size]="14" /></button>
            </div>
          } @else if (r.compare) {
            <div class="row" data-compare-row>
              <span class="chip" data-chip [style.background]="r.color"></span>
              <span class="label">{{ r.label }}</span>
              <span class="value">{{ r.value }}</span>
              <button type="button" class="ctl" data-compare-remove [attr.aria-label]="'Remove ' + r.label" title="Remove" (click)="compareRemove.emit(r.compare!)"><app-icon name="close" [size]="14" /></button>
            </div>
          } @else if (r.builtin) {
            <div class="row" data-volume-row [class.hidden]="r.hidden">
              <span class="chip" [style.background]="r.color"></span>
              <span class="label">{{ r.label }}</span>
              <span class="value">{{ r.value }}</span>
              <button type="button" class="ctl" data-volume-eye [attr.aria-pressed]="!r.hidden" [attr.aria-label]="r.hidden ? 'Show volume' : 'Hide volume'"
                [title]="r.hidden ? 'Show' : 'Hide'" (click)="seriesToggle.emit('volume')"><app-icon [name]="r.hidden ? 'eyeoff' : 'eye'" [size]="14" /></button>
              <button type="button" class="ctl" data-volume-settings aria-label="Volume settings" title="Settings" (click)="seriesSettings.emit('volume')"><app-icon name="gear" [size]="14" /></button>
            </div>
          } @else {
            <div class="row plain">
              <span class="label">{{ r.label }}</span>
              <span class="value">{{ r.value }}</span>
            </div>
          }
        }
      </div>
    }
  `,
  styles: [
    `
      :host { position: absolute; inset: 0; pointer-events: none; z-index: 3; font-size: 0.75rem; }
      .group { position: absolute; left: 8px; padding-top: 4px; display: flex; flex-direction: column; gap: 1px; }
      .header, .row { display: flex; align-items: center; gap: 0.5rem; color: var(--c-text-muted); white-space: nowrap; }
      .symbol { color: var(--c-text); font-weight: 600; }
      .symbol-btn { padding: 0; border: none; background: transparent; font: inherit; font-weight: 600; cursor: pointer; pointer-events: auto; }
      .symbol-btn:hover { color: var(--c-primary); }
      .ohlc { display: inline-flex; gap: 0.5rem; }
      .ohlc b { font-weight: 500; }
      .ohlc.up { color: var(--c-up); }
      .ohlc.down { color: var(--c-down); }
      .row { border-radius: var(--border-radius-sm); padding: 0 0.25rem 0 0; pointer-events: auto; }
      .row.plain { pointer-events: none; }
      .header { pointer-events: auto; width: fit-content; border-radius: var(--border-radius-sm); }
      .header:hover .ctl { opacity: 1; }
      .header.hidden .symbol, .header.hidden .ohlc { opacity: 0.45; }
      .row:hover { background: var(--c-primary-tint); }
      .row.hidden .label, .row.hidden .value { opacity: 0.45; text-decoration: line-through; }
      .chip { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .label { color: var(--c-text); }
      .value { font-variant-numeric: tabular-nums; }
      .ctl {
        width: 16px; height: 16px; padding: 0; border: none; background: transparent;
        display: inline-flex; align-items: center; justify-content: center;
        color: var(--c-text-muted); cursor: pointer; font-size: 0.8rem; line-height: 1; opacity: 0;
      }
      .row:hover .ctl, .ctl:focus-visible { opacity: 1; }
      .ctl:hover { color: var(--c-primary); }
    `,
  ],
})
export class ChartLegendComponent {
  readonly groups = input.required<LegendGroup[]>();
  readonly toggle = output<number>();
  readonly remove = output<number>();
  readonly settings = output<number>();
  readonly symbolClick = output<void>();
  readonly compareRemove = output<string>();
  readonly seriesToggle = output<'price' | 'volume'>();
  readonly seriesSettings = output<'price' | 'volume'>();
}
