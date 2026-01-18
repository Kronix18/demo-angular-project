// Subscription tier definitions (8-tier system with detailed limits)
export enum SubscriptionTier {
  GUEST = 'guest', // Unauthenticated users - no account required
  FREE = 'free',
  BASIC = 'basic',
  STANDARD = 'standard',
  PRO = 'pro',
  BUSINESS = 'business',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin' // Special tier with all features
}

// Feature availability definitions
export enum Feature {
  // Screener features
  SCREENER_BASIC = 'screener_basic',
  SCREENER_ADVANCED_FILTERS = 'screener_advanced_filters',
  SCREENER_PRESETS = 'screener_presets',
  SCREENER_EXPORT = 'screener_export',
  SCREENER_TECHNICAL_PATTERNS = 'screener_technical_patterns',

  // Portfolio features
  PORTFOLIO_TRACKING = 'portfolio_tracking',
  PORTFOLIO_ANALYTICS = 'portfolio_analytics',
  PORTFOLIO_BENCHMARK = 'portfolio_benchmark',

  // Watchlist features
  WATCHLIST_BASIC = 'watchlist_basic',
  WATCHLIST_ALERTS = 'watchlist_alerts',
  WATCHLIST_NOTIFICATIONS = 'watchlist_notifications',

  // Stock features
  STOCK_DETAILS = 'stock_details',
  STOCK_NEWS = 'stock_news',
  STOCK_EARNINGS = 'stock_earnings',
  STOCK_ANALYST_RATINGS = 'stock_analyst_ratings',
  STOCK_INSIDER_TRADING = 'stock_insider_trading',
  STOCK_TECHNICAL_ANALYSIS = 'stock_technical_analysis',

  // Charting & indicators
  CHARTS_BASIC = 'charts_basic',
  INDICATORS_BASIC = 'indicators_basic',
  INDICATORS_ADVANCED = 'indicators_advanced',
  VOLUME_PROFILE = 'volume_profile',
  VOLUME_FOOTPRINT = 'volume_footprint',
  AUTO_CHART_PATTERNS = 'auto_chart_patterns',

  // Alerts
  PRICE_ALERTS = 'price_alerts',
  TECHNICAL_ALERTS = 'technical_alerts',
  MULTI_CONDITION_ALERTS = 'multi_condition_alerts',
  ALERTS_NO_EXPIRY = 'alerts_no_expiry',

  // Advanced
  CUSTOM_TIMEFRAMES = 'custom_timeframes',
  CUSTOM_FORMULAS = 'custom_formulas',
  CUSTOM_INDICATORS = 'custom_indicators',
  SECOND_BASED_INTERVALS = 'second_based_intervals',
  TICK_BASED_INTERVALS = 'tick_based_intervals',

  // Data & Export
  EXPORT_CSV = 'export_csv',
  EXPORT_PDF = 'export_pdf',
  CHART_DATA_EXPORT = 'chart_data_export',
  HISTORICAL_DATA_ACCESS = 'historical_data_access',

  // API & Integration
  API_ACCESS = 'api_access',
  API_REAL_TIME_QUOTES = 'api_real_time_quotes',
  PROFESSIONAL_DATA = 'professional_data',

  // Support & Misc
  NO_ADS = 'no_ads',
  PRIORITY_SUPPORT = 'priority_support',
  PUBLISH_SCRIPTS = 'publish_scripts'
}

