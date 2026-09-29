import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconComponent } from '../../shared/icons/icon.component';

export interface Toast { id: number; text: string; }

/** Small notifications at the bottom of the chart (alerts firing during replay). */
@Component({
  selector: 'app-chart-toasts',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (t of toasts(); track t.id) {
      <div class="toast" data-toast role="status" aria-live="polite">
        <span class="msg"><app-icon name="iconbell" [size]="16" />{{ t.text }}</span>
        <button type="button" aria-label="Dismiss" (click)="dismiss.emit(t.id)"><app-icon name="close" [size]="16" /></button>
      </div>
    }
  `,
  styles: [
    `
      :host { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%); z-index: 9; display: flex; flex-direction: column; gap: 6px; }
      .toast { display: flex; align-items: center; gap: 0.75rem; padding: 6px 12px; background: var(--c-tooltip-bg); color: var(--c-tooltip-text); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low); font-size: 0.8125rem; }
      .msg { display: inline-flex; align-items: center; gap: 0.4rem; }
      button { display: inline-flex; border: none; background: transparent; color: inherit; cursor: pointer; font-size: 1rem; line-height: 1; }
    `,
  ],
})
export class ChartToastsComponent {
  readonly toasts = input<Toast[]>([]);
  readonly dismiss = output<number>();
}
