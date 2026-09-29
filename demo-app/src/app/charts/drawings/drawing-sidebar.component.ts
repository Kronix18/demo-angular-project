import { Component, input, output } from '@angular/core';
import { Tool } from './drawing-controller';

/** TradingView-style left sidebar: drawing tools plus magnet / stay-in-drawing / lock / hide / delete-all. */
@Component({
  selector: 'app-drawing-sidebar',
  standalone: true,
  template: `
    <div class="draw-tools" role="group" aria-label="Drawing tools">
      @for (t of tools(); track t.id) {
        <button type="button" class="draw-btn" [attr.data-tool]="t.id" [attr.aria-pressed]="tool() === t.id"
          [attr.aria-label]="t.title" [title]="t.title" (click)="pick.emit(t.id)">{{ t.icon }}</button>
      }
      <span class="draw-sep" aria-hidden="true"></span>
      <button type="button" class="draw-btn" data-magnet [attr.aria-pressed]="magnet()" aria-label="Magnet: snap the crosshair and new drawings to the bar's OHLC"
        title="Magnet: snap the crosshair and new drawings to the bar's OHLC" (click)="magnetToggle.emit()">🧲</button>
      <button type="button" class="draw-btn" data-keep [attr.aria-pressed]="keep()" aria-label="Stay in drawing mode"
        title="Stay in drawing mode after each drawing" (click)="keepToggle.emit()">⟳</button>
      <button type="button" class="draw-btn" data-lock [attr.aria-pressed]="locked()" aria-label="Lock all drawings"
        title="Lock all drawings (no selecting, moving or deleting)" (click)="lockToggle.emit()">🔒</button>
      <button type="button" class="draw-btn" data-hide [attr.aria-pressed]="hidden()" aria-label="Hide all drawings"
        title="Hide all drawings" (click)="hideToggle.emit()">👁</button>
      <button type="button" class="draw-btn" data-tool-clear aria-label="Delete all drawings on this symbol"
        title="Delete all drawings on this symbol" (click)="clear.emit()">⌫</button>
    </div>
  `,
  styles: [
    `
      :host { position: absolute; left: 4px; top: 50%; transform: translateY(-50%); z-index: 4; }
      .draw-tools {
        display: flex; flex-direction: column; gap: 2px; padding: 2px;
        background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--border-radius);
      }
      .draw-btn {
        width: 28px; height: 28px; padding: 0; border: none; border-radius: var(--border-radius-sm);
        background: transparent; color: var(--c-text); cursor: pointer; font-size: 1rem; line-height: 1;
      }
      .draw-btn:hover { background: var(--c-primary-tint); color: var(--c-primary); }
      .draw-btn[aria-pressed='true'] { background: var(--c-primary); color: var(--c-on-primary); }
      .draw-sep { height: 1px; margin: 2px 4px; background: var(--c-border); }
    `,
  ],
})
export class DrawingSidebarComponent {
  readonly tools = input.required<{ id: Tool; icon: string; title: string }[]>();
  readonly tool = input.required<Tool>();
  readonly magnet = input(false);
  readonly keep = input(false);
  readonly locked = input(false);
  readonly hidden = input(false);
  readonly pick = output<Tool>();
  readonly magnetToggle = output<void>();
  readonly keepToggle = output<void>();
  readonly lockToggle = output<void>();
  readonly hideToggle = output<void>();
  readonly clear = output<void>();
}
