import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

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
});
