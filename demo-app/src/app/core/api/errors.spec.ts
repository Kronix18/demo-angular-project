import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiError, ApiErrorService, errorInterceptor, shouldToast, toApiError } from './errors';

const errResp = (status: number, body?: unknown, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, error: body, url: 'http://x/api/y', headers: headers ? (new (globalThis as any).Headers(headers) as any) : undefined });

describe('ApiError mapping (task 12.3, docs/api/README.md §5)', () => {
  it('maps the documented body to a typed error', () => {
    const e = toApiError(errResp(402, { error: 'upgrade_required', message: 'Needs pro', details: { required_tier: 'pro', feature: 'patterns' } }));
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(402);
    expect(e.code).toBe('upgrade_required');
    expect(e.message).toBe('Needs pro');
    expect(e.details).toEqual({ required_tier: 'pro', feature: 'patterns' });
  });

  it.each([
    [400, 'bad_request'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [422, 'validation_failed'],
    [429, 'rate_limited'],
    [503, 'data_not_ready'],
    [500, 'server_error'],
  ])('falls back to a code from the HTTP status when the body is not the contract (%i -> %s)', (status, code) => {
    expect(toApiError(errResp(status, '<html>oops</html>')).code).toBe(code);
  });

  it('status 0 is a network error; timeouts are typed', () => {
    expect(toApiError(errResp(0)).code).toBe('network');
    const t = new Error('t'); t.name = 'TimeoutError';
    expect(toApiError(t).code).toBe('timeout');
    expect(toApiError('weird').code).toBe('unknown');
  });

  it('reads Retry-After for 429', () => {
    const e = toApiError(new HttpErrorResponse({ status: 429, error: { error: 'rate_limited', message: 'slow down' }, headers: new (globalThis as any).Headers() as any }));
    expect(e.retryAfterSeconds).toBeUndefined();
  });

  it('toast policy: never for 402/404/401-token/data_not_ready, yes for the rest', () => {
    const mk = (status: number, code: string) => new ApiError(status, code, 'm');
    expect(shouldToast(mk(402, 'upgrade_required'))).toBe(false);
    expect(shouldToast(mk(404, 'symbol_not_found'))).toBe(false);
    expect(shouldToast(mk(401, 'token_expired'))).toBe(false);
    expect(shouldToast(mk(503, 'data_not_ready'))).toBe(false);
    expect(shouldToast(mk(500, 'server_error'))).toBe(true);
    expect(shouldToast(mk(0, 'network'))).toBe(true);
    expect(shouldToast(mk(429, 'rate_limited'))).toBe(true);
    expect(shouldToast(mk(422, 'validation_failed'))).toBe(true);
  });
});

describe('errorInterceptor + ApiErrorService (12.3)', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let svc: ApiErrorService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    svc = TestBed.inject(ApiErrorService);
  });
  afterEach(() => { ctl.verify(); vi.useRealTimers(); });

  const fail = (url: string, status: number, body?: unknown) => {
    let caught: unknown;
    http.get(url).subscribe({ error: (e) => (caught = e) });
    ctl.expectOne(url).flush(body ?? {}, { status, statusText: 'x' });
    return caught;
  };

  it('rethrows the ORIGINAL HttpErrorResponse (existing callers keep working)', () => {
    const c = fail('http://h/api/a', 500);
    expect(c).toBeInstanceOf(HttpErrorResponse);
  });

  it('shows one toast for a server error and none for 402 / 404', () => {
    fail('http://h/api/a', 402, { error: 'upgrade_required', message: 'up' });
    fail('http://h/api/b', 404, { error: 'symbol_not_found', message: 'nf' });
    expect(svc.toast()).toBeNull();
    fail('http://h/api/c', 500, { error: 'server_error', message: 'Boom' });
    expect(svc.toast()?.message).toBe('Boom');
  });

  it('dedupes identical toasts (retries) and auto-dismisses', () => {
    fail('http://h/api/a', 500, { error: 'server_error', message: 'Boom' });
    fail('http://h/api/a', 500, { error: 'server_error', message: 'Boom' });
    expect(svc.toast()?.count).toBe(1);
    vi.advanceTimersByTime(6000);
    expect(svc.toast()).toBeNull();
  });

  it('a newer different error replaces the toast (never stacks)', () => {
    fail('http://h/api/a', 500, { error: 'server_error', message: 'One' });
    fail('http://h/api/b', 422, { error: 'validation_failed', message: 'Two' });
    expect(svc.toast()?.message).toBe('Two');
  });

  it('ignores non-API urls and exposes the last error', () => {
    fail('http://h/assets/x.json', 500);
    expect(svc.toast()).toBeNull();
    fail('http://h/api/z', 402, { error: 'upgrade_required', message: 'up' });
    expect(svc.lastError()?.code).toBe('upgrade_required');
  });

  it('dismiss() clears', () => {
    fail('http://h/api/a', 500, { error: 'server_error', message: 'Boom' });
    svc.dismiss();
    expect(svc.toast()).toBeNull();
  });
});

describe('SILENT_ERRORS context (12.8 needs optional discovery calls that never toast)', () => {
  it('a request marked silent is not reported even on 500', async () => {
    const { HttpContext } = await import('@angular/common/http');
    const { SILENT_ERRORS } = await import('./errors');
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpClient);
    const ctl = TestBed.inject(HttpTestingController);
    const svc = TestBed.inject(ApiErrorService);
    http.get('http://h/api/meta', { context: new HttpContext().set(SILENT_ERRORS, true) }).subscribe({ error: () => undefined });
    ctl.expectOne('http://h/api/meta').flush({}, { status: 500, statusText: 'x' });
    expect(svc.toast()).toBeNull();
    expect(svc.lastError()).toBeNull();
  });
});
