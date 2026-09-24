import { inject } from '@angular/core';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, CanActivateFn, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Functional auth guard (Angular 21): lets logged-in users through and sends
 * everyone else to the REAL login route (/auth/login) carrying the requested
 * URL as returnUrl so the login page can send them back after success.
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
