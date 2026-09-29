import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChartStateService } from '../../core/services/chart-state.service';
import {
  INDICATOR_CATALOG, IndicatorEntry, PERIOD_MAX, PERIOD_MIN, ResolvedIndicator, catalogItem, resolveEntry,
} from '../../core/indicators/indicator-catalog';

/**
 * Indicator panel (5.2): lists the ACTIVE indicators from ChartStateService
 * (single source of truth, persisted) and lets the user add/remove them. The
 * viewer derives overlays/panes from the same state — this component only
 * writes state. Full management UX (menus, params, visibility) is 5.3.
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
  readonly rows = signal<{ index: number; resolved: ResolvedIndicator }[]>([]);

  /** Inline validation message (design-token styled, never alert()). */
  readonly error = signal<string | null>(null);

  type = 'sma';
  period = 20;

  constructor() {
    this.chartState.state$.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((s) => {
      this.rows.set(this.toRows(s.indicators));
    });
  }

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

  remove(index: number): void {
    this.chartState.removeIndicator(index);
  }

  private toRows(entries: IndicatorEntry[]) {
    const out: { index: number; resolved: ResolvedIndicator }[] = [];
    entries.forEach((entry, index) => {
      try {
        out.push({ index, resolved: resolveEntry(entry) });
      } catch {
        // stale/unknown entry rehydrated from sessionStorage — skip instead of crashing
      }
    });
    return out;
  }
}
