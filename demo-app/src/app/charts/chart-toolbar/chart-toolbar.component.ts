import { Component, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AVAILABLE_SYMBOLS } from '../../core/services/chart-data.service';

/**
 * Chart toolbar (2.3): submit semantics — the symbol input emits only on
 * Enter/Update (never per keystroke); the interval select emits on change.
 * Handlers take the plain STRING value (ngModelChange passes the value, not
 * an event object — the pre-fix code read event.target.value on a string,
 * producing undefined). Defaults and the symbol list come from the demo data
 * contract (AVAILABLE_SYMBOLS, 0.3 spec) — no fake symbols, no dead deps.
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

      <div class="toolbar-group">
        <button type="button" (click)="submitSymbol()">Update Chart</button>
      </div>
    </div>
  `,
  styles: [
    `
      .toolbar {
        display: flex;
        gap: 1rem;
        align-items: center;
        padding: 1rem;
        background-color: var(--c-surface, #ffffff);
        border-radius: var(--border-radius, 8px);
        box-shadow: var(--shadow-elevation-low, 0 1px 4px rgba(0, 0, 0, 0.12));
      }

      .toolbar-group {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      label {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--c-text, #1f2937);
      }

      input,
      select {
        padding: 0.5rem;
        border: 1px solid var(--c-border, #d1d5db);
        border-radius: var(--border-radius-sm, 4px);
        background-color: var(--c-surface, #ffffff);
        color: var(--c-text, #1f2937);
        font-size: 0.875rem;
      }

      input:focus,
      select:focus {
        outline: none;
        border-color: var(--c-primary, #2563eb);
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
      }

      button {
        padding: 0.5rem 1rem;
        background-color: var(--c-primary, #2563eb);
        color: #fff;
        border: none;
        border-radius: var(--border-radius-sm, 4px);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
      }

      button:hover {
        background-color: var(--c-primary-dark, #1d4ed8);
      }
    `,
  ],
})
export class ChartToolbarComponent {
  @Output() symbolChange = new EventEmitter<string>();
  @Output() intervalChange = new EventEmitter<string>();

  // Demo-data default (msft has the largest dataset; AAPL does not exist).
  symbol = 'msft';
  interval = '1d';

  // Only symbols with demo data (0.3 spec) — drives the datalist.
  symbols = [...AVAILABLE_SYMBOLS];

  /** Enter key / Update button: emit ONCE with the current input value. */
  submitSymbol(): void {
    const value = (this.symbol || '').trim().toLowerCase();
    if (!value) return;
    this.symbol = value;
    this.symbolChange.emit(value);
  }

  /** ngModelChange passes the VALUE (string) — not an event object. */
  onIntervalChange(value: string): void {
    this.interval = value;
    this.intervalChange.emit(value);
  }
}
