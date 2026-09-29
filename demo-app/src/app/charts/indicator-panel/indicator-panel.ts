import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartStateService } from '../../core/services/chart-state.service';
import {
  INDICATOR_CATALOG, PERIOD_MAX, PERIOD_MIN, catalogItem, resolveEntry,
} from '../../core/indicators/indicator-catalog';

/**
 * Indicator panel: the ADD form (type + period, inline validation, duplicate
 * detection). The active indicators themselves — value, eye, remove — live in
 * the chart legend (10.2). Writes ChartStateService; the viewer derives from it.
 */
@Component({
  selector: 'app-indicator-panel',
  imports: [FormsModule],
  templateUrl: './indicator-panel.html',
  styleUrl: './indicator-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IndicatorPanel {
  private readonly chartState = inject(ChartStateService);

  readonly catalog = INDICATOR_CATALOG;
  /** Inline validation message (design-token styled, never alert()). */
  readonly error = signal<string | null>(null);

  type = 'sma';
  period = 20;

  get periodEnabled(): boolean {
    return catalogItem(this.type)?.usesPeriod ?? true;
  }

  onTypeChange(type: string): void {
    this.type = type;
    this.error.set(null);
    const item = catalogItem(type);
    if (item?.usesPeriod) this.period = item.defaultPeriod;
  }

  add(): void {
    const item = catalogItem(this.type);
    if (!item) return;
    const raw = Number(this.period);
    if (item.usesPeriod && (this.period === null || String(this.period).trim() === '' ||
        !Number.isInteger(raw) || raw < PERIOD_MIN || raw > PERIOD_MAX)) {
      this.error.set(`Period must be a whole number between ${PERIOD_MIN} and ${PERIOD_MAX}.`);
      return;
    }
    const period = item.usesPeriod ? raw : item.defaultPeriod;
    if (!this.chartState.addIndicator({ type: item.type, period })) {
      this.error.set(`${resolveEntry({ type: item.type, period }).label} is already on the chart.`);
      return;
    }
    this.error.set(null);
  }
}
