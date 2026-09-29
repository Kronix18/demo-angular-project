import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('ApiService (coverage gate 7.1)', () => {
  let api: ApiService;
  let http: HttpTestingController;
  const BASE = 'http://192.168.1.111:3000';

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
    localStorage.setItem('auth_token', 'tok');
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('GET sends the bearer token and returns the body', () => {
    let out: unknown;
    api.get<{ a: number }>('x').subscribe((v) => (out = v));
    const req = http.expectOne(`${BASE}/x`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    req.flush({ a: 1 });
    expect(out).toEqual({ a: 1 });
  });

  it('POST/PUT/DELETE hit the right verb + url and pass bodies', () => {
    api.post('p', { k: 1 }).subscribe();
    const p = http.expectOne(`${BASE}/p`);
    expect(p.request.method).toBe('POST');
    expect(p.request.body).toEqual({ k: 1 });
    p.flush({});
    api.put('u', { k: 2 }).subscribe();
    const u = http.expectOne(`${BASE}/u`);
    expect(u.request.method).toBe('PUT');
    u.flush({});
    api.delete('d').subscribe();
    const d = http.expectOne(`${BASE}/d`);
    expect(d.request.method).toBe('DELETE');
    d.flush({});
  });

  it('server error message wins; otherwise status + message; errors carry status', () => {
    let err: any;
    api.post('p', {}).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/p`).flush({ message: 'nope' }, { status: 400, statusText: 'Bad' });
    expect(err.message).toBe('nope');
    expect(err.status).toBe(400);

    api.put('u', {}).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/u`).flush('boom', { status: 500, statusText: 'Server Error' });
    expect(err.message).toContain('Error Code: 500');
  });

  it('client-side (network) errors are reported with their message', () => {
    let err: any;
    api.delete('d').subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/d`).error(new ProgressEvent('error'), { status: 0 });
    expect(err.status).toBe(0);
    expect(typeof err.message).toBe('string');
  });

  it('a request that never answers ends in the timeout message', () => {
    vi.useFakeTimers();
    let err: any;
    api.post('slow', {}, 50).subscribe({ error: (e) => (err = e) });
    http.expectOne(`${BASE}/slow`);
    vi.advanceTimersByTime(60);
    expect(err.message).toMatch(/timeout/i);
    http.match(() => true); // discard the cancelled request
  });

  it('GET retries with backoff, then surfaces the error', () => {
    vi.useFakeTimers();
    let err: any;
    api.get('flaky').subscribe({ error: (e) => (err = e) });
    // 1 initial attempt + 3 retries (backoff 1s, 2s, 4s), then the error surfaces
    for (let attempt = 0; attempt < 3; attempt++) {
      http.expectOne(`${BASE}/flaky`).flush('x', { status: 503, statusText: 'Unavailable' });
      expect(err, `still retrying after attempt ${attempt + 1}`).toBeUndefined();
      vi.advanceTimersByTime(Math.pow(2, attempt) * 1000 + 1);
    }
    http.expectOne(`${BASE}/flaky`).flush('x', { status: 503, statusText: 'Unavailable' });
    expect(err, 'error must surface after the last retry (was: silent completion)').toBeDefined();
    expect(err.status).toBe(503);
    http.match(() => true);
  });

  it('handleError tolerates non-Http errors', () => {
    let err: any;
    (api as any).handleError(new Error('x')).subscribe({ error: (e: unknown) => (err = e) });
    expect(err.message).toBe('An unexpected error occurred');
    
  });
});
