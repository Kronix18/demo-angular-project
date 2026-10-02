import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import meta from '../../../../docs/api/fixtures/meta.json';
import ent from '../../../../docs/api/fixtures/entitlements-pro.json';
import { EntitlementsService } from '../../core/api/entitlements.service';
import { MetaService } from '../../core/api/meta.service';
import { DiagnosticsComponent } from './diagnostics.component';

const base = 'http://localhost:3000';

describe('DiagnosticsComponent (task 12.10 demo of the gating directives; data status page)', () => {
  it('lists each known dataset as on/off from /api/meta and features as available/locked', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const ctl = TestBed.inject(HttpTestingController);
    const f = TestBed.createComponent(DiagnosticsComponent);
    TestBed.inject(MetaService).load();
    TestBed.inject(EntitlementsService).load();
    ctl.expectOne(`${base}/api/meta`).flush(meta);
    ctl.expectOne(`${base}/api/user/entitlements`).flush(ent);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('[data-ds="technicals"]')?.textContent).toContain('on');
    expect(el.querySelector('[data-ds="patterns"]')?.textContent).toContain('coming soon');
    expect(el.querySelector('[data-feat="patterns"]')?.textContent).toContain('available');
    expect(el.querySelector('[data-feat="backtest"]')?.textContent).toContain('locked');
    expect(el.querySelector('[data-tier]')?.textContent).toContain('pro');
  });
});
