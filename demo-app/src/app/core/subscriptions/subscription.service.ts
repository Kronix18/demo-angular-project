import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  SubscriptionTier,
  Feature,
  FEATURE_TIERS,
  SUBSCRIPTION_TIER_INFO,
  UserSubscription,
  SubscriptionTierInfo
} from './subscription.types';
import { ApiService } from '../services/api.service';
import { AuthService } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private apiService = inject(ApiService);
  private authService = inject(AuthService);

  // Default guest tier subscription (for unauthenticated users)
  private defaultSubscription: UserSubscription = {
    userId: 'guest',
    tier: SubscriptionTier.GUEST,
    isAdmin: false,
    startDate: new Date(),
    renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    isActive: true
  };

  // Signals for reactive state
  userSubscription = signal<UserSubscription>(this.defaultSubscription);
  currentTier = signal<SubscriptionTier>(SubscriptionTier.GUEST);
  isAdmin = signal(false);

  // Observables for backward compatibility
  private subscriptionSubject = new BehaviorSubject<UserSubscription>(this.defaultSubscription);
  subscription$ = this.subscriptionSubject.asObservable();

  constructor() {
    this.loadUserSubscription();
    // Watch for auth changes
    this.authService.isLoggedIn$.subscribe(() => {
      this.loadUserSubscription();
    });
  }

  /**
   * Load user subscription from API or localStorage
   */
  private loadUserSubscription() {
    const user = this.authService.getCurrentUser()?.();
    const userId = user?.id;
    
    if (!userId) {
      // Reset to default if no user
      this.setSubscription(this.defaultSubscription);
      return;
    }

    // Check if user is admin from auth service
    const isAdmin = user?.isAdmin || false;

    // Try to load from localStorage first
    const cached = localStorage.getItem(`subscription_${userId}`);
    if (cached) {
      const subscription = JSON.parse(cached) as UserSubscription;
      // Update admin status from auth service
      subscription.isAdmin = isAdmin;
      this.setSubscription(subscription);
      return;
    }

    // Create default subscription with admin status
    const subscription: UserSubscription = {
      userId,
      tier: isAdmin ? SubscriptionTier.ADMIN : SubscriptionTier.FREE,
      isAdmin,
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true
    };

    this.setSubscription(subscription);
  }

  /**
   * Set user subscription
   */
  private setSubscription(subscription: UserSubscription) {
    this.userSubscription.set(subscription);
    this.currentTier.set(subscription.tier);
    this.isAdmin.set(subscription.isAdmin);
    this.subscriptionSubject.next(subscription);

    // Cache in localStorage
    localStorage.setItem(`subscription_${subscription.userId}`, JSON.stringify(subscription));
  }

  /**
   * Get user ID (from auth service or localStorage)
   */
  private getUserId(): string {
    const user = this.authService.getCurrentUser()?.();
    return user?.id || '';
  }

  /**
   * Check if user has access to a feature
   */
  hasFeature(feature: Feature): boolean {
    // Admins always have access
    if (this.isAdmin()) {
      return true;
    }

    const tier = this.currentTier();
    const availableFeatures = FEATURE_TIERS[tier];
    return availableFeatures.includes(feature);
  }

  /**
   * Check if user has access to multiple features
   */
  hasAllFeatures(...features: Feature[]): boolean {
    return features.every(feature => this.hasFeature(feature));
  }

  /**
   * Check if user has access to any of the features
   */
  hasAnyFeature(...features: Feature[]): boolean {
    return features.some(feature => this.hasFeature(feature));
  }

  /**
   * Get all available features for current tier
   */
  getAvailableFeatures(): Feature[] {
    return FEATURE_TIERS[this.currentTier()];
  }

  /**
   * Get subscription tier info
   */
  getTierInfo(tier?: SubscriptionTier): SubscriptionTierInfo {
    const targetTier = tier || this.currentTier();
    return SUBSCRIPTION_TIER_INFO[targetTier];
  }

  /**
   * Get current tier info
   */
  getCurrentTierInfo(): SubscriptionTierInfo {
    return this.getTierInfo();
  }

  /**
   * Upgrade subscription
   */
  upgradeTier(newTier: SubscriptionTier): Observable<UserSubscription> {
    return new Observable(observer => {
      const subscription = this.userSubscription();
      const upgraded: UserSubscription = {
        ...subscription,
        tier: newTier,
        startDate: new Date(),
        renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };
      
      this.setSubscription(upgraded);
      observer.next(upgraded);
      observer.complete();
    });
  }

  /**
   * Check if subscription is active
   */
  isSubscriptionActive(): boolean {
    const subscription = this.userSubscription();
    return subscription.isActive && new Date() < new Date(subscription.renewalDate);
  }

  /**
   * Get remaining days until renewal
   */
  getDaysUntilRenewal(): number {
    const subscription = this.userSubscription();
    const daysLeft = Math.ceil(
      (new Date(subscription.renewalDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return Math.max(0, daysLeft);
  }

  /**
   * Get all tier options
   */
  getAllTiers(): SubscriptionTierInfo[] {
    return Object.values(SubscriptionTier)
      .filter(tier => tier !== SubscriptionTier.ADMIN) // Don't show admin tier
      .map(tier => this.getTierInfo(tier as SubscriptionTier));
  }

  /**
   * Get feature limit for current tier
   */
  getFeatureLimit(limitKey: string): number {
    const tierInfo = this.getCurrentTierInfo();
    const limits = tierInfo.limits as Record<string, number>;
    return limits[limitKey] || 0;
  }

  /**
   * Set admin status (should only be called by backend)
   */
  setAdminStatus(isAdmin: boolean) {
    const subscription = this.userSubscription();
    const updated: UserSubscription = {
      ...subscription,
      isAdmin,
      tier: isAdmin ? SubscriptionTier.ADMIN : subscription.tier
    };
    this.setSubscription(updated);
  }

  /**
   * Create mock subscription for testing
   */
  createMockSubscription(userId: string, tier: SubscriptionTier, isAdmin: boolean = false): UserSubscription {
    const subscription: UserSubscription = {
      userId,
      tier: isAdmin ? SubscriptionTier.ADMIN : tier,
      isAdmin,
      startDate: new Date(),
      renewalDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true
    };
    this.setSubscription(subscription);
    return subscription;
  }
}
