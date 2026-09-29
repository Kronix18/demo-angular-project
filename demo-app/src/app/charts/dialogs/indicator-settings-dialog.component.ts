import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IndicatorCalculationService } from '../../core/services/indicator-calculation.service';
import { IndicatorEntry, LineDash, OutputStyle, resolveEntry } from '../../core/indicators/indicator-catalog';
import { IndicatorDefinition, OutputSpec, ParameterSpec } from '../../core/indicators/indicator-definitions';
import { resolveColor } from '../chart-theme';
import { ModalComponent } from './modal.component';

type Tab = 'inputs' | 'style' | 'visibility';
export const CHART_INTERVALS = ['1d', '1w'];
const WIDTHS = [1, 1.5, 2, 3, 4];
const DASHES: LineDash[] = ['solid', 'dash', 'dot', 'dash_dot'];
const WEBBY_ORIGINAL = ['webby', 'signal', 'level_0', 'level_05', 'level_2', 'level_4', 'level_6'];

interface StyleRow { key: string; label: string; color: string; width: number; dash: LineDash; visible: boolean; touched: { color: boolean; width: boolean; dash: boolean }; }

/** `#rrggbb` for <input type=color>; anything else falls back to the neutral guide colour. */
const asHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : resolveColor('var(--c-ind-guide)') || '');

/**
 * Indicator settings: Inputs (generated from the definition's parameter specs,
 * validated against their bounds), Style (colour / width / line style /
 * visibility per output) and Visibility (timeframes). Applies on OK.
 */
