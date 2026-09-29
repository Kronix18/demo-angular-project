import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export interface ReplayState { index: number; playing: boolean; speed: number; }
export const REPLAY_SPEEDS = [1, 3, 10, 30];

/** Bar replay controls: play / pause, step back / forward, position slider, speed, exit. Presentational. */
@Component({
  selector: 'app-replay-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="bar" data-replay-bar role="group" aria-label="Bar replay">
      <span class="title">Replay</span>
      <button type="button" data-replay-back title="Step back" aria-label="Step back" (click)="step.emit(-1)">⏮</button>
      <button type="button" data-replay-play [attr.aria-pressed]="state().playing" [title]="state().playing ? 'Pause' : 'Play'" [attr.aria-label]="state().playing ? 'Pause' : 'Play'" (click)="playToggle.emit()">{{ state().playing ? '⏸' : '▶' }}</button>
      <button type="button" data-replay-step title="Step forward" aria-label="Step forward" (click)="step.emit(1)">⏭</button>
      <input type="range" data-replay-slider aria-label="Replay position" min="0" [max]="max()" [value]="state().index" (input)="seek.emit(+$any($event.target).value)" />
      <span class="date" data-replay-date>{{ date() }}</span>
      <select data-replay-speed aria-label="Speed" (change)="speed.emit(+$any($event.target).value)">
        @for (s of speeds; track s) { <option [value]="s" [selected]="state().speed === s">{{ s }}x</option> }
      </select>
      <button type="button" data-replay-exit title="Exit replay" aria-label="Exit replay" (click)="exit.emit()">✕</button>
    </div>
  `,
  styles: [
    `
      .bar { display: flex; align-items: center; gap: 0.5rem; padding: 2px 0.5rem; background: var(--c-surface); border-bottom: 1px solid var(--c-pane-border); font-size: 0.8125rem; color: var(--c-text); }
      .title { font-weight: 600; color: var(--c-primary); }
      button, select { padding: 1px 8px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      button[aria-pressed='true'] { background: var(--c-primary); color: var(--c-on-primary); }
      input[type='range'] { flex: 1; min-width: 6rem; max-width: 30rem; }
      .date { min-width: 6rem; font-variant-numeric: tabular-nums; color: var(--c-text-muted); }
    `,
  ],
})
export class ReplayBarComponent {
  readonly state = input.required<ReplayState>();
  readonly max = input(0);
  readonly date = input('');
  readonly speeds = REPLAY_SPEEDS;
  readonly step = output<number>();
  readonly playToggle = output<void>();
  readonly seek = output<number>();
  readonly speed = output<number>();
  readonly exit = output<void>();
}
