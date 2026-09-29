import { ApiEnvelope, ApiErrorBody, ApiErrorCode, ApiMeta, DatasetName, MetaResponse, Tier, TIERS, isApiErrorBody } from './types';

// Compile-time checks mirror the examples in docs/api/README.md; the runtime asserts keep the file meaningful.
describe('API contract types (task 12.1, docs/api/README.md §2-§5,§10)', () => {
  it('envelope + meta accept the documented example', () => {
    const meta = {
      as_of: '2026-09-22',
      calculated_at: '2026-09-23T02:14:05Z',
      model_version: { eps: 'EPS_V5_3', rs: 'RS_12M_V1' },
      source: 'stooq',
      limits: { history_years: 3, truncated: true },
      total: 3508,
      limit: 50,
      next_cursor: 'eyJvIjo1MH0',
    } satisfies ApiMeta;
    const env = { data: [{ security_id: 1 }], meta } satisfies ApiEnvelope<{ security_id: number }>;
    expect(env.meta.limits?.truncated).toBe(true);
  });

  it('error body carries the documented codes', () => {
    const codes: ApiErrorCode[] = ['bad_request', 'bad_interval', 'bad_filter', 'bad_field', 'unauthenticated', 'token_expired', 'upgrade_required', 'forbidden', 'symbol_not_found', 'not_found', 'conflict', 'validation_failed', 'rate_limited', 'data_not_ready'];
    const body = { error: 'upgrade_required', message: 'needs pro', details: { required_tier: 'pro', feature: 'patterns' } } satisfies ApiErrorBody;
    expect(codes).toContain(body.error);
  });

  it('isApiErrorBody recognises the shape and rejects others', () => {
    expect(isApiErrorBody({ error: 'not_found', message: 'x' })).toBe(true);
    expect(isApiErrorBody({ message: 'x' })).toBe(false);
    expect(isApiErrorBody(null)).toBe(false);
    expect(isApiErrorBody('boom')).toBe(false);
  });

  it('tiers match the subscription tiers and order low to high', () => {
    const t: Tier = 'ultimate';
    expect(TIERS).toEqual(['free', 'plus', 'pro', 'ultimate', 'admin']);
    expect(TIERS.indexOf(t)).toBeGreaterThan(TIERS.indexOf('pro'));
  });

  it('GET /api/meta response type matches the documented example', () => {
    const d: DatasetName = 'technicals';
    const m = {
      api_version: 2,
      data_as_of: { prices: '2026-09-22', technicals: '2026-09-22' },
      benchmarks: { default: 'TSX', market_indices: ['NDQ', 'TSX'], is_interim: true },
      display_names: { smr_rating: 'Quality (Sales·Margins·ROE)' },
      next_refresh_after: null,
      model_versions: { technicals: 'TECHNICAL_DAILY_V1' },
      datasets: [d, 'prices'],
    } satisfies MetaResponse;
    expect(m.datasets).toContain('technicals');
  });
});
