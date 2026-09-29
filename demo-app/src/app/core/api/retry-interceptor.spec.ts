import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RETRY_JITTER, retryInterceptor } from './retry-interceptor';

const U = 'http://192.168.1.111:3000/api/quotes';

describe('retryInterceptor (task 12.6)', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([retryInterceptor])), provideHttpClientTesting(), { provide: RETRY_JITTER, useValue: () => 0.5 /* neutral: factor 1.0 */ }],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { ctl.verify(); vi.useRealTimers(); });

  const flushErr = (status: number, headers: Record<string, string> = {}) => ctl.expectOne(U).flush({ error: 'x', message: 'x' }, { status, statusText: 'x', headers });

  it('503 then 200: retried once after the backoff and succeeds silently', () => {
    let out: unknown;
    http.get(U).subscribe((v) => (out = v));
    flushErr(503);
    ctl.expectNone(U);
    vi.advanceTimersByTime(500);
    ctl.expectOne(U).flush({ ok: 1 });
    expect(out).toEqual({ ok: 1 });
  });

  it('respects Retry-After (seconds) on 429', () => {
    http.get(U).subscribe();
    flushErr(429, { 'Retry-After': '2' });
    vi.advanceTimersByTime(1999);
    ctl.expectNone(U);
    vi.advanceTimersByTime(2);
    ctl.expectOne(U).flush({});
  });

  it('gives up after 2 retries and surfaces the last error (backoff 500ms then 1000ms)', () => {
    let err: any;
    http.get(U).subscribe({ error: (e) => (err = e) });
    flushErr(503);
    vi.advanceTimersByTime(500);
    flushErr(503);
    vi.advanceTimersByTime(1000);
    flushErr(503);
    expect(err.status).toBe(503);
  });

  it('retries network errors (status 0)', () => {
    http.get(U).subscribe();
    ctl.expectOne(U).error(new ProgressEvent('error'));
    vi.advanceTimersByTime(500);
    ctl.expectOne(U).flush({});
  });

  it('never retries POST/PUT/DELETE', () => {
    let err: any;
    http.post(U, {}).subscribe({ error: (e) => (err = e) });
    ctl.expectOne(U).flush({}, { status: 503, statusText: 'x' });
    expect(err.status).toBe(503);
    ctl.expectNone(U);
  });

  it.each([400, 401, 402, 404, 422, 500])('does not retry %i', (status) => {
    let err: any;
    http.get(U).subscribe({ error: (e) => (err = e) });
    flushErr(status);
    vi.advanceTimersByTime(5000);
    ctl.expectNone(U);
    expect(err.status).toBe(status);
  });

  it('jitter spreads the delay (+-25%)', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([retryInterceptor])), provideHttpClientTesting(), { provide: RETRY_JITTER, useValue: () => 1 }] });
    const h = TestBed.inject(HttpClient);
    const c = TestBed.inject(HttpTestingController);
    h.get(U).subscribe();
    c.expectOne(U).flush({}, { status: 503, statusText: 'x' });
    vi.advanceTimersByTime(624);
    c.expectNone(U);
    vi.advanceTimersByTime(2);
    c.expectOne(U).flush({});
  });
});
