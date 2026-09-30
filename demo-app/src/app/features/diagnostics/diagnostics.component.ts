import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EntitlementsService } from '../../core/api/entitlements.service';
import { MetaService } from '../../core/api/meta.service';
import { IfDatasetDirective, IfFeatureDirective } from '../../shared/gating/gating';

const DATASETS = ['security_master', 'prices', 'splits', 'indices', 'technicals', 'rs_ratings', 'eps_rating', 'smr_rating', 'filings', 'fundamentals', 'composite', 'patterns', 'market', 'news', 'screener'];
const FEATURES = ['technicals_server', 'ratings', 'rs_line', 'canslim', 'patterns', 'fundamentals', 'export', 'screener_as_of', 'backtest'];

/** `/diagnostics`: what the backend has switched on and what the current plan unlocks (support + gating demo). */
@Component({
  selector: 'app-diagnostics',
  standalone: true,
  imports: [IfDatasetDirective, IfFeatureDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="diag">
      <h2>Data status</h2>
      <p>Plan: <strong data-tier>{{ ent.tier() }}</strong></p>
      <h3>Datasets</h3>
      <ul>
        @for (d of datasets; track d) {
          <li [attr.data-ds]="d">
            {{ d }}:
            <span *appIfDataset="d; else off" class="on">on (as of {{ meta.dataAsOf()[asOfKey(d)] ?? 'n/a' }})</span>
            <ng-template #off><span class="off">coming soon</span></ng-template>
          </li>
        }
      </ul>
      <h3>Features</h3>
      <ul>
        @for (f of features; track f) {
          <li [attr.data-feat]="f">
            {{ f }}:
            <span *appIfFeature="f; locked: lockedTpl" class="on">available</span>
            <ng-template #lockedTpl><span class="off">locked</span></ng-template>
          </li>
        }
      </ul>
    </section>
  `,
  styles: [`.diag { max-width: 720px; margin: 1.5rem auto; padding: 0 1rem; color: var(--c-text); } .on { color: var(--c-success); } .off { color: var(--c-text-muted); }`],
})
export class DiagnosticsComponent {
  protected readonly meta = inject(MetaService);
  protected readonly ent = inject(EntitlementsService);
  protected readonly datasets = DATASETS;
  protected readonly features = FEATURES;

  /** data_as_of keys differ from dataset names for a few rating datasets. */
  protected asOfKey(d: string): string {
    return d === 'rs_ratings' ? 'rs' : d === 'eps_rating' ? 'eps' : d === 'smr_rating' ? 'smr' : d;
  }
}
