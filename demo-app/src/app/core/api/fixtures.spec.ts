import meta from '../../../../docs/api/fixtures/meta.json';
import chartMeta from '../../../../docs/api/fixtures/chart-meta-msft.json';
import ohlcv from '../../../../docs/api/fixtures/ohlcv-msft.json';
import ohlcvCol from '../../../../docs/api/fixtures/ohlcv-msft.columnar.json';
import technicals from '../../../../docs/api/fixtures/technicals-msft.json';
import ratings from '../../../../docs/api/fixtures/ratings-msft.json';
import fields from '../../../../docs/api/fixtures/screener-fields.json';
import run from '../../../../docs/api/fixtures/screener-run.json';
import ent from '../../../../docs/api/fixtures/entitlements-pro.json';
import plans from '../../../../docs/api/fixtures/plans.json';
import { MetaResponse } from './types';

/** Contract fixtures (task 12.2): they must obey the conventions in docs/api/README.md §2-§8. */
describe('contract fixtures (12.2)', () => {
  it('meta lists datasets, split-adjusted benchmark info and matches MetaResponse', () => {
    const m: MetaResponse = meta as MetaResponse;
    expect(m.api_version).toBe(2);
    expect(m.datasets).toContain('prices');
    expect(m.benchmarks?.default).toBe('TSX');
  });

  it('chart meta declares price/volume basis', () => {
    expect(chartMeta.price_basis).toBe('split_adjusted');
    expect(chartMeta.intervals).toContain('1d');
  });

  it('ohlcv json and columnar carry identical data (v1 bar keys)', () => {
    expect(ohlcv.length).toBeGreaterThan(3);
    expect(Object.keys(ohlcv[0])).toEqual(['timestamp', 'open', 'high', 'low', 'close', 'volume']);
    expect(ohlcvCol.timestamp).toEqual(ohlcv.map((b) => b.timestamp));
    expect(ohlcvCol.close).toEqual(ohlcv.map((b) => b.close));
  });

  it('columnar technicals: equal-length arrays, warm-up values are null (never 0)', () => {
    const d = technicals.data as Record<string, (number | null)[]>;
    const n = d['timestamp'].length;
    for (const [k, v] of Object.entries(d)) expect(v.length, k).toBe(n);
    expect(d['sma_50'][0]).toBeNull();
    expect(technicals.meta.model_version['technicals']).toBe('TECHNICAL_DAILY_V1');
  });

  it('ratings: 1-99 ints or letters, null for unbuilt ones with a reason', () => {
    expect(ratings.rs_rating).toBeGreaterThanOrEqual(1);
    expect(ratings.rs_rating).toBeLessThanOrEqual(99);
    expect(ratings.smr_rating).toMatch(/^[A-E]$/);
    expect(ratings.composite_rating).toBeNull();
    expect(ratings.unrated.composite).toBe('not_available');
  });

  it('screener fields: keyed, typed, with display_name and tier', () => {
    expect(fields.data.length).toBeGreaterThan(3);
    for (const f of fields.data) {
      expect(f.key).toBeTruthy();
      expect(f.display_name).toBeTruthy();
      expect(f.min_tier).toBeTruthy();
    }
  });

  it('screener run: envelope with meta.total and rows carrying security_id', () => {
    expect(run.meta.total).toBeGreaterThan(0);
    for (const r of run.data) expect(r.security_id).toBeGreaterThan(0);
  });

  it('entitlements and plans expose limits + features and api_access=false', () => {
    expect(ent.tier).toBe('pro');
    expect(ent.features.api_access).toBe(false);
    expect(plans.data.map((p) => p.tier)).toEqual(['free', 'plus', 'pro', 'ultimate']);
  });
});
