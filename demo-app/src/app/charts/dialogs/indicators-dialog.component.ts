import { ChangeDetectionStrategy, Component, computed, output, signal } from '@angular/core';
import { INDICATOR_CATALOG, CatalogItem } from '../../core/indicators/indicator-catalog';
import { ModalComponent } from './modal.component';

/**
 * Indicator picker (TradingView's "Indicators" panel): searchable, grouped by
 * category. Clicking an entry adds it and keeps the dialog open so several can
 * be added in a row; Enter adds the first match.
 */
@Component({
  selector: 'app-indicators-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Indicators" (closed)="closed.emit()">
      <input type="search" class="search" placeholder="Search indicators…" aria-label="Search indicators"
        [value]="query()" (input)="query.set($any($event.target).value)" (keydown.enter)="addFirst()" />
      @for (g of groups(); track g.category) {
        <h3 class="cat" data-category>{{ g.category }}</h3>
        @for (c of g.items; track c.type) {
          <button type="button" class="item" [attr.data-add-indicator]="c.type" (click)="add.emit(c.type)">
            <span class="name">{{ c.label }}</span>
            <span class="desc">{{ c.description }}</span>
            <span class="plus" aria-hidden="true">+</span>
          </button>
        }
      } @empty {
        <p class="empty" data-empty>No indicators match "{{ query() }}".</p>
      }
    </app-modal>
  `,
  styles: [
    `
      .search { width: 100%; box-sizing: border-box; padding: 0.5rem 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm); background: var(--c-bg); color: var(--c-text); font-size: 0.95rem; }
      .cat { margin: 0.75rem 0 0.25rem; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--c-text-muted); }
      .item { display: flex; align-items: baseline; gap: 0.75rem; width: 100%; padding: 0.4rem 0.5rem; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); text-align: left; cursor: pointer; font-size: 0.875rem; }
      .item:hover, .item:focus-visible { background: var(--c-primary-tint); }
      .name { flex: none; min-width: 6.5rem; font-weight: 600; }
      .desc { flex: 1; color: var(--c-text-muted); }
      .plus { color: var(--c-primary); font-size: 1.1rem; }
      .empty { color: var(--c-text-muted); }
    `,
  ],
})
export class IndicatorsDialogComponent {
  readonly add = output<string>();
  readonly closed = output<void>();
  readonly query = signal('');

  private readonly matches = computed<CatalogItem[]>(() => {
    const q = this.query().trim().toLowerCase();
    if (!q) return INDICATOR_CATALOG;
    // rank: name matches first, then category, then description
    const rank = (c: CatalogItem) =>
      [c.label, c.type].some((t) => t.toLowerCase().includes(q)) ? 0 : c.category.toLowerCase().includes(q) ? 1 : c.description.toLowerCase().includes(q) ? 2 : 3;
    return INDICATOR_CATALOG.filter((c) => rank(c) < 3).sort((a, b) => rank(a) - rank(b));
  });

  readonly groups = computed(() => {
    const out: { category: string; items: CatalogItem[] }[] = [];
    for (const c of this.matches()) {
      let g = out.find((x) => x.category === c.category);
      if (!g) out.push((g = { category: c.category, items: [] }));
      g.items.push(c);
    }
    return out;
  });

  addFirst(): void {
    const first = this.matches()[0];
    if (first) this.add.emit(first.type);
  }
}
