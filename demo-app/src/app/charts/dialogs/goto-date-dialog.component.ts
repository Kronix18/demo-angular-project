import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ModalComponent } from './modal.component';

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Go to date: pick a day; the chart centres on the nearest bar. Dates outside the data are clamped into it. */
@Component({
  selector: 'app-goto-date-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Go to date" (closed)="closed.emit()">
      <div class="field">
        <label for="goto-date">Date</label>
        <input id="goto-date" type="date" data-goto-input [min]="minIso()" [max]="maxIso()" [value]="value()"
          (input)="value.set($any($event.target).value)" (keydown)="onKey($event)" />
      </div>
      <footer>
        <button type="button" class="ghost" data-cancel (click)="closed.emit()">Cancel</button>
        <button type="button" class="primary" data-ok [disabled]="!valid()" (click)="ok()">Go</button>
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .field { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; }
      input { padding: 4px 8px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); }
      footer { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--c-border); }
      button { padding: 0.35rem 0.9rem; border-radius: var(--border-radius-sm); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .primary:disabled { opacity: 0.5; cursor: default; }
    `,
  ],
})
export class GotoDateDialogComponent {
  readonly min = input.required<number>();
  readonly max = input.required<number>();
  readonly pick = output<number>();
  readonly closed = output<void>();
  readonly value = signal('');
  readonly minIso = computed(() => iso(this.min()));
  readonly maxIso = computed(() => iso(this.max()));
  readonly valid = computed(() => /^\d{4}-\d{2}-\d{2}$/.test(this.value()) && !Number.isNaN(Date.parse(this.value())));

  onKey(e: KeyboardEvent): void { if (e.key === 'Enter') this.ok(); }

  ok(): void {
    if (!this.valid()) return;
    const ts = Math.min(this.max(), Math.max(this.min(), Date.parse(this.value())));
    this.pick.emit(ts);
    this.closed.emit();
  }
}
