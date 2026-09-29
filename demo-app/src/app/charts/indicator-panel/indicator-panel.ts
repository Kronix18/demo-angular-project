import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChartStateService } from '../../core/services/chart-state.service';
import {
  INDICATOR_CATALOG, IndicatorEntry, ResolvedIndicator, catalogItem, resolveEntry,
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
    const item = catalogItem(type);
    if (item?.usesPeriod) this.period = item.defaultPeriod;
  }

  add(): void {
    const item = catalogItem(this.type);
    if (!item) return;
    const period = item.usesPeriod ? Math.floor(Number(this.period)) : item.defaultPeriod;
    if (item.usesPeriod && (!Number.isFinite(period) || period < 1)) return;
    this.chartState.addIndicator({ type: item.type, period });
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
