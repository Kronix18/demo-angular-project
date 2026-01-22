import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { SubscriptionService } from '../subscriptions/subscription.service';
import { SubscriptionTier } from '../subscriptions/subscription.types';

/**
 * Guard to check if user has minimum subscription tier
 * Usage: canActivate: [subscriptionGuard(SubscriptionTier.PRO)]
 */
export function subscriptionGuard(minimumTier: SubscriptionTier): CanActivateFn {
  return (route, state) => {
    const subscriptionService = inject(SubscriptionService);
    const router = inject(Router);

    if (subscriptionService.hasMinimumTier(minimumTier)) {
      return true;
    }

    // Redirect to pricing page if insufficient tier
    router.navigate(['/pricing'], { 
      queryParams: { 
        returnUrl: state.url,
        requiredTier: minimumTier 
      } 
    });
    return false;
  };
}

/**
 * Feature-based guard
 * Usage: canActivate: [featureGuard('advancedCharts')]
 */
export function featureGuard(featureKey: string): CanActivateFn {
  return (route, state) => {
    const subscriptionService = inject(SubscriptionService);
    const router = inject(Router);

    if (subscriptionService.hasFeature(featureKey as any)) {
      return true;
    }

    router.navigate(['/pricing'], { 
      queryParams: { 
        returnUrl: state.url,
        requiredFeature: featureKey 
      } 
    });
    return false;
  };
}
