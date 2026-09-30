import { ChangeDetectionStrategy, Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { freshness } from '../../core/api/freshness';
import { MetaService } from '../../core/api/meta.service';
import { IconComponent } from '../icons/icon.component';

/** "Data as of …" chip (12.12) + an info button that opens a popover with dates, model versions and basis (12.11). */
@Component({
  selector: 'app-data-info',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (meta.loaded() && meta.datasets().length) {
      <span class="wrap">
        @if (fresh().state !== 'unknown') {
          <span class="chip" data-fresh>Data as of {{ fresh().asOf }} · end of day</span>
          @if (fresh().state === 'stale') {
            <span class="chip warn" data-stale role="status" [title]="'Data is ' + fresh().lagBusinessDays + ' business days old'">Data may be out of date</span>
          }
        }
        <button type="button" class="btn" data-info-btn aria-label="Data information" [attr.aria-expanded]="open()" (click)="open.set(!open())">
          <app-icon name="datainfo" [size]="16" />
        </button>
        @if (open()) {
          <div class="pop" data-info-pop role="dialog" aria-label="Data information">
            <h4>Data</h4>
            <p>Prices are split-adjusted, end of day, and are not live.</p>
            @if (meta.benchmarks(); as b) {
              <p>Benchmark: <strong>{{ b.default }}</strong>@if (b.is_interim) { <span> (interim benchmark)</span> }</p>
            }
            <h4>Data as of</h4>
            <ul>
              @for (e of asOfRows(); track e[0]) { <li><span>{{ e[0] }}</span><span>{{ e[1] }}</span></li> }
            </ul>
            <h4>Model versions</h4>
            <ul>
              @for (e of versionRows(); track e[0]) { <li><span>{{ e[0] }}</span><span>{{ e[1] }}</span></li> }
            </ul>
          </div>
        }
      </span>
    }
  `,
  styles: [
    `
      .wrap { position: relative; display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: var(--c-text-muted); }
      .chip { padding: 2px 8px; border-radius: 999px; background: var(--c-surface); border: 1px solid var(--c-border); }
      .chip.warn { color: var(--c-warning-text); background: var(--c-warning-bg); border-color: var(--c-warning); }
      .btn { display: inline-flex; padding: 2px; border: none; background: transparent; color: inherit; cursor: pointer; border-radius: 4px; }
      .btn:hover { color: var(--c-text); }
      .pop { position: absolute; right: 0; top: 100%; margin-top: 6px; z-index: 50; min-width: 240px; padding: 10px 12px; background: var(--c-surface); color: var(--c-text); border: 1px solid var(--c-border); border-radius: var(--border-radius); box-shadow: var(--shadow-elevation-low); }
      .pop h4 { margin: 8px 0 4px; font-size: 0.75rem; text-transform: uppercase; color: var(--c-text-muted); }
      .pop h4:first-child { margin-top: 0; }
      .pop p { margin: 0 0 4px; }
      .pop ul { list-style: none; margin: 0; padding: 0; }
      .pop li { display: flex; justify-content: space-between; gap: 12px; }
    `,
  ],
})
export class DataInfoComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  protected readonly meta = inject(MetaService);
  protected readonly open = signal(false);
  protected readonly fresh = computed(() => freshness(this.meta.dataAsOf(), new Date()));
  protected readonly asOfRows = computed(() => Object.entries(this.meta.dataAsOf()).filter(([, v]) => !!v) as [string, string][]);
  protected readonly versionRows = computed(() =>
    Object.entries(this.meta.modelVersions()).map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : v] as [string, string]),
  );

  @HostListener('document:keydown.escape')
  protected onEscape(): void { this.open.set(false); }

  @HostListener('document:click', ['$event'])
  protected onDocClick(e: MouseEvent): void {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }
}
