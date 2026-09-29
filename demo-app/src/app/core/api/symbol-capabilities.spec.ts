import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import chartMeta from '../../../../docs/api/fixtures/chart-meta-msft.json';
import { ApiErrorService } from './errors';
import { SymbolCapabilities } from './symbol-capabilities';

const url = (s: string) => `http://192.168.1.111:3000/api/chart/${s}/meta`;

describe('SymbolCapabilities (task 12.9, docs/api/02-prices.md)', () => {
  let svc: SymbolCapabilities;
  let ctl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(SymbolCapabilities);
    ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctl.verify());

  it('load() returns a signal: loading -> ready with the parsed meta', () => {
    const s = svc.load('msft');
    expect(s().status).toBe('loading');
    ctl.expectOne(url('MSFT')).flush(chartMeta); // symbol is upper-cased in the path
    expect(s().status).toBe('ready');
    expect(s().meta?.first_bar).toBe('1986-03-13');
    expect(svc.supports('msft', 'technicals')).toBe(true);
    expect(svc.supports('msft', 'patterns')).toBe(false);
    expect(svc.hasInterval('MSFT', '1w')).toBe(true);
    expect(svc.hasInterval('MSFT', '1h')).toBe(false);
  });

  it('caches per symbol: a second load makes no request and returns the same signal', () => {
    const a = svc.load('MSFT');
    ctl.expectOne(url('MSFT')).flush(chartMeta);
    const b = svc.load('msft');
    ctl.expectNone(url('MSFT'));
    expect(b).toBe(a);
  });

  it('a fresh IPO has no technicals / rs_line', () => {
    svc.load('NEWCO');
    ctl.expectOne(url('NEWCO')).flush({ ...chartMeta, security_id: 9, bar_count: 3, datasets: { technicals: false, rs_line: false } });
    expect(svc.supports('NEWCO', 'technicals')).toBe(false);
    expect(svc.supports('NEWCO', 'rs_line')).toBe(false);
  });

  it('a delisted symbol is flagged and keeps its last bar', () => {
    svc.load('OLDCO');
    ctl.expectOne(url('OLDCO')).flush({ ...chartMeta, delisted: true, last_bar: '2020-01-31' });
    expect(svc.get('OLDCO')?.delisted).toBe(true);
    expect(svc.get('OLDCO')?.last_bar).toBe('2020-01-31');
  });

  it('404 / server error => unavailable, silently (no toast), and unknown symbols are not "supported"', () => {
    const errors = TestBed.inject(ApiErrorService);
    const a = svc.load('NOPE');
    ctl.expectOne(url('NOPE')).flush({ error: 'symbol_not_found', message: 'x' }, { status: 404, statusText: 'x' });
    expect(a().status).toBe('unavailable');
    const b = svc.load('BOOM');
    ctl.expectOne(url('BOOM')).flush({}, { status: 500, statusText: 'x' });
    expect(b().status).toBe('unavailable');
    expect(errors.toast()).toBeNull();
    expect(svc.supports('NOPE', 'technicals')).toBe(false);
    expect(svc.supports('NEVERLOADED', 'technicals')).toBe(false);
  });
});
