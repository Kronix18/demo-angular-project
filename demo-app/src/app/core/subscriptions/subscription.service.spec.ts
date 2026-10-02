import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import type { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of, throwError, firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { SubscriptionService } from './subscription.service';
import { SUBSCRIPTION_FEATURES, SubscriptionTier, Subscription } from './subscription.types';
import { featureGuard, subscriptionGuard } from '../guards/subscription.guard';

const sub = (tier: SubscriptionTier, extra: Partial<Subscription> = {}): Subscription => ({
  id: 's', userId: 'u', tier, startDate: '2026-01-01', endDate: null, isActive: true, autoRenew: false,
  features: SUBSCRIPTION_FEATURES[tier], ...extra,
});

describe('SubscriptionService + guards (coverage gate 7.1)', () => {
  let api: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> };
  const make = () => TestBed.inject(SubscriptionService);

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api = { get: vi.fn(), post: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });
  afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

  it('defaults to FREE / inactive and rehydrates a stored subscription (ignoring corrupt JSON)', () => {
    expect(make().currentTier()).toBe(SubscriptionTier.FREE);
    expect(make().isActive()).toBe(false);
    TestBed.resetTestingModule();
    localStorage.setItem('user_subscription', JSON.stringify(sub(SubscriptionTier.PRO)));
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    expect(make().currentTier()).toBe(SubscriptionTier.PRO);
    TestBed.resetTestingModule();
    localStorage.setItem('user_subscription', '{not json');
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    expect(make().currentTier()).toBe(SubscriptionTier.FREE);
  });

  it('getSubscription stores the backend result; falls back to FREE on error', async () => {
    const s = make();
    api.get.mockReturnValueOnce(of(sub(SubscriptionTier.PLUS)));
    await firstValueFrom(s.getSubscription());
    expect(s.currentTier()).toBe(SubscriptionTier.PLUS);
    expect(JSON.parse(localStorage.getItem('user_subscription')!).tier).toBe('plus');
    api.get.mockReturnValueOnce(throwError(() => new Error('down')));
    const fallback = await firstValueFrom(s.getSubscription());
    expect(fallback.tier).toBe(SubscriptionTier.FREE);
    expect(s.currentTier()).toBe(SubscriptionTier.FREE);
  });

  it('upgrade / cancel / reactivate update state and rethrow failures', async () => {
    const s = make();
    api.post.mockReturnValueOnce(of(sub(SubscriptionTier.PRO)));
    await firstValueFrom(s.upgradeTier(SubscriptionTier.PRO, 'card'));
    expect(api.post).toHaveBeenCalledWith('api/subscription/upgrade', { tier: 'pro', payment_method: 'card' });
    expect(s.currentTier()).toBe(SubscriptionTier.PRO);
    api.post.mockReturnValueOnce(of(sub(SubscriptionTier.PRO, { isActive: false })));
    await firstValueFrom(s.cancelSubscription());
    expect(s.isActive()).toBe(false);
    api.post.mockReturnValueOnce(of(sub(SubscriptionTier.PRO)));
    await firstValueFrom(s.reactivateSubscription());
    expect(s.isActive()).toBe(true);
    for (const call of [() => s.upgradeTier(SubscriptionTier.PLUS), () => s.cancelSubscription(), () => s.reactivateSubscription()]) {
      api.post.mockReturnValueOnce(throwError(() => new Error('x')));
      await expect(firstValueFrom(call())).rejects.toThrow('x');
    }
  });

  it('tier hierarchy, admin, features, limits and unlimited values', () => {
    const s = make();
    expect(s.getPlans().length).toBeGreaterThan(0);
    expect(s.hasMinimumTier(SubscriptionTier.FREE)).toBe(true);
    expect(s.hasMinimumTier(SubscriptionTier.PLUS)).toBe(false);
    expect(s.isAdmin()).toBe(false);
    (s as any).updateSubscription(sub(SubscriptionTier.ADMIN));
    expect(s.isAdmin()).toBe(true);
    expect(s.hasMinimumTier(SubscriptionTier.ULTIMATE)).toBe(true);
    expect(s.getFeatures('nope' as SubscriptionTier)).toEqual(SUBSCRIPTION_FEATURES[SubscriptionTier.FREE]);
    const numeric = (Object.keys(SUBSCRIPTION_FEATURES[SubscriptionTier.FREE]) as (keyof typeof SUBSCRIPTION_FEATURES.free)[])
      .find((k) => typeof SUBSCRIPTION_FEATURES[SubscriptionTier.FREE][k] === 'number' && (SUBSCRIPTION_FEATURES[SubscriptionTier.FREE][k] as number) > 0)!;
    const limit = SUBSCRIPTION_FEATURES[SubscriptionTier.ADMIN][numeric] as number;
    expect(s.getFeatureValue(numeric)).toBe(limit === -1 ? 'Unlimited' : limit);
    if (limit === -1) expect(s.isFeatureLimitReached(numeric, 1e9)).toBe(false);
    s.clearSubscription();
    const cap = SUBSCRIPTION_FEATURES[SubscriptionTier.FREE][numeric] as number;
    expect(s.isFeatureLimitReached(numeric, cap)).toBe(true);
    expect(s.isFeatureLimitReached(numeric, cap - 1)).toBe(false);
    expect(localStorage.getItem('user_subscription')).toBeNull();
  });

  it('days remaining: -1 without an end date, ceil to days, never negative', () => {
    const s = make();
    expect(s.getDaysRemaining()).toBe(-1);
    (s as any).updateSubscription(sub(SubscriptionTier.PLUS, { endDate: new Date(Date.now() + 36 * 3600 * 1000).toISOString() }));
    expect(s.getDaysRemaining()).toBe(2);
    (s as any).updateSubscription(sub(SubscriptionTier.PLUS, { endDate: '2000-01-01' }));
    expect(s.getDaysRemaining()).toBe(0);
  });

  describe('guards', () => {
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/charts/msft' } as RouterStateSnapshot;
    let navigate: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      navigate = vi.fn().mockResolvedValue(true);
      TestBed.overrideProvider(Router, { useValue: { navigate } });
    });
    const run = (g: any) => TestBed.runInInjectionContext(() => g(route, state));

    it('subscriptionGuard passes with enough tier, otherwise redirects to /pricing with context', () => {
      expect(run(subscriptionGuard(SubscriptionTier.FREE))).toBe(true);
      expect(run(subscriptionGuard(SubscriptionTier.PRO))).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/pricing'], { queryParams: { returnUrl: '/charts/msft', requiredTier: 'pro' } });
    });

    it('featureGuard redirects when the feature is off', () => {
      const s = make();
      const offKey = (Object.keys(SUBSCRIPTION_FEATURES[SubscriptionTier.FREE]) as string[])
        .find((k) => (SUBSCRIPTION_FEATURES[SubscriptionTier.FREE] as any)[k] === false)!;
      expect(run(featureGuard(offKey))).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/pricing'], { queryParams: { returnUrl: '/charts/msft', requiredFeature: offKey } });
      (s as any).updateSubscription(sub(SubscriptionTier.ADMIN));
      expect(run(featureGuard(offKey))).toBe((SUBSCRIPTION_FEATURES[SubscriptionTier.ADMIN] as any)[offKey]);
    });
  });
});
