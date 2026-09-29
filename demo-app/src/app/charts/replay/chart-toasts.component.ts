import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface Toast { id: number; text: string; }

/** Small notifications at the bottom of the chart (alerts firing during replay). */
@Component({
  selector: 'app-chart-toasts',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts(); track t.id) {
      <div class="toast" data-toast role="status" aria-live="polite">
        <span>🔔 {{ t.text }}</span>
        <button type="button" aria-label="Dismiss" (click)="dismiss.emit(t.id)">×</button>
      </div>
    }
  `,
  styles: [
    `
      :host { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; gap: 6px; }
      .toast { display: flex; align-items: center; gap: 0.75rem; padding: 6px 12px; background: var(--c-tooltip-bg); color: var(--c-tooltip-text); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low); font-size: 0.8125rem; }
      button { border: none; background: transparent; color: inherit; cursor: pointer; font-size: 1rem; line-height: 1; }
    `,
  ],
})
export class ChartToastsComponent {
  readonly toasts = input<Toast[]>([]);
  readonly dismiss = output<number>();
}
