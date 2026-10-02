import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Loading skeleton and error card that cover the chart panel (unknown symbol, no data, load failure). */
@Component({
  selector: 'app-chart-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <div class="loading-overlay skeleton" role="status" aria-live="polite">
        <span class="skeleton-label">Loading chart...</span>
      </div>
    }
    @if (error() && !loading()) {
      <div class="error-message">
        <div class="error-card" role="alert">
          <h2>{{ title() }}</h2>
          <p>{{ error() }}</p>
          @if (kind() === 'unknown-symbol') {
            <p class="hint">Available symbols:</p>
            <div class="symbol-list">
              @for (s of symbols(); track s) {
                <button type="button" class="symbol-btn" [attr.data-symbol]="s" (click)="pick.emit(s)">{{ s }}</button>
              }
            </div>
          }
          <button type="button" class="retry-btn" data-retry (click)="retry.emit()">Retry</button>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .loading-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--c-surface);
        z-index: 5;
      }
      /* CSS-only shimmer skeleton: pane-shaped placeholder while loading */
      .skeleton {
        background: linear-gradient(
          100deg,
          var(--c-surface) 30%,
          var(--c-grid) 50%,
          var(--c-surface) 70%
        );
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
      }
      .skeleton-label { color: var(--c-text-muted); font-size: 0.875rem; }
      @keyframes shimmer { to { background-position: -200% 0; } }
      .error-message {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 6;
      }
      .error-card {
        max-width: 32rem;
        padding: 1.25rem 1.5rem;
        text-align: center;
        border: 1px solid var(--c-pane-border);
        border-radius: var(--border-radius);
        background: var(--c-surface);
        color: var(--c-text);
      }
      .error-card h2 { margin: 0 0 0.5rem; font-size: 1.125rem; color: var(--auth-error-color); }
      .error-card p { margin: 0.25rem 0; }
      .hint { color: var(--c-text-muted); font-size: 0.8125rem; }
      .symbol-list { display: flex; flex-wrap: wrap; gap: 0.375rem; justify-content: center; margin: 0.5rem 0 0.75rem; }
      .symbol-btn, .retry-btn {
        padding: 0.25rem 0.75rem;
        border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm);
        background: var(--c-surface);
        color: var(--c-text);
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .retry-btn { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
      .symbol-btn:hover { border-color: var(--c-primary); color: var(--c-primary); }
    `,
  ],
})
export class ChartStatusComponent {
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly title = input('');
  readonly kind = input<string | null>('');
  readonly symbols = input<readonly string[]>([]);
  readonly pick = output<string>();
  readonly retry = output<void>();
}
