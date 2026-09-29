import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth-interceptor';
import { TokenStore } from './token-store';

const BASE = 'http://192.168.1.111:3000';

describe('authInterceptor + TokenStore (task 12.4, docs/api/09-user-tiers.md §1)', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let tokens: TokenStore;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    logout = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { logout } },
      ],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStore);
  });
  afterEach(() => { ctl.verify(); localStorage.clear(); });

  it('TokenStore round-trips access/refresh tokens and clears them', () => {
    tokens.set({ access: 'a', refresh: 'r' });
    expect(tokens.access()).toBe('a');
    expect(tokens.refresh()).toBe('r');
    tokens.clear();
    expect(tokens.access()).toBeNull();
    expect(tokens.refresh()).toBeNull();
  });

  it('attaches Bearer to API calls only, never to auth endpoints or foreign urls', () => {
    tokens.set({ access: 'tok', refresh: 'r' });
    http.get(`${BASE}/api/stocks/MSFT`).subscribe();
    expect(ctl.expectOne(`${BASE}/api/stocks/MSFT`).request.headers.get('Authorization')).toBe('Bearer tok');
    http.post(`${BASE}/api/auth/login`, {}).subscribe();
    expect(ctl.expectOne(`${BASE}/api/auth/login`).request.headers.has('Authorization')).toBe(false);
    http.get('https://other.example/api/x').subscribe();
    expect(ctl.expectOne('https://other.example/api/x').request.headers.has('Authorization')).toBe(false);
  });

  it('no token -> no header', () => {
    http.get(`${BASE}/api/a`).subscribe();
    expect(ctl.expectOne(`${BASE}/api/a`).request.headers.has('Authorization')).toBe(false);
  });

  it('401 token_expired -> refresh once -> replay with the new token', () => {
    tokens.set({ access: 'old', refresh: 'r1' });
    let out: unknown;
    http.get(`${BASE}/api/a`).subscribe((v) => (out = v));
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'Unauthorized' });
    const rf = ctl.expectOne(`${BASE}/api/auth/refresh`);
    expect(rf.request.method).toBe('POST');
    expect(rf.request.body).toEqual({ refresh_token: 'r1' });
    rf.flush({ access_token: 'new', refresh_token: 'r2', expires_in: 900 });
    const replay = ctl.expectOne(`${BASE}/api/a`);
    expect(replay.request.headers.get('Authorization')).toBe('Bearer new');
    replay.flush({ ok: 1 });
    expect(out).toEqual({ ok: 1 });
    expect(tokens.access()).toBe('new');
    expect(tokens.refresh()).toBe('r2');
  });

  it('refresh fails -> tokens cleared, AuthService.logout called, original 401 surfaces', () => {
    tokens.set({ access: 'old', refresh: 'r1' });
    let status = 0;
    http.get(`${BASE}/api/a`).subscribe({ error: (e) => (status = e.status) });
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'x' });
    ctl.expectOne(`${BASE}/api/auth/refresh`).flush({ error: 'unauthenticated', message: 'bad' }, { status: 401, statusText: 'x' });
    expect(status).toBe(401);
    expect(tokens.access()).toBeNull();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('concurrent 401s share ONE refresh request and all replay', () => {
    tokens.set({ access: 'old', refresh: 'r1' });
    const results: unknown[] = [];
    http.get(`${BASE}/api/a`).subscribe((v) => results.push(v));
    http.get(`${BASE}/api/b`).subscribe((v) => results.push(v));
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'x' });
    ctl.expectOne(`${BASE}/api/b`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'x' });
    const refreshes = ctl.match(`${BASE}/api/auth/refresh`);
    expect(refreshes.length).toBe(1);
    refreshes[0].flush({ access_token: 'new', refresh_token: 'r2', expires_in: 900 });
    ctl.expectOne(`${BASE}/api/a`).flush('A');
    ctl.expectOne(`${BASE}/api/b`).flush('B');
    expect(results).toEqual(['A', 'B']);
  });

  it('401 without a refresh token just passes through (no logout loop)', () => {
    let status = 0;
    http.get(`${BASE}/api/a`).subscribe({ error: (e) => (status = e.status) });
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'unauthenticated', message: 'x' }, { status: 401, statusText: 'x' });
    expect(status).toBe(401);
    expect(logout).not.toHaveBeenCalled();
  });

  it('a replayed request that 401s again does not refresh a second time', () => {
    tokens.set({ access: 'old', refresh: 'r1' });
    let status = 0;
    http.get(`${BASE}/api/a`).subscribe({ error: (e) => (status = e.status) });
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'x' });
    ctl.expectOne(`${BASE}/api/auth/refresh`).flush({ access_token: 'new', refresh_token: 'r2', expires_in: 900 });
    ctl.expectOne(`${BASE}/api/a`).flush({ error: 'token_expired', message: 'x' }, { status: 401, statusText: 'x' });
    ctl.expectNone(`${BASE}/api/auth/refresh`);
    expect(status).toBe(401);
  });
});
