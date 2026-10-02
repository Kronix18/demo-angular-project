import { Component, computed, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { SubscriptionService } from '../../core/subscriptions/subscription.service';
import { SubscriptionTier } from '../../core/subscriptions/subscription.types';
import { UserService, UserProfile } from '../../core/services/user.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  subscriptionService = inject(SubscriptionService);
  userService = inject(UserService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Profile data from backend
  userProfile = signal<UserProfile | null>(null);
  isLoading = signal<boolean>(true);
  error = signal<string>('');

  // Subscription data
  currentTier = this.subscriptionService.currentTier;
  features = this.subscriptionService.features;
  subscription = this.subscriptionService.subscription$;

  ngOnInit(): void {
    this.loadProfileData();
  }

  /**
   * Load user profile and subscription data from backend
   */
  loadProfileData(): void {
    this.isLoading.set(true);
    this.error.set('');

    // Fetch both user profile and subscription in parallel
    forkJoin({
      profile: this.userService.getProfile(),
      //subscription: this.subscriptionService.getSubscription()
    }).subscribe({
      next: ({ profile, /*subscription*/ }) => {
        console.log('Profile data received:', profile);
        this.userProfile.set(profile);
        
        // (the demo AuthService derives the user from its session; syncing real user data arrives with tasks 9.1 / 20.1)
        this.isLoading.set(false);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load profile data:', err);
        this.error.set('Failed to load profile data. Please try refreshing the page.');
        this.isLoading.set(false);
        this.cdr.markForCheck();
      }
    });
  }

  initials = computed(() => {
    const name = this.userProfile()?.name || '';
    const parts = name.trim().split(' ').filter(Boolean);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase() || 'U';
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  getTierDisplayName(tier: SubscriptionTier): string {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }

  getTierBadgeClass(tier: SubscriptionTier): string {
    const classes: Record<SubscriptionTier, string> = {
      [SubscriptionTier.FREE]: 'badge-free',
      [SubscriptionTier.PLUS]: 'badge-plus',
      [SubscriptionTier.PRO]: 'badge-pro',
      [SubscriptionTier.ULTIMATE]: 'badge-ultimate',
      [SubscriptionTier.ADMIN]: 'badge-admin'
    };
    return classes[tier] || 'badge-free';
  }

  navigateToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  getDaysRemaining(): number {
    return this.subscriptionService.getDaysRemaining();
  }

  getFeatureValue(value: number | boolean): string {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === -1) return 'Unlimited';
    return value.toString();
  }
}
