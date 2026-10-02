import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { INDICATOR_CATALOG, CatalogItem, IndicatorEntry } from '../../core/indicators/indicator-catalog';
import { IndicatorTemplateService } from '../../core/services/indicator-template.service';
import { IconComponent } from '../../shared/icons/icon.component';
import { ModalComponent } from './modal.component';

/**
 * Indicator picker (TradingView's "Indicators" panel): searchable, grouped by
 * category. Clicking an entry adds it and keeps the dialog open so several can
 * be added in a row; Enter adds the first match.
 */
@Component({
  selector: 'app-indicators-dialog',
  standalone: true,
  imports: [ModalComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Indicators" (closed)="closed.emit()">
      <section class="tpl" data-tpl-section aria-label="Templates">
        <h3 class="cat">Templates</h3>
        <div class="tpl-save">
          <input data-tpl-name placeholder="Template name" aria-label="Template name" [value]="tplName()" (input)="tplName.set($any($event.target).value)" />
          <button type="button" data-tpl-save [disabled]="!tplName().trim() || !current().length" (click)="saveTemplate()">Save chart indicators</button>
        </div>
        @for (t of templates.list(); track t.name) {
          <div class="tpl-row" data-tpl-row>
            <button type="button" class="tpl-name" data-tpl-apply title="Replace the chart's indicators with this template" (click)="applyTemplate.emit(t.indicators)">{{ t.name }}</button>
            <span class="tpl-n">{{ t.indicators.length }} {{ t.indicators.length === 1 ? 'indicator' : 'indicators' }}</span>
            <button type="button" class="tpl-del" data-tpl-delete aria-label="Delete template" (click)="templates.remove(t.name)"><app-icon name="close" [size]="14" /></button>
          </div>
        }
      </section>
      <input type="search" class="search" placeholder="Search indicators…" aria-label="Search indicators"
        [value]="query()" (input)="query.set($any($event.target).value)" (keydown.enter)="addFirst()" />
      @for (g of groups(); track g.category) {
        <h3 class="cat" data-category>{{ g.category }}</h3>
        @for (c of g.items; track c.type) {
          <button type="button" class="item" [attr.data-add-indicator]="c.type" (click)="add.emit(c.type)">
            <span class="name">{{ c.label }}</span>
            <span class="desc">{{ c.description }}</span>
            <span class="plus" aria-hidden="true"><app-icon name="plus" [size]="16" /></span>
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
      .plus { display: inline-flex; color: var(--c-primary); }
      .empty { color: var(--c-text-muted); }
      .tpl { margin-bottom: 0.75rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--c-border); }
      .tpl-save { display: flex; gap: 0.5rem; }
      .tpl-save input { flex: 1; padding: 0.3rem 0.6rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-bg); color: var(--c-text); }
      .tpl-del { display: inline-flex; align-items: center; }
      .tpl-save button, .tpl-del { padding: 0.25rem 0.6rem; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .tpl-save button:disabled { opacity: 0.5; cursor: default; }
      .tpl-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.2rem 0; }
      .tpl-name { flex: 1; text-align: left; border: none; background: transparent; color: var(--c-primary); cursor: pointer; font-weight: 600; }
      .tpl-n { color: var(--c-text-muted); font-size: 0.75rem; }
    `,
  ],
})
export class IndicatorsDialogComponent {
  protected readonly templates = inject(IndicatorTemplateService);
  /** the indicators on the chart (what "save template" stores) */
  readonly current = input<IndicatorEntry[]>([]);
  readonly applyTemplate = output<IndicatorEntry[]>();
  readonly tplName = signal('');
  readonly add = output<string>();
  readonly closed = output<void>();
  readonly query = signal('');

  saveTemplate(): void {
    if (this.templates.save(this.tplName(), this.current())) this.tplName.set('');
  }

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
