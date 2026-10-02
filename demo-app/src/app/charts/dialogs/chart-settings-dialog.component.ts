import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { SESSIONS, TIMEZONES, ViewSettings, defaultView } from '../../core/models/view-settings';
import { ModalComponent } from './modal.component';

const OPTIONS: { key: keyof ViewSettings; label: string; group: string }[] = [
  { key: 'ohlc', label: 'OHLC values (status line)', group: 'Status line' },
  { key: 'lastPrice', label: 'Last price line and label', group: 'Scales' },
  { key: 'countdown', label: 'Countdown to bar close', group: 'Scales' },
  { key: 'gridV', label: 'Vertical grid lines', group: 'Canvas' },
  { key: 'gridH', label: 'Horizontal grid lines', group: 'Canvas' },
  { key: 'crosshair', label: 'Crosshair', group: 'Canvas' },
];

/** Chart settings (the gear): status line, scales and canvas options. Applies on OK; Reset switches everything on. */
@Component({
  selector: 'app-chart-settings-dialog',
  standalone: true,
  imports: [ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal title="Chart settings" (closed)="closed.emit()">
      @for (o of options; track o.key) {
        <div class="field">
          <label [for]="'v-' + o.key"><span class="grp">{{ o.group }}</span>{{ o.label }}</label>
          <input type="checkbox" [id]="'v-' + o.key" [attr.data-view]="o.key" [checked]="draft()[o.key]" (change)="set(o.key, $any($event.target).checked)" />
        </div>
      }
      <div class="field">
        <label for="v-tz"><span class="grp">Time</span>Time zone</label>
        <select id="v-tz" data-view-select="timezone" (change)="setEnum('timezone', $any($event.target).value)">
          @for (t of timezones; track t) { <option [value]="t" [selected]="draft().timezone === t">{{ tzLabel[t] }}</option> }
        </select>
      </div>
      <div class="field">
        <label for="v-se"><span class="grp">Time</span>Session (countdown)</label>
        <select id="v-se" data-view-select="session" (change)="setEnum('session', $any($event.target).value)">
          @for (s of sessions; track s) { <option [value]="s" [selected]="draft().session === s">{{ s === 'regular' ? 'Regular (16:00)' : 'Extended (20:00)' }}</option> }
        </select>
      </div>
      <footer>
        <button type="button" class="ghost" data-reset (click)="edits.set(defaults)">Reset</button>
        <span class="grow"></span>
        <button type="button" class="ghost" data-cancel (click)="closed.emit()">Cancel</button>
        <button type="button" class="primary" data-ok (click)="ok()">OK</button>
      </footer>
    </app-modal>
  `,
  styles: [
    `
      .field { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.4rem 0; }
      select { padding: 2px 6px; border: 1px solid var(--c-border); border-radius: var(--border-radius-sm); background: var(--c-surface); color: var(--c-text); }
      .grp { display: inline-block; min-width: 6.5rem; color: var(--c-text-muted); font-size: 0.75rem; }
      footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--c-border); }
      .grow { flex: 1; }
      button { padding: 0.35rem 0.9rem; border-radius: var(--border-radius-sm); border: 1px solid var(--c-border); background: var(--c-surface); color: var(--c-text); cursor: pointer; }
      .primary { background: var(--c-primary); border-color: var(--c-primary); color: var(--c-on-primary); }
    `,
  ],
})
export class ChartSettingsDialogComponent {
  readonly view = input.required<ViewSettings>();
  readonly save = output<ViewSettings>();
  readonly closed = output<void>();
  readonly options = OPTIONS;
  readonly defaults = defaultView();
  protected readonly edits = signal<ViewSettings | null>(null);
  readonly draft = computed<ViewSettings>(() => this.edits() ?? this.view());

  readonly timezones = TIMEZONES;
  readonly sessions = SESSIONS;
  readonly tzLabel = { exchange: 'Exchange (New York)', utc: 'UTC', local: 'Browser local' };

  set(k: keyof ViewSettings, v: boolean): void { this.edits.set({ ...this.draft(), [k]: v }); }
  setEnum(k: 'timezone' | 'session', v: string): void { this.edits.set({ ...this.draft(), [k]: v } as ViewSettings); }

  ok(): void {
    this.save.emit(this.draft());
    this.closed.emit();
  }
}
