import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

export type PanelTab = 'objects' | 'data' | 'watchlist' | 'alerts';
export interface PanelIndicator { index: number; label: string; color: string; hidden: boolean; }
export interface PanelDrawing { id: string; label: string; hidden: boolean; locked: boolean; }
export interface PanelDataRow { label: string; value: string; color?: string; }
export interface PanelWatch { symbol: string; last?: number; pct?: number; }
export interface PanelAlert { id: string; symbol: string; price: number; triggered: boolean; }

/**
 * Right-hand panel: object tree (indicators + drawings with eye / lock / delete / z-order),
 * data window (values under the crosshair), watchlist and price alerts. Presentational.
 */
@Component({
  selector: 'app-chart-side-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tabs" role="tablist">
      @for (t of tabs; track t.id) {
        <button type="button" role="tab" class="tab" [attr.data-tab]="t.id" [attr.aria-selected]="tab() === t.id" [title]="t.label" (click)="tabChange.emit(t.id)">{{ t.short }}</button>
      }
    </div>
    <div class="body">
      @switch (tab()) {
        @case ('objects') {
          <h3>Indicators</h3>
          @for (i of indicators(); track i.index) {
            <div class="row" data-obj-indicator [class.hidden]="i.hidden" (dblclick)="indicatorSettings.emit(i.index)">
              <span class="chip" [style.background]="i.color"></span><span class="label">{{ i.label }}</span>
              <button type="button" class="ctl" data-obj-eye [attr.aria-label]="(i.hidden ? 'Show ' : 'Hide ') + i.label" (click)="indicatorToggle.emit(i.index)">{{ i.hidden ? '◌' : '◉' }}</button>
              <button type="button" class="ctl" data-obj-settings [attr.aria-label]="'Settings for ' + i.label" (click)="indicatorSettings.emit(i.index)">⚙</button>
              <button type="button" class="ctl" data-obj-delete [attr.aria-label]="'Remove ' + i.label" (click)="indicatorRemove.emit(i.index)">×</button>
            </div>
          } @empty { <p class="empty">No indicators</p> }
          <h3>Drawings</h3>
          @for (d of drawings(); track d.id) {
            <div class="row" data-obj-drawing [class.selected]="d.id === selectedId()" [class.hidden]="d.hidden" (click)="drawingSelect.emit(d.id)">
              <span class="label">{{ d.label }}</span>
              <button type="button" class="ctl" data-obj-front title="Bring to front" aria-label="Bring to front" (click)="$event.stopPropagation(); drawingOrder.emit({ id: d.id, how: 'front' })">⇧</button>
              <button type="button" class="ctl" data-obj-eye [attr.aria-label]="d.hidden ? 'Show drawing' : 'Hide drawing'" (click)="$event.stopPropagation(); drawingToggleHidden.emit(d.id)">{{ d.hidden ? '◌' : '◉' }}</button>
              <button type="button" class="ctl" data-obj-lock [attr.aria-pressed]="d.locked" aria-label="Lock drawing" (click)="$event.stopPropagation(); drawingToggleLocked.emit(d.id)">🔒</button>
              <button type="button" class="ctl" data-obj-delete aria-label="Delete drawing" (click)="$event.stopPropagation(); drawingRemove.emit(d.id)">×</button>
            </div>
          } @empty { <p class="empty">No drawings on this symbol</p> }
        }
        @case ('data') {
          <h3 data-data-date>{{ data().date || '–' }}</h3>
          @for (r of data().rows; track r.label) {
            <div class="row plain" data-data-row>
              @if (r.color) { <span class="chip" [style.background]="r.color"></span> }
              <span class="label">{{ r.label }}</span><span class="value">{{ r.value }}</span>
            </div>
          }
        }
        @case ('watchlist') {
          @for (w of watch(); track w.symbol) {
            <div class="row watch" data-watch-row [class.active]="w.symbol === current()" (click)="watchPick.emit(w.symbol)">
              <span class="label">{{ w.symbol.toUpperCase() }}</span>
              <span class="value">{{ w.last === undefined ? '–' : w.last.toFixed(2) }}</span>
              <span class="value" [class.up]="(w.pct ?? 0) >= 0" [class.down]="(w.pct ?? 0) < 0">{{ w.pct === undefined ? '' : (w.pct >= 0 ? '+' : '') + w.pct.toFixed(2) + '%' }}</span>
              <button type="button" class="ctl" data-watch-remove [attr.aria-label]="'Remove ' + w.symbol" (click)="$event.stopPropagation(); watchRemove.emit(w.symbol)">×</button>
            </div>
          }
          <div class="add">
            <input data-watch-input placeholder="Add symbol" aria-label="Add symbol" [value]="newSymbol()" (input)="newSymbol.set($any($event.target).value)" (keydown.enter)="addSymbol()" />
            <button type="button" data-watch-add (click)="addSymbol()">Add</button>
          </div>
        }
        @case ('alerts') {
          @for (a of alerts(); track a.id) {
            <div class="row" data-alert-row [class.triggered]="a.triggered">
              <span class="label">{{ a.symbol.toUpperCase() }} crosses {{ a.price.toFixed(2) }}</span>
              @if (a.triggered) { <span class="value">triggered</span> }
              <button type="button" class="ctl" data-alert-remove aria-label="Remove alert" (click)="alertRemove.emit(a.id)">×</button>
            </div>
          } @empty { <p class="empty">No alerts. Add one at a price, or right-click the chart.</p> }
          <div class="add">
            <input data-alert-input placeholder="Price" aria-label="Alert price" inputmode="decimal" [value]="newPrice()" (input)="newPrice.set($any($event.target).value)" (keydown.enter)="addAlert()" />
            <button type="button" data-alert-add (click)="addAlert()">Add alert</button>
          </div>
        }
      }
    </div>
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; width: 260px; flex: none; min-height: 0; background: var(--c-surface); border-left: 1px solid var(--c-pane-border); font-size: 0.8125rem; }
      .tabs { display: flex; border-bottom: 1px solid var(--c-pane-border); }
      .tab { flex: 1; padding: 6px 2px; border: none; border-bottom: 2px solid transparent; background: transparent; color: var(--c-text-muted); cursor: pointer; font-size: 0.75rem; }
      .tab[aria-selected='true'] { color: var(--c-primary); border-bottom-color: var(--c-primary); }
      .body { flex: 1; overflow: auto; padding: 4px 6px; }
      h3 { margin: 8px 0 4px; font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--c-text-muted); }
      .row { display: flex; align-items: center; gap: 0.4rem; padding: 2px 4px; border-radius: var(--border-radius-sm); color: var(--c-text); cursor: default; }
      .row:hover { background: var(--c-primary-tint); }
      .row.selected, .row.active { background: var(--c-primary-tint); font-weight: 600; }
      .row.hidden .label { opacity: 0.45; text-decoration: line-through; }
      .row.triggered .label { color: var(--c-text-muted); }
      .row.watch, .row.plain { cursor: pointer; }
      .label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .value { font-variant-numeric: tabular-nums; color: var(--c-text-muted); }
      .up { color: var(--c-up); } .down { color: var(--c-down); }
      .chip { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .ctl { width: 18px; height: 18px; padding: 0; border: none; background: transparent; color: var(--c-text-muted); cursor: pointer; opacity: 0.6; }
      .row:hover .ctl { opacity: 1; }
      .ctl:hover, .ctl[aria-pressed='true'] { color: var(--c-primary); opacity: 1; }
      .empty { margin: 4px; color: var(--c-text-muted); }
      .add { display: flex; gap: 4px; margin-top: 8px; }
      .add input { flex: 1; min-width: 0; padding: 3px 6px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); }
      .add button { padding: 3px 8px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
    `,
  ],
})
export class ChartSidePanelComponent {
  readonly tab = input<PanelTab>('objects');
  readonly indicators = input<PanelIndicator[]>([]);
  readonly drawings = input<PanelDrawing[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly data = input<{ date: string; rows: PanelDataRow[] }>({ date: '', rows: [] });
  readonly watch = input<PanelWatch[]>([]);
  readonly current = input('');
  readonly alerts = input<PanelAlert[]>([]);

  readonly tabChange = output<PanelTab>();
  readonly indicatorToggle = output<number>();
  readonly indicatorRemove = output<number>();
  readonly indicatorSettings = output<number>();
  readonly drawingSelect = output<string>();
  readonly drawingToggleHidden = output<string>();
  readonly drawingToggleLocked = output<string>();
  readonly drawingRemove = output<string>();
  readonly drawingOrder = output<{ id: string; how: 'front' | 'back' | 'forward' | 'backward' }>();
  readonly watchPick = output<string>();
  readonly watchAdd = output<string>();
  readonly watchRemove = output<string>();
  readonly alertAdd = output<number>();
  readonly alertRemove = output<string>();

  readonly tabs: { id: PanelTab; label: string; short: string }[] = [
    { id: 'objects', label: 'Object tree', short: 'Objects' },
    { id: 'data', label: 'Data window', short: 'Data' },
    { id: 'watchlist', label: 'Watchlist', short: 'Watch' },
    { id: 'alerts', label: 'Alerts', short: 'Alerts' },
  ];
  readonly newSymbol = signal('');
  readonly newPrice = signal('');

  addSymbol(): void {
    const s = this.newSymbol().trim().toLowerCase().replace(/\.us$/, '');
    if (s) this.watchAdd.emit(s);
    this.newSymbol.set('');
  }

  addAlert(): void {
    const p = Number(this.newPrice());
    if (this.newPrice().trim() !== '' && Number.isFinite(p) && p > 0) this.alertAdd.emit(p);
    this.newPrice.set('');
  }
}