// Feature availability map
export const FEATURE_TIERS: Record<SubscriptionTier, Feature[]> = {
  [SubscriptionTier.GUEST]: [
    // Guest users have no features - view home and pricing only
  ],
  [SubscriptionTier.FREE]: [
    Feature.SCREENER_BASIC,
    Feature.CHARTS_BASIC,
    Feature.INDICATORS_BASIC,
    Feature.WATCHLIST_BASIC,
    Feature.STOCK_DETAILS,
    Feature.STOCK_NEWS,
    Feature.NO_ADS
  ],
  [SubscriptionTier.BASIC]: [
    Feature.SCREENER_BASIC,
    Feature.SCREENER_ADVANCED_FILTERS,
    Feature.SCREENER_PRESETS,
    Feature.CHARTS_BASIC,
    Feature.INDICATORS_BASIC,
    Feature.VOLUME_PROFILE,
    Feature.CUSTOM_TIMEFRAMES,
    Feature.WATCHLIST_BASIC,
    Feature.WATCHLIST_ALERTS,
    Feature.STOCK_DETAILS,
    Feature.STOCK_NEWS,
    Feature.STOCK_EARNINGS,
    Feature.STOCK_ANALYST_RATINGS,
    Feature.PRICE_ALERTS,
    Feature.TECHNICAL_ALERTS,
    Feature.EXPORT_CSV,
    Feature.CHART_DATA_EXPORT,
    Feature.CUSTOM_FORMULAS,
    Feature.ALERTS_NO_EXPIRY,
    Feature.NO_ADS,
    Feature.PUBLISH_SCRIPTS,
    Feature.SECOND_BASED_INTERVALS,
    Feature.TICK_BASED_INTERVALS,
    Feature.PROFESSIONAL_DATA,
    Feature.PRIORITY_SUPPORT,
    Feature.API_ACCESS
  ],
  [SubscriptionTier.STANDARD]: [
    Feature.SCREENER_BASIC,
    Feature.SCREENER_ADVANCED_FILTERS,
    Feature.SCREENER_PRESETS,
    Feature.SCREENER_EXPORT,
    Feature.SCREENER_TECHNICAL_PATTERNS,
    Feature.CHARTS_BASIC,
    Feature.INDICATORS_BASIC,
    Feature.INDICATORS_ADVANCED,
    Feature.VOLUME_PROFILE,
    Feature.CUSTOM_TIMEFRAMES,
    Feature.CUSTOM_FORMULAS,
    Feature.CUSTOM_INDICATORS,
    Feature.AUTO_CHART_PATTERNS,
    Feature.WATCHLIST_BASIC,
    Feature.WATCHLIST_ALERTS,
    Feature.WATCHLIST_NOTIFICATIONS,
    Feature.STOCK_DETAILS,
    Feature.STOCK_NEWS,
    Feature.STOCK_EARNINGS,
    Feature.STOCK_ANALYST_RATINGS,
    Feature.STOCK_INSIDER_TRADING,
    Feature.STOCK_TECHNICAL_ANALYSIS,
    Feature.PRICE_ALERTS,
    Feature.TECHNICAL_ALERTS,
    Feature.MULTI_CONDITION_ALERTS,
    Feature.ALERTS_NO_EXPIRY,
    Feature.EXPORT_CSV,
    Feature.EXPORT_PDF,
    Feature.CHART_DATA_EXPORT,
    Feature.HISTORICAL_DATA_ACCESS,
    Feature.NO_ADS,
    Feature.PUBLISH_SCRIPTS,
    Feature.SECOND_BASED_INTERVALS,
    Feature.TICK_BASED_INTERVALS,
    Feature.PROFESSIONAL_DATA,
    Feature.PRIORITY_SUPPORT,
    Feature.API_ACCESS,
    Feature.API_REAL_TIME_QUOTES
  ],
  [SubscriptionTier.PRO]: [
    Feature.SCREENER_BASIC,
    Feature.SCREENER_ADVANCED_FILTERS,
    Feature.SCREENER_PRESETS,
    Feature.SCREENER_EXPORT,
    Feature.SCREENER_TECHNICAL_PATTERNS,
    Feature.PORTFOLIO_TRACKING,
    Feature.PORTFOLIO_ANALYTICS,
    Feature.PORTFOLIO_BENCHMARK,
    Feature.CHARTS_BASIC,
    Feature.INDICATORS_BASIC,
    Feature.INDICATORS_ADVANCED,
    Feature.VOLUME_PROFILE,
    Feature.VOLUME_FOOTPRINT,
    Feature.AUTO_CHART_PATTERNS,
    Feature.CUSTOM_TIMEFRAMES,
    Feature.CUSTOM_FORMULAS,
    Feature.CUSTOM_INDICATORS,
    Feature.WATCHLIST_BASIC,
    Feature.WATCHLIST_ALERTS,
    Feature.WATCHLIST_NOTIFICATIONS,
    Feature.STOCK_DETAILS,
    Feature.STOCK_NEWS,
    Feature.STOCK_EARNINGS,
    Feature.STOCK_ANALYST_RATINGS,
    Feature.STOCK_INSIDER_TRADING,
    Feature.STOCK_TECHNICAL_ANALYSIS,
    Feature.PRICE_ALERTS,
    Feature.TECHNICAL_ALERTS,
    Feature.MULTI_CONDITION_ALERTS,
    Feature.ALERTS_NO_EXPIRY,
    Feature.EXPORT_CSV,
    Feature.EXPORT_PDF,
    Feature.CHART_DATA_EXPORT,
    Feature.HISTORICAL_DATA_ACCESS,
    Feature.NO_ADS,
    Feature.PUBLISH_SCRIPTS,
    Feature.SECOND_BASED_INTERVALS,
    Feature.TICK_BASED_INTERVALS,
    Feature.PROFESSIONAL_DATA,
    Feature.PRIORITY_SUPPORT,
    Feature.API_ACCESS,
    Feature.API_REAL_TIME_QUOTES
  ],
  [SubscriptionTier.BUSINESS]: [
    // Business gets ALL features
    ...Object.values(Feature)
  ],
  [SubscriptionTier.ENTERPRISE]: [
    // Enterprise gets ALL features (plus higher limits defined elsewhere)
    ...Object.values(Feature)
  ],
  [SubscriptionTier.ADMIN]: [
    // Admin gets ALL features including future ones
    ...Object.values(Feature)
  ]
};

