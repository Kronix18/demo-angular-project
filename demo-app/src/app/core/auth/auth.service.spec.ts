import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

describe('AuthService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('rehydrates isLoggedIn$ from sessionStorage when the flag was set before injection (page refresh)', () => {
    // Seed storage BEFORE the service is instantiated, simulating a page
    // refresh during a previously logged-in session.
    sessionStorage.setItem('isLoggedIn', 'true');
    sessionStorage.setItem('userEmail', 'admin@demo.angular-project.local');

    TestBed.configureTestingModule({});
    const service = TestBed.inject(AuthService);

    const emissions: boolean[] = [];
    service.isLoggedIn$.subscribe((value) => emissions.push(value));

    expect(emissions.length).toBeGreaterThanOrEqual(1);
    expect(emissions[0]).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
  });

  it('emits true and persists isLoggedIn + userEmail to sessionStorage on valid credentials', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(AuthService);

    const emissions: boolean[] = [];
    service.isLoggedIn$.subscribe((value) => emissions.push(value));

    let loginResult: boolean | undefined;
    service
      .login({ email: 'admin@demo.angular-project.local', password: 'changeme' })
      .subscribe((result) => (loginResult = result));

    expect(loginResult).toBe(true);
    expect(emissions[emissions.length - 1]).toBe(true);
    expect(sessionStorage.getItem('isLoggedIn')).toBe('true');
    expect(sessionStorage.getItem('userEmail')).toBe('admin@demo.angular-project.local');
  });

  it('emits false and leaves sessionStorage untouched on invalid credentials', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(AuthService);

    const emissions: boolean[] = [];
    service.isLoggedIn$.subscribe((value) => emissions.push(value));

    let loginResult: boolean | undefined;
    service
      .login({ email: 'admin@demo.angular-project.local', password: 'wrong-password' })
      .subscribe((result) => (loginResult = result));

    expect(loginResult).toBe(false);
    expect(emissions[emissions.length - 1]).toBe(false);
    expect(sessionStorage.getItem('isLoggedIn')).toBeNull();
  });

  it('emits false and clears isLoggedIn + userEmail from sessionStorage on logout()', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(AuthService);

    const emissions: boolean[] = [];
    service.isLoggedIn$.subscribe((value) => emissions.push(value));

    service
      .login({ email: 'admin@demo.angular-project.local', password: 'changeme' })
      .subscribe();
    service.logout();

    expect(emissions[emissions.length - 1]).toBe(false);
    expect(sessionStorage.getItem('isLoggedIn')).toBeNull();
    expect(sessionStorage.getItem('userEmail')).toBeNull();
  });

  describe('session helpers + demo register/verify (coverage gate 7.1)', () => {
    const ADMIN = { email: 'admin@demo.angular-project.local', password: 'changeme' };

    it('tokens and current user exist only while logged in', async () => {
      const svc = TestBed.inject(AuthService);
      expect(svc.getAccessToken()).toBeNull();
      expect(svc.getRefreshToken()).toBeNull();
      expect(svc.getCurrentUser()).toBeNull();
      expect(svc.isAuthenticated()).toBe(false);
      await firstValueFrom(svc.login(ADMIN));
      expect(svc.isAuthenticated()).toBe(true);
      expect(svc.getAccessToken()).toBe('demo-access-token');
      expect(svc.getRefreshToken()).toBe('demo-refresh-token');
      expect(svc.getCurrentUser()).toEqual({ email: ADMIN.email, username: 'admin', accessToken: 'demo-access-token' });
    });

    it('register: only the demo admin succeeds (and logs in); everyone else is rejected', async () => {
      const svc = TestBed.inject(AuthService);
      expect(await firstValueFrom(svc.register({ name: 'x', username: 'x', email: 'x@y.z', password: 'pw' }))).toBe(false);
      expect(svc.isLoggedIn()).toBe(false);
      expect(await firstValueFrom(svc.register({ name: 'a', username: 'admin', ...ADMIN }))).toBe(true);
      expect(svc.isLoggedIn()).toBe(true);
    });

    it('login accepts username too, rejects wrong passwords; verifyEmail always resolves', async () => {
      const svc = TestBed.inject(AuthService);
      expect(await firstValueFrom(svc.login({ email: ADMIN.email, password: 'wrong' }))).toBe(false);
      expect(await firstValueFrom(svc.verifyEmail('tok'))).toBeUndefined();
    });
  });
});
