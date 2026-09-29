/** Typed mirror of the v2 API contract (docs/api/README.md). Types only, plus two tiny runtime helpers. */

export const TIERS = ['free', 'plus', 'pro', 'ultimate', 'admin'] as const;
export type Tier = (typeof TIERS)[number];

/** Datasets the backend can switch on (GET /api/meta → datasets). Unknown strings are tolerated at runtime. */
export type DatasetName =
  | 'security_master' | 'prices' | 'splits' | 'indices' | 'weekly_prices' | 'technicals'
  | 'rs_ratings' | 'eps_rating' | 'smr_rating' | 'composite' | 'accdist' | 'sponsorship' | 'group_rs'
  | 'filings' | 'fundamentals' | 'canslim' | 'patterns' | 'market' | 'institutional' | 'news' | 'events'
  | 'screener' | 'ratings' | 'backtest';

export interface ApiLimits {
  history_years?: number;
  max_results?: number;
  truncated?: boolean;
}

/** `meta` block of every v2 list/series response (README §3). */
export interface ApiMeta {
  as_of?: string;
  calculated_at?: string;
  model_version?: Record<string, string>;
  source?: string;
  price_basis?: 'split_adjusted';
  volume_basis?: 'as_reported' | 'split_adjusted';
  limits?: ApiLimits;
  total?: number;
  limit?: number;
  next_cursor?: string | null;
  [extra: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T[];
  meta: ApiMeta;
}

export type ApiErrorCode =
  | 'bad_request' | 'bad_interval' | 'bad_filter' | 'bad_field'
  | 'unauthenticated' | 'token_expired' | 'upgrade_required' | 'forbidden'
  | 'symbol_not_found' | 'not_found' | 'conflict' | 'validation_failed'
  | 'rate_limited' | 'data_not_ready';

export interface ApiErrorBody {
  error: ApiErrorCode | (string & {});
  message: string;
  details?: Record<string, unknown>;
}

export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return typeof v === 'object' && v !== null && typeof (v as ApiErrorBody).error === 'string' && typeof (v as ApiErrorBody).message === 'string';
}

export interface Benchmarks {
  default: string;
  market_indices: string[];
  is_interim?: boolean;
}

/** GET /api/meta (README §10). */
export interface MetaResponse {
  api_version: number;
  data_as_of: Record<string, string | null>;
  next_refresh_after: string | null;
  model_versions: Record<string, string | string[]>;
  datasets: (DatasetName | (string & {}))[];
  benchmarks?: Benchmarks;
  display_names?: Record<string, string>;
}

/** GET /api/chart/{symbol}/meta (docs/api/02-prices.md). */
export interface ChartMetaResponse {
  security_id: number;
  first_bar: string | null;
  last_bar: string | null;
  bar_count: number;
  intervals: string[];
  price_basis: 'split_adjusted';
  volume_basis: 'as_reported' | 'split_adjusted';
  split_count?: number;
  source?: string;
  price_scale?: number;
  currency?: string;
  delisted: boolean;
  datasets: Partial<Record<'technicals' | 'rs_line' | 'patterns' | 'fundamental_markers', boolean>> & Record<string, boolean>;
}
