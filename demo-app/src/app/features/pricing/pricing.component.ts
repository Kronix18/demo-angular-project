import { Component, OnInit, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SubscriptionService } from '../../core/subscriptions/subscription.service';
import { SubscriptionPlan, SubscriptionTier } from '../../core/subscriptions/subscription.types';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PricingComponent implements OnInit {
  private subscriptionService = inject(SubscriptionService);
  private router = inject(Router);

  plans: SubscriptionPlan[] = [];
  currentTier = this.subscriptionService.currentTier;
  isLoading = false;
  error = '';

  ngOnInit(): void {
    this.plans = this.subscriptionService.getPlans();
  }

  selectPlan(plan: SubscriptionPlan): void {
    if (plan.tier === SubscriptionTier.FREE) {
      // Free tier - no action needed
      return;
    }

    if (plan.tier === this.currentTier()) {
      // Already on this tier
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.subscriptionService.upgradeTier(plan.tier).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/profile']);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = 'Failed to upgrade subscription. Please try again.';
        console.error('Upgrade error:', err);
      }
    });
  }

  isCurrentPlan(tier: SubscriptionTier): boolean {
    return tier === this.currentTier();
  }

  getButtonText(tier: SubscriptionTier): string {
    if (tier === this.currentTier()) {
      return 'Current Plan';
    }
    if (tier === SubscriptionTier.FREE) {
      return 'Free Forever';
    }
    return 'Upgrade';
  }

  getButtonClass(tier: SubscriptionTier): string {
    if (tier === this.currentTier()) {
      return 'btn-current';
    }
    return 'btn-upgrade';
  }

  formatFeatureValue(value: number | boolean): string {
    if (typeof value === 'boolean') {
      return value ? '✓' : '✗';
    }
    if (value === -1) {
      return 'Unlimited';
    }
    return value.toString();
  }
}
