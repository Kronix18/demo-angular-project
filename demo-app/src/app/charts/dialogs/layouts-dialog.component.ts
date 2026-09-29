import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { LayoutService } from '../../core/services/layout.service';
import { ModalComponent } from './modal.component';

/** Layouts: save the current chart (state + drawings) under a name, load or delete saved ones. */
@Component({
  selector: 'app-layouts-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Layouts" (closed)="closed.emit()">
      <div class="save">
        <input data-layout-name placeholder="Layout name" aria-label="Layout name" [value]="name()" (input)="name.set($any($event.target).value)" (keydown.enter)="doSave()" />
        <button type="button" class="primary" data-layout-save [disabled]="!name().trim()" (click)="doSave()">Save</button>
      </div>
      @for (l of layouts.list(); track l.name) {
        <div class="row" data-layout-row [class.current]="l.name === layouts.current()">
          <button type="button" class="name" (click)="name.set(l.name)" title="Use this name (to overwrite it)">{{ l.name }}</button>
          <span class="when">{{ when(l.savedAt) }}</span>
          <button type="button" data-layout-load (click)="load.emit(l.name)">Load</button>
          <button type="button" data-layout-delete aria-label="Delete layout" (click)="remove.emit(l.name)">×</button>
        </div>
      } @empty { <p class="empty">No saved layouts yet.</p> }
    </app-modal>
  `,
  styles: [
    `
      .save { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
      .save input { flex: 1; padding: 0.35rem 0.6rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-bg); color: var(--c-text); }
      .row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; border-bottom: 1px solid var(--c-border); }
      .row.current .name { font-weight: 700; color: var(--c-primary); }
      .name { flex: 1; text-align: left; border: none; background: transparent; color: var(--c-text); cursor: pointer; font-size: 0.9rem; }
      .when { color: var(--c-text-muted); font-size: 0.75rem; }
      button { padding: 0.25rem 0.75rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .name { padding: 0; border: none; }
      .primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .primary:disabled { opacity: 0.5; cursor: default; }
      .empty { color: var(--c-text-muted); }
    `,
  ],
})
export class LayoutsDialogComponent {
  protected readonly layouts = inject(LayoutService);
  readonly save = output<string>();
  readonly load = output<string>();
  readonly remove = output<string>();
  readonly closed = output<void>();
  readonly name = signal(this.layouts.current());

  when(ts: number): string { return new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  doSave(): void { if (this.name().trim()) this.save.emit(this.name().trim()); }
}
