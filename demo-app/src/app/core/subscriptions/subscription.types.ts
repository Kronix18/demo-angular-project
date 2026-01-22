export enum SubscriptionTier {
  FREE = 'free',
  PLUS = 'plus',
  PRO = 'pro',
  ULTIMATE = 'ultimate',
  ADMIN = 'admin'
}

export interface SubscriptionFeatures {
  // Stock screener features
  maxScreenerResults: number;
  advancedFilters: boolean;
  exportData: boolean;
  
  // Chart features
  advancedCharts: boolean;
  historicalDataYears: number;
  technicalIndicators: boolean;
  
  // Watchlist features
  maxWatchlists: number;
  maxStocksPerWatchlist: number;
  priceAlerts: boolean;
  
  // API features
  apiAccess: boolean;
  apiCallsPerDay: number;
  
  // General features
  adsEnabled: boolean;
  prioritySupport: boolean;
  customDashboard: boolean;
  portfolioTracking: boolean;
  realTimeData: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  autoRenew: boolean;
  paymentMethod?: string;
  lastPaymentDate?: string;
  nextBillingDate?: string;
  cancelledAt?: string;
  features: SubscriptionFeatures;
}

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  description: string;
  price: number;
  billingPeriod: 'monthly' | 'yearly';
  features: SubscriptionFeatures;
  popular?: boolean;
  savings?: string;
}

// Define features for each tier
export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, SubscriptionFeatures> = {
  [SubscriptionTier.FREE]: {
    maxScreenerResults: 50,
    advancedFilters: false,
    exportData: false,
    advancedCharts: false,
    historicalDataYears: 1,
    technicalIndicators: false,
    maxWatchlists: 1,
    maxStocksPerWatchlist: 10,
    priceAlerts: false,
    apiAccess: false,
    apiCallsPerDay: 0,
    adsEnabled: true,
    prioritySupport: false,
    customDashboard: false,
    portfolioTracking: false,
    realTimeData: false
  },
  [SubscriptionTier.PLUS]: {
    maxScreenerResults: 200,
    advancedFilters: true,
    exportData: true,
    advancedCharts: true,
    historicalDataYears: 3,
    technicalIndicators: false,
    maxWatchlists: 3,
    maxStocksPerWatchlist: 25,
    priceAlerts: true,
    apiAccess: false,
    apiCallsPerDay: 0,
    adsEnabled: false,
    prioritySupport: false,
    customDashboard: false,
    portfolioTracking: true,
    realTimeData: false
  },
  [SubscriptionTier.PRO]: {
    maxScreenerResults: 500,
    advancedFilters: true,
    exportData: true,
    advancedCharts: true,
    historicalDataYears: 10,
    technicalIndicators: true,
    maxWatchlists: 10,
    maxStocksPerWatchlist: 100,
    priceAlerts: true,
    apiAccess: true,
    apiCallsPerDay: 1000,
    adsEnabled: false,
    prioritySupport: true,
    customDashboard: true,
    portfolioTracking: true,
    realTimeData: false
  },
  [SubscriptionTier.ULTIMATE]: {
    maxScreenerResults: -1, // Unlimited
    advancedFilters: true,
    exportData: true,
    advancedCharts: true,
    historicalDataYears: 20,
    technicalIndicators: true,
    maxWatchlists: -1, // Unlimited
    maxStocksPerWatchlist: -1, // Unlimited
    priceAlerts: true,
    apiAccess: true,
    apiCallsPerDay: 10000,
    adsEnabled: false,
    prioritySupport: true,
    customDashboard: true,
    portfolioTracking: true,
    realTimeData: true
  },
  [SubscriptionTier.ADMIN]: {
    maxScreenerResults: -1, // Unlimited
    advancedFilters: true,
    exportData: true,
    advancedCharts: true,
    historicalDataYears: -1, // Unlimited
    technicalIndicators: true,
    maxWatchlists: -1, // Unlimited
    maxStocksPerWatchlist: -1, // Unlimited
    priceAlerts: true,
    apiAccess: true,
    apiCallsPerDay: -1, // Unlimited
    adsEnabled: false,
    prioritySupport: true,
    customDashboard: true,
    portfolioTracking: true,
    realTimeData: true
  }
};

// Subscription plans for display
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Perfect for getting started',
    price: 0,
    billingPeriod: 'monthly',
    features: SUBSCRIPTION_FEATURES[SubscriptionTier.FREE]
  },
  {
    tier: SubscriptionTier.PLUS,
    name: 'Plus',
    description: 'For active traders',
    price: 9.99,
    billingPeriod: 'monthly',
    features: SUBSCRIPTION_FEATURES[SubscriptionTier.PLUS]
  },
  {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    description: 'For professional investors',
    price: 29.99,
    billingPeriod: 'monthly',
    features: SUBSCRIPTION_FEATURES[SubscriptionTier.PRO],
    popular: true
  },
  {
    tier: SubscriptionTier.ULTIMATE,
    name: 'Ultimate',
    description: 'For institutional investors',
    price: 99.99,
    billingPeriod: 'monthly',
    features: SUBSCRIPTION_FEATURES[SubscriptionTier.ULTIMATE]
  }
];
