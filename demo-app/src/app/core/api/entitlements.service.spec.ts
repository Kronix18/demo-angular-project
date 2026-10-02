import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import ent from '../../../../docs/api/fixtures/entitlements-pro.json';
import { ApiErrorService } from './errors';
import { EntitlementsService } from './entitlements.service';

const URL = 'http://localhost:3000/api/user/entitlements';

describe('EntitlementsService (12.10 minimal store; task 20.2 extends it)', () => {
  let svc: EntitlementsService;
  let ctl: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(EntitlementsService);
    ctl = TestBed.inject(HttpTestingController);
  });

  it('starts unloaded; load() fills tier, limits, features', () => {
    expect(svc.loaded()).toBe(false);
    expect(svc.has('patterns')).toBe(false);
    svc.load();
    ctl.expectOne(URL).flush(ent);
    expect(svc.loaded()).toBe(true);
    expect(svc.tier()).toBe('pro');
    expect(svc.has('patterns')).toBe(true);
    expect(svc.has('backtest')).toBe(false);
    expect(svc.limit('watchlists')).toBe(10);
    ctl.verify();
  });

  it('failure (anonymous 401 or offline) => loaded, everything locked, no toast', () => {
    svc.load();
    ctl.expectOne(URL).flush({ error: 'unauthenticated', message: 'x' }, { status: 401, statusText: 'x' });
    expect(svc.loaded()).toBe(true);
    expect(svc.has('patterns')).toBe(false);
    expect(svc.tier()).toBe('free');
    expect(TestBed.inject(ApiErrorService).toast()).toBeNull();
  });
});