@Component({
  selector: 'app-indicator-settings-dialog',
  standalone: true,
  imports: [ModalComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="'Settings: ' + label()" (closed)="closed.emit()">
      <div class="tabs" role="tablist">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" class="tab" [attr.data-tab]="t.id" [attr.aria-selected]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
        }
      </div>

      @switch (tab()) {
        @case ('inputs') {
          @for (p of specs(); track p.key) {
            <div class="field">
              <label [for]="'p-' + p.key">{{ p.label }}</label>
              @switch (p.type) {
                @case ('boolean') {
                  <input type="checkbox" [id]="'p-' + p.key" [attr.data-param]="p.key" [checked]="values()[p.key] === true" (change)="setParam(p.key, $any($event.target).checked)" />
                }
                @case ('choice') { <ng-container *ngTemplateOutlet="sel; context: { p: p }" /> }
                @case ('source') { <ng-container *ngTemplateOutlet="sel; context: { p: p }" /> }
                @default {
                  <input type="number" [id]="'p-' + p.key" [attr.data-param]="p.key" [attr.min]="p.minimum" [attr.max]="p.maximum" [attr.step]="p.step"
                    [value]="values()[p.key] ?? ''" (input)="setParam(p.key, numberOf($any($event.target).value))" />
                }
              }
              @if (errors()[p.key]; as msg) { <span class="error" [attr.data-error]="p.key" role="alert">{{ msg }}</span> }
            </div>
          }
        }
        @case ('style') {
          @for (r of rows(); track r.key) {
            <div class="row" [attr.data-style-row]="r.key">
              <input type="checkbox" [attr.data-style-visible]="r.key" [checked]="r.visible" [attr.aria-label]="'Show ' + r.label" (change)="patchRow(r.key, { visible: $any($event.target).checked })" />
              <span class="lbl">{{ r.label }}</span>
              <input type="color" [attr.data-style-color]="r.key" [value]="r.color" [attr.aria-label]="r.label + ' colour'" (input)="patchRow(r.key, { color: $any($event.target).value }, 'color')" />
              <select [attr.data-style-width]="r.key" [attr.aria-label]="r.label + ' width'" (change)="patchRow(r.key, { width: +$any($event.target).value }, 'width')">
                @for (w of widths; track w) { <option [value]="w" [selected]="w === r.width">{{ w }}px</option> }
              </select>
              <select [attr.data-style-dash]="r.key" [attr.aria-label]="r.label + ' line style'" (change)="patchRow(r.key, { dash: $any($event.target).value }, 'dash')">
                @for (d of dashes; track d) { <option [value]="d" [selected]="d === r.dash">{{ d.replace('_', '-') }}</option> }
              </select>
            </div>
          }
        }
        @case ('visibility') {
          <p class="hint">Show this indicator on:</p>
          @for (iv of intervalsAll; track iv) {
            <label class="check"><input type="checkbox" [attr.data-interval]="iv" [checked]="shown().includes(iv)" (change)="toggleInterval(iv)" /> {{ iv === '1d' ? 'Daily' : 'Weekly' }}</label>
          }
          @if (intervalError()) { <span class="error" data-error="intervals" role="alert">Select at least one timeframe.</span> }
        }
      }

      <footer>
        <button type="button" class="btn ghost" data-reset (click)="reset()">Reset defaults</button>
        <span class="spacer"></span>
        <button type="button" class="btn" data-cancel (click)="closed.emit()">Cancel</button>
        <button type="button" class="btn primary" data-ok [disabled]="!valid()" (click)="ok()">OK</button>
      </footer>
    </app-modal>

    <ng-template #sel let-p="p">
      <select [id]="'p-' + p.key" [attr.data-param]="p.key" (change)="setParam(p.key, $any($event.target).value)">
        @for (c of p.choices ?? []; track c.value) { <option [value]="c.value" [selected]="c.value === values()[p.key]">{{ c.label }}</option> }
      </select>
    </ng-template>
  `,
  styles: [
    `
      .tabs { display: flex; gap: 0.25rem; margin-bottom: 0.75rem; border-bottom: 1px solid var(--c-border); }
      .tab { padding: 0.35rem 0.75rem; border: none; border-bottom: 2px solid transparent; background: transparent; color: var(--c-text-muted); cursor: pointer; font-size: 0.875rem; }
      .tab[aria-selected='true'] { color: var(--c-text); border-bottom-color: var(--c-primary); }
      .field { display: grid; grid-template-columns: 10rem 1fr; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem; }
      .field .error { grid-column: 2; }
      .row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.875rem; }
      .lbl { flex: 1; }
      input[type='number'], select { padding: 0.25rem 0.5rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-bg); color: var(--c-text); }
      input[type='color'] { width: 2.25rem; height: 1.75rem; padding: 0; border: 1px solid var(--c-border); background: transparent; }
      .check { display: block; margin-bottom: 0.4rem; font-size: 0.875rem; }
      .hint { color: var(--c-text-muted); font-size: 0.8125rem; }
      .error { color: var(--auth-error-color); font-size: 0.8125rem; }
      footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--c-border); }
      .spacer { flex: 1; }
      .btn { padding: 0.35rem 0.9rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .btn.primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .btn.ghost { border-color: transparent; color: var(--c-text-muted); }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    `,
  ],
})
export class IndicatorSettingsDialogComponent implements OnInit {
  readonly entry = input.required<IndicatorEntry>();
  readonly save = output<Partial<IndicatorEntry>>();
  readonly closed = output<void>();

  private readonly calc = inject(IndicatorCalculationService);
  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'inputs', label: 'Inputs' }, { id: 'style', label: 'Style' }, { id: 'visibility', label: 'Visibility' },
  ];
  readonly widths = WIDTHS;
  readonly dashes = DASHES;
  readonly intervalsAll = CHART_INTERVALS;
  readonly tab = signal<Tab>('inputs');

  private readonly resolved = computed(() => resolveEntry(this.entry()));
  readonly label = computed(() => this.resolved().label);
  private readonly def = computed<IndicatorDefinition>(() => this.calc.definition(this.resolved().definitionId));
  readonly specs = computed<ParameterSpec[]>(() => this.def().parameters);

  readonly values = signal<Record<string, unknown>>({});
  readonly rows = signal<StyleRow[]>([]);
  readonly shown = signal<string[]>([]);

  ngOnInit(): void { this.init(); }

  private init(): void {
    const e = this.entry();
    if (!e) return;
    this.applyState(e);
  }

  private applyState(e: IndicatorEntry): void {
    const r = resolveEntry(e);
    const base = this.calc.normalizeParams(r.definitionId, r.params as Record<string, never>);
    this.values.set({ ...base });
    this.rows.set(this.buildRows(e.styles ?? {}, base));
    this.shown.set(e.intervals ? [...e.intervals] : [...CHART_INTERVALS]);
  }

  /** Outputs that exist for the current parameters (Webby RSI has two modes). */
  private outputsFor(values: Record<string, unknown>): OutputSpec[] {
    const d = this.def();
    if (d.id !== 'webby_rsi') return d.outputs;
    const original = String(values['mode']).toLowerCase() === 'original';
    return d.outputs.filter((o) => WEBBY_ORIGINAL.includes(o.key) === original);
  }

  private buildRows(styles: Record<string, OutputStyle>, values: Record<string, unknown>): StyleRow[] {
    const overlay = this.resolved().kind === 'overlay';
    return this.outputsFor(values).map((o) => {
      const s = styles[o.key] ?? {};
      return {
        key: o.key, label: o.label,
        color: asHex(s.color ?? resolveColor(o.defaultColor)),
        width: s.width ?? (overlay ? 1.5 : o.defaultWidth),
        dash: s.dash ?? o.defaultLineStyle,
        visible: s.visible !== false,
        touched: { color: s.color !== undefined, width: s.width !== undefined, dash: s.dash !== undefined },
      };
    });
  }

  readonly errors = computed<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    const v = this.values();
    for (const p of this.specs()) {
      if (p.type !== 'integer' && p.type !== 'float') continue;
      const raw = v[p.key];
      const n = typeof raw === 'number' ? raw : NaN;
      const range = `${p.minimum ?? '−∞'} and ${p.maximum ?? '∞'}`;
      if (!Number.isFinite(n) || (p.type === 'integer' && !Number.isInteger(n)) ||
          (p.minimum !== undefined && n < p.minimum) || (p.maximum !== undefined && n > p.maximum)) {
        out[p.key] = `${p.type === 'integer' ? 'Whole number' : 'Number'} between ${range}.`;
      }
    }
    return out;
  });

  readonly intervalError = computed(() => this.shown().length === 0);
  readonly valid = computed(() => Object.keys(this.errors()).length === 0 && !this.intervalError());

  /** '' / non-numeric text stays NaN so the validator flags it instead of silently becoming 0. */
  numberOf(raw: string): number { return raw.trim() === '' ? NaN : Number(raw); }

  setParam(key: string, value: unknown): void {
    const next = { ...this.values(), [key]: value };
    this.values.set(next);
    if (key === 'mode') this.rows.set(this.buildRows(this.currentStyles(), next));
  }

  patchRow(key: string, patch: Partial<StyleRow>, touched?: 'color' | 'width' | 'dash'): void {
    this.rows.update((rows) => rows.map((r) => (r.key === key
      ? { ...r, ...patch, touched: touched ? { ...r.touched, [touched]: true } : r.touched }
      : r)));
  }

  toggleInterval(iv: string): void {
    this.shown.update((s) => (s.includes(iv) ? s.filter((x) => x !== iv) : [...s, iv]));
  }

  reset(): void {
    this.applyState({ type: this.entry().type, period: this.entry().period });
    // defaults for the definition, not the previous overrides
    const r = resolveEntry({ type: this.entry().type, period: this.entry().period });
    const base = this.calc.normalizeParams(r.definitionId, r.params as Record<string, never>);
    this.values.set({ ...base });
  }

  private currentStyles(): Record<string, OutputStyle> {
    const out: Record<string, OutputStyle> = {};
    for (const r of this.rows()) {
      const s: OutputStyle = { visible: r.visible };
      if (r.touched.color) s.color = r.color;
      if (r.touched.width) s.width = r.width;
      if (r.touched.dash) s.dash = r.dash;
      out[r.key] = s;
    }
    return out;
  }

  ok(): void {
    if (!this.valid()) return;
    const all = this.shown().length === CHART_INTERVALS.length;
    this.save.emit({
      params: this.values() as IndicatorEntry['params'],
      styles: this.currentStyles(),
      intervals: all ? undefined : [...this.shown()],
    });
    this.closed.emit();
  }
}
