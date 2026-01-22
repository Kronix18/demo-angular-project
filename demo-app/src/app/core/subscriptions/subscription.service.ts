import { Injectable, signal, computed } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from '../services/api.service';
import { 
  Subscription, 
  SubscriptionTier, 
  SubscriptionFeatures, 
  SUBSCRIPTION_FEATURES,
  SubscriptionPlan,
  SUBSCRIPTION_PLANS
} from './subscription.types';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private readonly SUBSCRIPTION_KEY = 'user_subscription';
  
  // Current subscription state
  private currentSubscription = signal<Subscription | null>(this.getStoredSubscription());
  
  // Observable for components that need to react to subscription changes
  private subscriptionSubject = new BehaviorSubject<Subscription | null>(this.getStoredSubscription());
  public subscription$ = this.subscriptionSubject.asObservable();
  
  // Computed values
  public currentTier = computed(() => this.currentSubscription()?.tier || SubscriptionTier.FREE);
  public features = computed(() => this.getFeatures(this.currentTier()));
  public isActive = computed(() => this.currentSubscription()?.isActive ?? false);

  constructor(private apiService: ApiService) {}

  /**
   * Get user's current subscription from backend
   */
  getSubscription(): Observable<Subscription> {
    return this.apiService.get<Subscription>('api/subscription').pipe(
      tap(subscription => {
        this.updateSubscription(subscription);
      }),
      catchError(error => {
        console.error('Failed to fetch subscription:', error);
        // Return default free subscription on error
        const freeSubscription = this.createFreeSubscription();
        this.updateSubscription(freeSubscription);
        return of(freeSubscription);
      })
    );
  }

  /**
   * Upgrade or change subscription tier
   */
  upgradeTier(tier: SubscriptionTier, paymentMethod?: string): Observable<Subscription> {
    return this.apiService.post<Subscription>('api/subscription/upgrade', {
      tier,
      payment_method: paymentMethod
    }).pipe(
      tap(subscription => {
        this.updateSubscription(subscription);
        console.log('Subscription upgraded to:', tier);
      }),
      catchError(error => {
        console.error('Failed to upgrade subscription:', error);
        throw error;
      })
    );
  }

  /**
   * Cancel subscription
   */
  cancelSubscription(): Observable<Subscription> {
    return this.apiService.post<Subscription>('api/subscription/cancel', {}).pipe(
      tap(subscription => {
        this.updateSubscription(subscription);
        console.log('Subscription cancelled');
      }),
      catchError(error => {
        console.error('Failed to cancel subscription:', error);
        throw error;
      })
    );
  }

  /**
   * Reactivate cancelled subscription
   */
  reactivateSubscription(): Observable<Subscription> {
    return this.apiService.post<Subscription>('api/subscription/reactivate', {}).pipe(
      tap(subscription => {
        this.updateSubscription(subscription);
        console.log('Subscription reactivated');
      }),
      catchError(error => {
        console.error('Failed to reactivate subscription:', error);
        throw error;
      })
    );
  }

  /**
   * Get available subscription plans
   */
  getPlans(): SubscriptionPlan[] {
    return SUBSCRIPTION_PLANS;
  }

  /**
   * Check if user has access to a specific feature
   */
  hasFeature(featureKey: keyof SubscriptionFeatures): boolean {
    const features = this.features();
    return features[featureKey] as boolean;
  }

  /**
   * Check if user's tier is at least the specified tier
   */
  hasMinimumTier(minimumTier: SubscriptionTier): boolean {
    const tierHierarchy = [
      SubscriptionTier.FREE,
      SubscriptionTier.PLUS,
      SubscriptionTier.PRO,
      SubscriptionTier.ULTIMATE,
      SubscriptionTier.ADMIN
    ];
    
    const currentTierIndex = tierHierarchy.indexOf(this.currentTier());
    const minimumTierIndex = tierHierarchy.indexOf(minimumTier);
    
    return currentTierIndex >= minimumTierIndex;
  }

  /**
   * Check if user is admin
   */
  isAdmin(): boolean {
    return this.currentTier() === SubscriptionTier.ADMIN;
  }

  /**
   * Get features for a specific tier
   */
  getFeatures(tier: SubscriptionTier): SubscriptionFeatures {
    return SUBSCRIPTION_FEATURES[tier] || SUBSCRIPTION_FEATURES[SubscriptionTier.FREE];
  }

  /**
   * Get feature value (handles unlimited values)
   */
  getFeatureValue(featureKey: keyof SubscriptionFeatures): number | boolean | string {
    const features = this.features();
    const value = features[featureKey];
    
    if (typeof value === 'number' && value === -1) {
      return 'Unlimited';
    }
    
    return value;
  }

  /**
   * Check if feature limit is reached
   */
  isFeatureLimitReached(featureKey: keyof SubscriptionFeatures, currentUsage: number): boolean {
    const features = this.features();
    const limit = features[featureKey];
    
    // If limit is -1 (unlimited), never reached
    if (limit === -1) return false;
    
    // If limit is a number, check if usage exceeds it
    if (typeof limit === 'number') {
      return currentUsage >= limit;
    }
    
    return false;
  }

  /**
   * Get days remaining in subscription
   */
  getDaysRemaining(): number {
    const subscription = this.currentSubscription();
    if (!subscription?.endDate) return -1; // Unlimited or no end date
    
    const endDate = new Date(subscription.endDate);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  }

  /**
   * Update subscription in memory and storage
   */
  private updateSubscription(subscription: Subscription): void {
    this.currentSubscription.set(subscription);
    this.subscriptionSubject.next(subscription);
    localStorage.setItem(this.SUBSCRIPTION_KEY, JSON.stringify(subscription));
  }

  /**
   * Get stored subscription from localStorage
   */
  private getStoredSubscription(): Subscription | null {
    const stored = localStorage.getItem(this.SUBSCRIPTION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored subscription:', error);
      }
    }
    return null;
  }

  /**
   * Create default free subscription
   */
  private createFreeSubscription(): Subscription {
    return {
      id: 'free-default',
      userId: '',
      tier: SubscriptionTier.FREE,
      startDate: new Date().toISOString(),
      endDate: null,
      isActive: true,
      autoRenew: false,
      features: SUBSCRIPTION_FEATURES[SubscriptionTier.FREE]
    };
  }

  /**
   * Clear subscription on logout
   */
  clearSubscription(): void {
    this.currentSubscription.set(null);
    this.subscriptionSubject.next(null);
    localStorage.removeItem(this.SUBSCRIPTION_KEY);
  }
}
