import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AVAILABLE_SYMBOLS } from '../../core/services/chart-data.service';
import { ChartStateService } from '../../core/services/chart-state.service';
import { RANGE_PRESETS } from '../../core/services/data-aggregation';

/**
 * Chart toolbar (4.2): a DUMB component — writes to ChartStateService (the
 * single source of truth), keeps submit semantics (symbol emits once on
 * Enter/Update, never per keystroke). Form values initialize FROM the store.
 * No @Output events: the viewer derives loads from state changes (4.2 wiring).
 */
@Component({
  selector: 'app-chart-toolbar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <label for="symbol">Symbol:</label>
        <input
          type="text"
          id="symbol"
          name="symbol"
          list="symbol-list"
          [(ngModel)]="symbol"
          (keydown.enter)="submitSymbol()"
          placeholder="e.g. msft"
          autocomplete="off"
        />
        <datalist id="symbol-list">
          @for (s of symbols; track s) {
            <option [value]="s"></option>
          }
        </datalist>
      </div>

      <div class="toolbar-group">
        <label for="interval">Interval:</label>
        <select id="interval" name="interval" [(ngModel)]="interval" (ngModelChange)="onIntervalChange($event)">
          <option value="1m" disabled title="Intraday data requires the backend API (not in demo)">1 Minute</option>
          <option value="5m" disabled title="Intraday data requires the backend API (not in demo)">5 Minutes</option>
          <option value="1h" disabled title="Intraday data requires the backend API (not in demo)">1 Hour</option>
          <option value="1d">1 Day</option>
          <option value="1w">1 Week</option>
        </select>
      </div>

      <!-- 4.3: range presets (last-bar-anchored; client-side slice) -->
      <div class="toolbar-group range-group" role="group" aria-label="Time range">
        @for (r of ranges; track r) {
          <button
            type="button"
            class="range-btn"
            [class.active]="range === r"
            (click)="onRangeChange(r)"
          >{{ r }}</button>
        }
      </div>

      <div class="toolbar-group">
        <button type="button" (click)="submitSymbol()">Update Chart</button>
      </div>
    </div>
  `,
  styles: [
    `
      /* Compact single-row toolbar (chart page is full-viewport): inline
         controls, labels kept for a11y but visually hidden. */
      :host { display: block; }
      .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem 0.75rem;
        align-items: center;
      }

      .toolbar-group {
        display: flex;
        flex-direction: row;
        align-items: center;
        gap: 0.25rem;
      }

      label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      /* 4.3: range preset buttons — TradingView-style row */
      .range-group { gap: 0.125rem; }
      .range-btn {
        padding: 0.1875rem 0.5rem;
        border: 1px solid transparent;
        border-radius: var(--border-radius-sm);
        background: transparent;
        color: var(--c-text);
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
      }
      .range-btn:hover {
        background: var(--c-primary-tint);
        color: var(--c-primary);
      }
      .range-btn.active {
        background: var(--c-primary);
        color: var(--c-on-primary);
      }

      input,
      select {
        padding: 0.1875rem 0.5rem;
        border: 1px solid var(--c-border);
        border-radius: var(--border-radius-sm);
        background-color: var(--c-surface);
        color: var(--c-text);
        font-size: 0.8125rem;
      }
      input#symbol { width: 6.5rem; }

      input:focus,
      select:focus {
        outline: none;
        border-color: var(--c-primary);
        box-shadow: 0 0 0 2px var(--c-focus-ring);
      }

      button:not(.range-btn) {
        padding: 0.1875rem 0.75rem;
        background-color: var(--c-primary);
        color: var(--c-on-primary);
        border: none;
        border-radius: var(--border-radius-sm);
        cursor: pointer;
        font-size: 0.8125rem;
        font-weight: 500;
      }

      button:not(.range-btn):hover {
        background-color: var(--c-primary-dark);
      }
    `,
  ],
})
export class ChartToolbarComponent {
  // 4.2: no @Output events — the store is the output channel.
  symbol = 'msft';
  interval = '1d';
  // 4.3: range presets from the aggregation module; active state from the store.
  ranges = [...RANGE_PRESETS];
  range: string = '6m';

  // Only symbols with demo data (0.3 spec) — drives the datalist.
  symbols = [...AVAILABLE_SYMBOLS];

  constructor(private store: ChartStateService) {
    // Initialize form values FROM the store (rehydration: refresh keeps the
    // user's symbol/interval — single source of truth).
    const snap = this.store.snapshot();
    this.symbol = snap.symbol;
    this.interval = snap.interval;
    this.range = snap.range;
    // ...and keep following it: the route param, the error card's symbol picker
    // and reset() all write the store after this component was constructed.
    this.store.state$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((s) => {
      this.symbol = s.symbol;
      this.interval = s.interval;
      this.range = s.range;
    });
  }

  /** Enter key / Update button: write the store ONCE with the current input value. */
  submitSymbol(): void {
    const value = (this.symbol || '').trim().toLowerCase();
    if (!value) return;
    this.symbol = value;
    this.store.setSymbol(value);
  }

  /** ngModelChange passes the VALUE (string) — write the store. */
  onIntervalChange(value: string): void {
    this.interval = value;
    this.store.setInterval(value);
  }

  /** 4.3: range preset button — write the store. */
  onRangeChange(range: string): void {
    this.range = range;
    this.store.setRange(range);
  }
}
