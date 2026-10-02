import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UpgradeService, entitlementInterceptor } from './upgrade';

const U = 'http://h/api/stocks/MSFT/patterns';

describe('entitlementInterceptor + UpgradeService (task 12.7, docs/api/README.md §5, 09 §2)', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let up: UpgradeService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([entitlementInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    up = TestBed.inject(UpgradeService);
  });
  afterEach(() => ctl.verify());

  it('402 upgrade_required emits {feature, requiredTier} and rethrows the original error', () => {
    const events: unknown[] = [];
    up.upgrade$.subscribe((e) => events.push(e));
    let err: any;
    http.get(U).subscribe({ error: (e) => (err = e) });
    ctl.expectOne(U).flush({ error: 'upgrade_required', message: 'Needs pro', details: { required_tier: 'pro', feature: 'patterns' } }, { status: 402, statusText: 'Payment Required' });
    expect(events).toEqual([{ feature: 'patterns', requiredTier: 'pro', message: 'Needs pro', url: U }]);
    expect(err.status).toBe(402);
    expect(up.last()?.feature).toBe('patterns');
  });

  it('tolerates a 402 without details', () => {
    const events: any[] = [];
    up.upgrade$.subscribe((e) => events.push(e));
    http.get(U).subscribe({ error: () => undefined });
    ctl.expectOne(U).flush({}, { status: 402, statusText: 'x' });
    expect(events[0].feature).toBeNull();
    expect(events[0].requiredTier).toBeNull();
  });

  it('other statuses emit nothing', () => {
    const events: unknown[] = [];
    up.upgrade$.subscribe((e) => events.push(e));
    http.get(U).subscribe({ error: () => undefined });
    ctl.expectOne(U).flush({ error: 'forbidden', message: 'x' }, { status: 403, statusText: 'x' });
    expect(events).toEqual([]);
  });

  it('clear() resets last()', () => {
    http.get(U).subscribe({ error: () => undefined });
    ctl.expectOne(U).flush({ error: 'upgrade_required', message: 'm', details: { feature: 'f', required_tier: 'plus' } }, { status: 402, statusText: 'x' });
    up.clear();
    expect(up.last()).toBeNull();
  });
});
