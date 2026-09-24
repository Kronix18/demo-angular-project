import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { authGuard } from './auth.guard';

// The guard's contract is CanActivateFn; until the implementation declares it
// (task 1.3 GREEN), call through the declared contract type.
const guard = authGuard as CanActivateFn;

// Task 1.3 — the guard must send unauthenticated users to the REAL login route
// (/auth/login — /login does not exist and would fall through to '**' → /home)
// and carry the originally requested URL as returnUrl so login can send them back.
describe('authGuard', () => {
  let navigate: ReturnType<typeof vi.fn>;

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/profile' } as RouterStateSnapshot;

  const runGuard = () => TestBed.runInInjectionContext(() => guard(route, state));

  beforeEach(() => {
    sessionStorage.clear();
    navigate = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { navigate } }],
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('logged out: redirects to /auth/login with returnUrl and returns false', () => {
    const result = runGuard();

    expect(result).toBe(false);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/profile' },
    });
  });

  it('logged in: returns true without navigating', () => {
    sessionStorage.setItem('isLoggedIn', 'true');

    const result = runGuard();

    expect(result).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
