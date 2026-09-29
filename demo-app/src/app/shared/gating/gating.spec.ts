import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import meta from '../../../../docs/api/fixtures/meta.json';
import chartMeta from '../../../../docs/api/fixtures/chart-meta-msft.json';
import ent from '../../../../docs/api/fixtures/entitlements-pro.json';
import { EntitlementsService } from '../../core/api/entitlements.service';
import { MetaService } from '../../core/api/meta.service';
import { SymbolCapabilities } from '../../core/api/symbol-capabilities';
import { IfDatasetDirective, IfFeatureDirective } from './gating';

@Component({
  standalone: true,
  imports: [IfDatasetDirective, IfFeatureDirective],
  template: `
    <p *appIfDataset="'technicals'" data-t>technicals on</p>
    <p *appIfDataset="'patterns'; else offTpl" data-p>patterns on</p>
    <ng-template #offTpl><p data-p-off>coming soon</p></ng-template>
    <p *appIfDataset="'rs_line'; symbol: sym()" data-rs>rs line for symbol</p>
    <p *appIfFeature="'patterns'; locked: lockedTpl" data-f>patterns feature</p>
    <ng-template #lockedTpl><p data-f-locked>locked: upgrade</p></ng-template>
  `,
})
class Host { sym = signal('MSFT'); }

describe('*appIfDataset / *appIfFeature (task 12.10)', () => {
  let ctl: HttpTestingController;
  const base = 'http://192.168.1.111:3000';

  function setup() {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    ctl = TestBed.inject(HttpTestingController);
    return TestBed.createComponent(Host);
  }
  const q = (f: any, sel: string) => f.nativeElement.querySelector(sel);

  it('dataset directive hides until meta is loaded, then follows datasets (else template when off)', async () => {
    const f = setup();
    f.detectChanges();
    expect(q(f, '[data-t]')).toBeNull();
    expect(q(f, '[data-p-off]')).toBeNull(); // unknown yet: no flash of "coming soon"
    TestBed.inject(MetaService).load();
    ctl.expectOne(`${base}/api/meta`).flush(meta);
    f.detectChanges();
    expect(q(f, '[data-t]')).not.toBeNull();
    expect(q(f, '[data-p]')).toBeNull();
    expect(q(f, '[data-p-off]')).not.toBeNull();
  });

  it('dataset directive reacts when datasets change (toggle on/off)', () => {
    const f = setup();
    const m = TestBed.inject(MetaService);
    m.load();
    ctl.expectOne(`${base}/api/meta`).flush({ ...meta, datasets: ['prices'] });
    f.detectChanges();
    expect(q(f, '[data-t]')).toBeNull();
    (m as any)._meta.set({ ...meta, datasets: ['prices', 'technicals'] });
    f.detectChanges();
    expect(q(f, '[data-t]')).not.toBeNull();
  });

  it('with a symbol it requires the symbol capability instead', () => {
    const f = setup();
    TestBed.inject(MetaService).load();
    ctl.expectOne(`${base}/api/meta`).flush(meta);
    f.detectChanges();
    expect(q(f, '[data-rs]')).toBeNull(); // caps not loaded yet
    ctl.expectOne(`${base}/api/chart/MSFT/meta`).flush(chartMeta);
    f.detectChanges();
    expect(q(f, '[data-rs]')).not.toBeNull();
    f.componentInstance.sym.set('NEWCO');
    f.detectChanges();
    ctl.expectOne(`${base}/api/chart/NEWCO/meta`).flush({ ...chartMeta, datasets: { rs_line: false } });
    f.detectChanges();
    expect(q(f, '[data-rs]')).toBeNull();
  });

  it('feature directive: on when entitled, locked template when not, nothing while loading', () => {
    const f = setup();
    TestBed.inject(SymbolCapabilities); // keep hooks quiet
    TestBed.inject(MetaService).load();
    ctl.expectOne(`${base}/api/meta`).flush(meta);
    f.detectChanges();
    ctl.expectOne(`${base}/api/chart/MSFT/meta`).flush(chartMeta);
    expect(q(f, '[data-f]')).toBeNull();
    expect(q(f, '[data-f-locked]')).toBeNull();
    const e = TestBed.inject(EntitlementsService);
    e.load();
    ctl.expectOne(`${base}/api/user/entitlements`).flush({ ...ent, features: { ...ent.features, patterns: false } });
    f.detectChanges();
    expect(q(f, '[data-f]')).toBeNull();
    expect(q(f, '[data-f-locked]')).not.toBeNull();
    e.load();
    ctl.expectOne(`${base}/api/user/entitlements`).flush({ ...ent, features: { ...ent.features, patterns: true } });
    f.detectChanges();
    expect(q(f, '[data-f]')).not.toBeNull();
    expect(q(f, '[data-f-locked]')).toBeNull();
  });
});
