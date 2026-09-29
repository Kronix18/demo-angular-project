import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { AVAILABLE_SYMBOLS } from '../../core/services/chart-data.service';
import { ModalComponent } from './modal.component';

/** `  MSFT.US ` → `msft` */
export const cleanSymbol = (q: string): string => q.trim().toLowerCase().replace(/\.us$/, '');

/**
 * Symbol search (TradingView-style): opens as soon as the user starts typing on
 * the chart, with that first character already in the box. Filters the demo
 * symbols live (exact > prefix > contains); an unknown query offers "Go to X"
 * so the chart can show its unknown-symbol card. Arrows + Enter, Esc closes.
 */
@Component({
  selector: 'app-symbol-search-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Symbol search" (closed)="closed.emit()">
      <input type="search" class="search" placeholder="Search symbol…" aria-label="Search symbol" autocomplete="off" spellcheck="false"
        [value]="query()" (input)="onInput($any($event.target).value)" (keydown)="onKey($event)" />
      <div class="list" role="listbox">
        @for (s of matches(); track s; let i = $index) {
          <button type="button" role="option" class="option" [class.active]="i === highlight()" [class.current]="s === current()"
            [attr.data-symbol-option]="s" [attr.aria-selected]="i === highlight()" (click)="pick.emit(s)">
            <span class="sym">{{ s.toUpperCase() }}</span>
            <span class="note">{{ s === current() ? 'current · demo data' : 'demo data' }}</span>
          </button>
        }
        @if (!matches().length && clean()) {
          <button type="button" class="option go" data-go (click)="pick.emit(clean())">Go to <b>{{ clean().toUpperCase() }}</b></button>
        }
      </div>
    </app-modal>
  `,
  styles: [
    `
      .search { width: 100%; box-sizing: border-box; padding: 0.55rem 0.75rem; margin-bottom: 0.5rem; border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm); background: var(--c-bg); color: var(--c-text); font-size: 1.05rem; text-transform: uppercase; }
      .list { display: flex; flex-direction: column; }
      .option { display: flex; justify-content: space-between; align-items: baseline; padding: 0.45rem 0.6rem; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; text-align: left; font-size: 0.95rem; }
      .option:hover, .option.active { background: var(--c-primary-tint); }
      .option.current .sym { color: var(--c-primary); }
      .sym { font-weight: 600; }
      .note { color: var(--c-text-muted); font-size: 0.8125rem; }
    `,
  ],
})
export class SymbolSearchDialogComponent implements OnInit, AfterViewInit {
  readonly initial = input('');
  readonly current = input('');
  readonly pick = output<string>();
  readonly closed = output<void>();

  readonly query = signal('');
  readonly highlight = signal(-1);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly clean = computed(() => cleanSymbol(this.query()));
  readonly matches = computed<string[]>(() => {
    const q = this.clean();
    const all = [...AVAILABLE_SYMBOLS] as string[];
    if (!q) return all;
    const rank = (s: string) => (s === q ? 0 : s.startsWith(q) ? 1 : s.includes(q) ? 2 : 3);
    return all.filter((s) => rank(s) < 3).sort((a, b) => rank(a) - rank(b));
  });

  ngOnInit(): void { this.query.set(this.initial()); }

  ngAfterViewInit(): void {
    // the modal focused the box; put the caret after the pre-typed character
    const input = this.host.nativeElement.querySelector<HTMLInputElement>('input[type="search"]');
    if (input) input.setSelectionRange(input.value.length, input.value.length);
  }

  onInput(v: string): void {
    this.query.set(v);
    this.highlight.set(-1);
  }

  onKey(e: KeyboardEvent): void {
    const n = this.matches().length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); this.highlight.set((this.highlight() + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); this.highlight.set(this.highlight() <= 0 ? n - 1 : this.highlight() - 1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const m = this.matches();
      // with an empty box Enter only acts on an explicitly highlighted row
      if (m.length && (this.clean() || this.highlight() >= 0)) this.pick.emit(m[Math.max(this.highlight(), 0)]);
      else if (this.clean()) this.pick.emit(this.clean());
    }
  }
}
