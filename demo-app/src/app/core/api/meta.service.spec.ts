import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import meta from '../../../../docs/api/fixtures/meta.json';
import { ApiErrorService } from './errors';
import { ETagCache } from './etag-cache';
import { MetaService } from './meta.service';

const URL = 'http://localhost:3000/api/meta';

describe('MetaService (task 12.8, docs/api/README.md §10)', () => {
  let svc: MetaService;
  let ctl: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T00:00:00Z'));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    svc = TestBed.inject(MetaService);
    ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('starts empty and not loaded', () => {
    expect(svc.loaded()).toBe(false);
    expect(svc.datasets()).toEqual([]);
    expect(svc.has('prices')).toBe(false);
  });

  it('load() fills the signals from GET /api/meta', () => {
    svc.load();
    ctl.expectOne(URL).flush(meta);
    expect(svc.loaded()).toBe(true);
    expect(svc.has('prices')).toBe(true);
    expect(svc.has('patterns')).toBe(false);
    expect(svc.dataAsOf()['prices']).toBe('2026-09-22');
    expect(svc.benchmarks()?.default).toBe('TSX');
    expect(svc.benchmarks()?.is_interim).toBe(true);
    expect(svc.displayName('smr_rating', 'SMR')).toBe('Quality (Sales·Margins·ROE)');
    expect(svc.displayName('unknown_key', 'Fallback')).toBe('Fallback');
    ctl.verify();
  });

  it('failure => no datasets, loaded=true, and NO toast (optional discovery)', () => {
    const errors = TestBed.inject(ApiErrorService);
    svc.load();
    ctl.expectOne(URL).flush({}, { status: 500, statusText: 'x' });
    expect(svc.loaded()).toBe(true);
    expect(svc.datasets()).toEqual([]);
    expect(errors.toast()).toBeNull();
  });

  it('refreshes at next_refresh_after', () => {
    svc.load();
    ctl.expectOne(URL).flush({ ...meta, next_refresh_after: '2026-09-23T02:00:00Z' });
    vi.advanceTimersByTime(2 * 3600_000 - 1000);
    ctl.expectNone(URL);
    vi.advanceTimersByTime(1500);
    const again = ctl.expectOne(URL);
    again.flush({ ...meta, data_as_of: { ...meta.data_as_of, prices: '2026-09-23' } });
    expect(svc.dataAsOf()['prices']).toBe('2026-09-23');
    ctl.verify();
  });

  it('null next_refresh_after (manual daily import) => poll every 15 minutes', () => {
    svc.load();
    ctl.expectOne(URL).flush({ ...meta, next_refresh_after: null });
    vi.advanceTimersByTime(15 * 60_000 + 10);
    ctl.expectOne(URL).flush(meta);
    ctl.verify();
  });

  it('a failing refresh keeps the last good datasets', () => {
    svc.load();
    ctl.expectOne(URL).flush({ ...meta, next_refresh_after: null });
    vi.advanceTimersByTime(15 * 60_000 + 10);
    ctl.expectOne(URL).flush({}, { status: 503, statusText: 'x' });
    expect(svc.has('prices')).toBe(true);
    ctl.verify();
  });

  it('tells the ETag cache about data_as_of so it can evict', () => {
    const spy = vi.spyOn(TestBed.inject(ETagCache), 'onDataAsOf');
    svc.load();
    ctl.expectOne(URL).flush(meta);
    expect(spy).toHaveBeenCalledWith(meta.data_as_of);
    ctl.verify();
  });
});
