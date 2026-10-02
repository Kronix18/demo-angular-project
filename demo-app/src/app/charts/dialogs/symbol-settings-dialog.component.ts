import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { LINE_WIDTHS, PRICE_SOURCES, PriceSettings, VolumeSettings, sanitizePrice, sanitizeVolume } from '../../core/models/symbol-settings';
import { cssVar } from '../chart-theme';
import { ModalComponent } from './modal.component';

type Draft = PriceSettings & VolumeSettings;
const SOURCE_LABELS: Record<string, string> = {
  close: 'Close', open: 'Open', high: 'High', low: 'Low', hl2: 'HL/2', hlc3: 'HLC/3', ohlc4: 'OHLC/4',
};

/** `#rrggbb` for <input type=color>; theme colours that are not plain hex fall back to the text colour. */
const asHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : cssVar('--c-text'));

/**
 * Settings of the main price series ("symbol") and of the volume histogram:
 * up/down colours, colouring by previous close, thickness, and (line styles)
 * the plotted source and line colour. Applies on OK; Reset restores the theme.
 */
@Component({
  selector: 'app-symbol-settings-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="title()" (closed)="closed.emit()">
      @if (kind() === 'price' && lineLike()) {
        <div class="field">
          <label for="s-src">Source</label>
          <select id="s-src" data-set="source" (change)="patch({ source: $any($event.target).value })">
            @for (s of sources; track s) { <option [value]="s" [selected]="(draft().source ?? 'close') === s">{{ sourceLabels[s] }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="s-line">Line colour</label>
          <input id="s-line" type="color" data-set="line" [value]="draft().line ?? themeHex('--c-price-line')" (input)="patch({ line: $any($event.target).value })" />
        </div>
      } @else {
        <div class="field">
          <label for="s-up">Rising colour</label>
          <input id="s-up" type="color" data-set="up" [value]="draft().up ?? themeHex('--c-up')" (input)="patch({ up: $any($event.target).value })" />
        </div>
        <div class="field">
          <label for="s-down">Falling colour</label>
          <input id="s-down" type="color" data-set="down" [value]="draft().down ?? themeHex('--c-down')" (input)="patch({ down: $any($event.target).value })" />
        </div>
        <div class="field">
          <label for="s-prev">Colour based on previous close</label>
          <input id="s-prev" type="checkbox" data-set="prev" [checked]="draft().byPrevClose === true" (change)="patch({ byPrevClose: $any($event.target).checked })" />
        </div>
      }
      @if (kind() === 'price') {
        <div class="field">
          <label for="s-w">{{ lineLike() ? 'Line width' : 'Line / border width' }}</label>
          <select id="s-w" data-set="width" (change)="patch({ width: +$any($event.target).value })">
            @for (w of widths; track w) { <option [value]="w" [selected]="draft().width === w">{{ w }}px</option> }
          </select>
        </div>
      }
      <footer>
        <button type="button" class="ghost" data-reset (click)="edits.set({})">Reset</button>
        <span class="grow"></span>
        <button type="button" class="ghost" data-cancel (click)="closed.emit()">Cancel</button>
        <button type="button" class="primary" data-ok (click)="ok()">OK</button>
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .field { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; }
      label { color: var(--c-text); }
      select, input[type='color'] { padding: 2px 6px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); }
      footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--c-border); }
      .grow { flex: 1; }
      button { padding: 0.35rem 0.9rem; border-radius: var(--border-radius-sm); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
    `,
  ],
})
export class SymbolSettingsDialogComponent {
  readonly kind = input.required<'price' | 'volume'>();
  readonly settings = input<PriceSettings | VolumeSettings>({});
  /** Line-family styles show source + line colour instead of up/down colours. */
  readonly lineLike = input(false);
  readonly save = output<PriceSettings | VolumeSettings>();
  readonly closed = output<void>();

  readonly sources = PRICE_SOURCES;
  readonly sourceLabels = SOURCE_LABELS;
  readonly widths = LINE_WIDTHS;
  protected readonly edits = signal<Draft | null>(null);
  /** Working copy; starts from the input, replaced wholesale on edit / reset. */
  readonly draft = computed<Draft>(() => this.edits() ?? { ...this.settings() });
  readonly title = computed(() => (this.kind() === 'price' ? 'Symbol settings' : 'Volume settings'));

  themeHex(name: string): string { return asHex(cssVar(name)); }

  patch(p: Draft): void { this.edits.set({ ...this.draft(), ...p }); }

  ok(): void {
    const d = this.draft();
    this.save.emit(this.kind() === 'price' ? sanitizePrice(d) : sanitizeVolume(d));
    this.closed.emit();
  }
}
