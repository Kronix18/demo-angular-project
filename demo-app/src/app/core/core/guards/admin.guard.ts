import { Injectable, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SubscriptionService } from '../subscriptions/subscription.service';

/**
 * Guard that allows access only to admin users
 */
export const adminGuard: CanActivateFn = (route, state) => {
  const subscriptionService = inject(SubscriptionService);
  const router = inject(Router);

  if (subscriptionService.isAdmin()) {
    return true;
  }

  router.navigate(['/home']);
  return false;
};