// Subscription tier metadata with detailed limits
export interface SubscriptionTierInfo {
  tier: SubscriptionTier;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  trialDays: number;
  features: string[];
  limits: {
    chartsPerTab: number;
    indicatorsPerChart: number;
    historicalBars: number;
    parallelConnections: number;
    priceAlerts: number;
    technicalAlerts: number;
    watchlistAlerts: number;
    savedPresets: number;
    watchlists: number;
    portfolios: number;
    apiCallsPerMonth: number;
  };
}

export const SUBSCRIPTION_TIER_INFO: Record<SubscriptionTier, SubscriptionTierInfo> = {
  [SubscriptionTier.GUEST]: {
    tier: SubscriptionTier.GUEST,
    name: 'Guest',
    description: 'View home and pricing without an account',
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: [
      'Home page access',
      'Pricing page access',
      'Account registration'
    ],
    limits: {
      chartsPerTab: 0,
      indicatorsPerChart: 0,
      historicalBars: 0,
      parallelConnections: 0,
      priceAlerts: 0,
      technicalAlerts: 0,
      watchlistAlerts: 0,
      savedPresets: 0,
      watchlists: 0,
      portfolios: 0,
      apiCallsPerMonth: 0
    }
  },
  [SubscriptionTier.FREE]: {
    tier: SubscriptionTier.FREE,
    name: 'Free',
    description: 'Get started with basic screening',
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: [
      'Basic stock screener',
      'Basic watchlists (3)',
      'Stock details & news',
      'Basic charts & indicators',
      'Basic technical analysis'
    ],
    limits: {
      chartsPerTab: 1,
      indicatorsPerChart: 2,
      historicalBars: 5000,
      parallelConnections: 1,
      priceAlerts: 0,
      technicalAlerts: 0,
      watchlistAlerts: 0,
      savedPresets: 1,
      watchlists: 3,
      portfolios: 0,
      apiCallsPerMonth: 1000
    }
  },
  [SubscriptionTier.BASIC]: {
    tier: SubscriptionTier.BASIC,
    name: 'Basic',
    description: 'Perfect for active investors',
    monthlyPrice: 12,
    annualPrice: 0,
    trialDays: 30,
    features: [
      '2 charts per tab',
      '5 indicators per chart',
      '10K historical bars',
      '10 parallel connections',
      '20 price alerts',
      '20 technical alerts',
      'Volume profile & custom timeframes',
      'Custom formulas & Range Bars',
      'Multiple watchlists & alerts',
      'No ads',
      'Indicators on indicators',
      'Chart data export',
      'Renko, Kagi, Line Break charts',
      'Multi-condition alerts',
      'Alerts that don\'t expire',
      'Publishing & scripts',
      'Second & tick-based intervals',
      'Professional market data',
      'Priority support'
    ],
    limits: {
      chartsPerTab: 2,
      indicatorsPerChart: 5,
      historicalBars: 10000,
      parallelConnections: 10,
      priceAlerts: 20,
      technicalAlerts: 20,
      watchlistAlerts: 0,
      savedPresets: 50,
      watchlists: 10,
      portfolios: 5,
      apiCallsPerMonth: 10000
    }
  },
  [SubscriptionTier.STANDARD]: {
    tier: SubscriptionTier.STANDARD,
    name: 'Standard',
    description: 'For serious technical traders',
    monthlyPrice: 29,
    annualPrice: 0,
    trialDays: 30,
    features: [
      '4 charts per tab',
      '10 indicators per chart',
      '10K historical bars',
      '20 parallel connections',
      '100 price alerts',
      '100 technical alerts',
      'Volume profile & footprint',
      'Custom timeframes & formulas',
      'Auto chart patterns',
      'Multiple watchlists & unlimited alerts',
      'Bar replay & indicators on indicators',
      'Full chart data export',
      'Advanced Renko, Kagi, Point & Figure',
      'Custom range bars & timeframes',
      'Multi-condition alerts',
      'Alerts that don\'t expire',
      'Publishing & scripts',
      'Second & tick-based intervals',
      'Professional market data',
      'Priority support'
    ],
    limits: {
      chartsPerTab: 4,
      indicatorsPerChart: 10,
      historicalBars: 10000,
      parallelConnections: 20,
      priceAlerts: 100,
      technicalAlerts: 100,
      watchlistAlerts: 0,
      savedPresets: 100,
      watchlists: 25,
      portfolios: 10,
      apiCallsPerMonth: 50000
    }
  },
  [SubscriptionTier.PRO]: {
    tier: SubscriptionTier.PRO,
    name: 'Pro',
    description: 'Professional-grade analysis tools',
    monthlyPrice: 59,
    annualPrice: 0,
    trialDays: 30,
    features: [
      '8 charts per tab',
      '25 indicators per chart',
      '20K historical bars',
      '50 parallel connections',
      '400 price alerts',
      '400 technical alerts',
      '2 watchlist alerts',
      'Volume profile, footprint & candles',
      'Auto chart patterns & custom formulas',
      'Bar replay with all chart types',
      'Time Price Opportunity & TPO',
      'Custom timeframes & indicators',
      'Advanced pattern recognition',
      'Unlimited alert conditions',
      'Full data export (CSV, PDF, charts)',
      'Renko, Kagi, Line Break, P&F charts',
      'Charts based on custom formulas',
      'Professional market data access',
      'Alerts that don\'t expire',
      'Publishing & scripts',
      'Second & tick-based intervals',
      'Priority support'
    ],
    limits: {
      chartsPerTab: 8,
      indicatorsPerChart: 25,
      historicalBars: 20000,
      parallelConnections: 50,
      priceAlerts: 400,
      technicalAlerts: 400,
      watchlistAlerts: 2,
      savedPresets: 200,
      watchlists: 100,
      portfolios: 50,
      apiCallsPerMonth: 200000
    }
  },
  [SubscriptionTier.BUSINESS]: {
    tier: SubscriptionTier.BUSINESS,
    name: 'Business',
    description: 'Maximum power & professional tools',
    monthlyPrice: 149,
    annualPrice: 0,
    trialDays: 7,
    features: [
      '16 charts per tab',
      '50 indicators per chart',
      '40K historical bars',
      '200 parallel connections',
      '1,000 price alerts',
      '1,000 technical alerts',
      '15 watchlist alerts',
      'Volume profile, footprint, candles & TPO',
      'Auto chart patterns with AI detection',
      'Advanced bar replay with all types',
      'Time Price Opportunity analysis',
      'Unlimited custom indicators & formulas',
      'Advanced pattern recognition',
      'Unlimited alert conditions & rules',
      'Complete data export (all formats)',
      'All chart types & customizations',
      'Professional market data (premium)',
      'Alerts that never expire',
      'Unlimited publishing & scripts',
      'Second & tick-based intervals',
      'Multi-account management',
      'Elite support (24/7)',
      'Advanced analytics dashboard',
      'Custom API access'
    ],
    limits: {
      chartsPerTab: 16,
      indicatorsPerChart: 50,
      historicalBars: 40000,
      parallelConnections: 200,
      priceAlerts: 1000,
      technicalAlerts: 1000,
      watchlistAlerts: 15,
      savedPresets: 500,
      watchlists: 500,
      portfolios: 200,
      apiCallsPerMonth: 1000000
    }
  },
  [SubscriptionTier.ENTERPRISE]: {
    tier: SubscriptionTier.ENTERPRISE,
    name: 'Enterprise',
    description: 'Custom limits and enterprise support',
    monthlyPrice: 299,
    annualPrice: 0,
    trialDays: 14,
    features: [
      'Everything in Business',
      'Custom SLAs & support',
      'Single Sign-On (SSO)',
      'Advanced audit logs',
      'Dedicated account manager',
      'Custom API rate limits',
      'On-premise options'
    ],
    limits: {
      chartsPerTab: 16,
      indicatorsPerChart: 50,
      historicalBars: 60000,
      parallelConnections: 300,
      priceAlerts: 2000,
      technicalAlerts: 2000,
      watchlistAlerts: 25,
      savedPresets: 1000,
      watchlists: 1000,
      portfolios: 500,
      apiCallsPerMonth: 5000000
    }
  },
  [SubscriptionTier.ADMIN]: {
    tier: SubscriptionTier.ADMIN,
    name: 'Admin',
    description: 'Administrative access',
    monthlyPrice: 0,
    annualPrice: 0,
    trialDays: 0,
    features: [
      'All Enterprise features',
      'Admin dashboard',
      'User management',
      'System monitoring',
      'Unlimited everything'
    ],
    limits: {
      chartsPerTab: 999,
      indicatorsPerChart: 999,
      historicalBars: 999999,
      parallelConnections: 999,
      priceAlerts: 999999,
      technicalAlerts: 999999,
      watchlistAlerts: 999,
      savedPresets: 9999,
      watchlists: 9999,
      portfolios: 9999,
      apiCallsPerMonth: 9999999
    }
  }
};

// User subscription info
export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  isAdmin: boolean;
  startDate: Date;
  renewalDate: Date;
  isActive: boolean;
}
