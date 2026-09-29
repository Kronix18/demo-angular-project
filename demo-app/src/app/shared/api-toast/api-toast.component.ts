import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ApiErrorService } from '../../core/api/errors';
import { IconComponent } from '../icons/icon.component';

/** The single visible API error toast (task 12.3). Policy lives in `shouldToast`. */
@Component({
  selector: 'app-api-toast',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (errors.toast(); as t) {
      <div class="api-toast" data-api-toast role="status" aria-live="polite">
        <span class="msg">{{ t.message }}</span>
        <button type="button" data-api-toast-close aria-label="Dismiss" (click)="errors.dismiss()"><app-icon name="close" [size]="16" /></button>
      </div>
    }
  `,
  styles: [
    `
      :host { position: fixed; right: 16px; bottom: 16px; z-index: 1000; }
      .api-toast { display: flex; align-items: center; gap: 0.75rem; max-width: 360px; padding: 8px 14px; background: var(--c-danger-bg); color: var(--c-danger-text); border-left: 4px solid var(--c-danger); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low); font-size: 0.8125rem; }
      button { display: inline-flex; border: none; background: transparent; color: inherit; cursor: pointer; }
    `,
  ],
})
export class ApiToastComponent {
  protected readonly errors = inject(ApiErrorService);
}
