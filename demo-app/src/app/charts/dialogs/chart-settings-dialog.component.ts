import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ViewSettings, defaultView } from '../../core/models/view-settings';
import { ModalComponent } from './modal.component';

const OPTIONS: { key: keyof ViewSettings; label: string; group: string }[] = [
  { key: 'ohlc', label: 'OHLC values (status line)', group: 'Status line' },
  { key: 'lastPrice', label: 'Last price line and label', group: 'Scales' },
  { key: 'gridV', label: 'Vertical grid lines', group: 'Canvas' },
  { key: 'gridH', label: 'Horizontal grid lines', group: 'Canvas' },
  { key: 'crosshair', label: 'Crosshair', group: 'Canvas' },
];

/** Chart settings (the gear): status line, scales and canvas options. Applies on OK; Reset switches everything on. */
@Component({
  selector: 'app-chart-settings-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Chart settings" (closed)="closed.emit()">
      @for (o of options; track o.key) {
        <div class="field">
          <label [for]="'v-' + o.key"><span class="grp">{{ o.group }}</span>{{ o.label }}</label>
          <input type="checkbox" [id]="'v-' + o.key" [attr.data-view]="o.key" [checked]="draft()[o.key]" (change)="set(o.key, $any($event.target).checked)" />
        </div>
      }
      <footer>
        <button type="button" class="ghost" data-reset (click)="edits.set(defaults)">Reset</button>
        <span class="grow"></span>
        <button type="button" class="ghost" data-cancel (click)="closed.emit()">Cancel</button>
        <button type="button" class="primary" data-ok (click)="ok()">OK</button>
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .field { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; }
      .grp { display: inline-block; min-width: 6.5rem; color: var(--c-text-muted); font-size: 0.75rem; }
      footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--c-border); }
      .grow { flex: 1; }
      button { padding: 0.35rem 0.9rem; border-radius: var(--border-radius-sm); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
    `,
  ],
})
export class ChartSettingsDialogComponent {
  readonly view = input.required<ViewSettings>();
  readonly save = output<ViewSettings>();
  readonly closed = output<void>();
  readonly options = OPTIONS;
  readonly defaults = defaultView();
  protected readonly edits = signal<ViewSettings | null>(null);
  readonly draft = computed<ViewSettings>(() => this.edits() ?? this.view());

  set(k: keyof ViewSettings, v: boolean): void { this.edits.set({ ...this.draft(), [k]: v }); }

  ok(): void {
    this.save.emit(this.draft());
    this.closed.emit();
  }
}
