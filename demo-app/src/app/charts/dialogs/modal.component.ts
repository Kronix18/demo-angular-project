import { IconComponent } from '../../shared/icons/icon.component';
import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, HostListener, inject, input, output } from '@angular/core';

/**
 * Minimal accessible modal shell (role=dialog, aria-modal, Esc / ✕ / backdrop
 * close, focus moves to the first field). Content is projected; the parent owns
 * whether it exists (`@if`), so "closed" only signals the intent.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="backdrop" data-backdrop (click)="closed.emit()">
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" class="x" data-modal-close aria-label="Close" (click)="closed.emit()"><app-icon name="close" [size]="18" /></button>
        </header>
        <div class="body"><ng-content /></div>
      </div>
    </div>
  `,
  styles: [
    `
      .backdrop {
        position: fixed; inset: 0; z-index: 1000; display: flex; align-items: flex-start; justify-content: center;
        padding-top: 8vh; background: var(--c-shadow-a40);
      }
      .dialog {
        display: flex; flex-direction: column; width: min(640px, 94vw); max-height: 80vh;
        background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border);
        border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low);
      }
      header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--c-border); }
      h2 { margin: 0; font-size: 1.05rem; font-weight: 600; }
      .x { display: inline-flex; align-items: center; border: none; background: transparent; color: var(--c-text-muted); font-size: 1.4rem; line-height: 1; cursor: pointer; }
      .x:hover { color: var(--c-text); }
      .body { padding: 1rem; overflow: auto; }
    `,
  ],
})
export class ModalComponent implements AfterViewInit {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit(): void {
    const first = this.host.nativeElement.querySelector<HTMLElement>('.body input, .body select, .body textarea, .body button');
    first?.focus();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.closed.emit();
  }
}
