import { Directive, EmbeddedViewRef, TemplateRef, ViewContainerRef, effect, inject, input, untracked } from '@angular/core';
import { EntitlementsService } from '../../core/api/entitlements.service';
import { MetaService } from '../../core/api/meta.service';
import { SymbolCapabilities } from '../../core/api/symbol-capabilities';

/** Shows/hides a template from a boolean signal-driven decision; `null` = unknown (render nothing, no flash). */
abstract class GateBase {
  protected readonly vcr = inject(ViewContainerRef);
  protected readonly tpl = inject(TemplateRef<unknown>);
  private main: EmbeddedViewRef<unknown> | null = null;
  private alt: EmbeddedViewRef<unknown> | null = null;

  protected render(state: boolean | null, altTpl: TemplateRef<unknown> | null | undefined): void {
    const want = state === true ? 'main' : state === false && altTpl ? 'alt' : 'none';
    if (want === 'main' && !this.main) { this.clear(); this.main = this.vcr.createEmbeddedView(this.tpl); }
    else if (want === 'alt' && !this.alt) { this.clear(); this.alt = this.vcr.createEmbeddedView(altTpl!); }
    else if (want === 'none') this.clear();
  }

  private clear(): void { this.vcr.clear(); this.main = null; this.alt = null; }
}

/**
 * `*appIfDataset="'technicals'; else off; symbol: sym"`: shown when the backend has the dataset (GET /api/meta),
 * or - with a symbol - when that symbol supports it (GET /api/chart/{symbol}/meta). Hidden until known.
 */
@Directive({ selector: '[appIfDataset]', standalone: true })
export class IfDatasetDirective extends GateBase {
  readonly appIfDataset = input.required<string>();
  readonly appIfDatasetElse = input<TemplateRef<unknown> | null>(null);
  readonly appIfDatasetSymbol = input<string | null | undefined>(null);
  private readonly meta = inject(MetaService);
  private readonly caps = inject(SymbolCapabilities);

  constructor() {
    super();
    effect(() => {
      const ds = this.appIfDataset();
      const sym = this.appIfDatasetSymbol();
      let state: boolean | null;
      if (sym) {
        const c = this.caps.load(sym)();
        state = c.status === 'loading' ? null : c.status === 'unavailable' ? false : this.caps.supports(sym, ds);
      } else {
        state = this.meta.loaded() ? this.meta.has(ds) : null;
      }
      untracked(() => this.render(state, this.appIfDatasetElse()));
    });
  }
}

/** `*appIfFeature="'patterns'; locked: lockedTpl"`: entitled -> content, not entitled -> locked template, unknown -> nothing. */
@Directive({ selector: '[appIfFeature]', standalone: true })
export class IfFeatureDirective extends GateBase {
  readonly appIfFeature = input.required<string>();
  readonly appIfFeatureLocked = input<TemplateRef<unknown> | null>(null);
  private readonly ent = inject(EntitlementsService);

  constructor() {
    super();
    effect(() => {
      const f = this.appIfFeature();
      const state = this.ent.loaded() ? this.ent.has(f) : null;
      untracked(() => this.render(state, this.appIfFeatureLocked()));
    });
  }
}
