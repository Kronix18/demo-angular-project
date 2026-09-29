import { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Contract mock backend (task 12.2): fulfils `/api/**` from docs/api/fixtures so every front-end task can be
 * verified in a real browser without a backend. Toggle datasets, tier, and inject errors per path.
 */
const FIX = join(__dirname, '..', 'docs', 'api', 'fixtures');
const load = (name: string) => JSON.parse(readFileSync(join(FIX, name), 'utf8'));

export interface MockError {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}
export interface MockOptions {
  /** Datasets advertised by /api/meta (default: fixture list). */
  datasets?: string[];
  /** Entitlement tier (default pro). Only `free` and `pro` fixtures differ today; others reuse pro with the tier label. */
  tier?: 'free' | 'plus' | 'pro' | 'ultimate';
  /** path (without query) → forced error response. */
  errors?: Record<string, MockError>;
  /** path (without query) → custom JSON body (status 200). */
  overrides?: Record<string, unknown>;
  /** Called for each mocked request (path incl. query). */
  onRequest?: (path: string) => void;
}

export async function mockApi(page: Page, opts: MockOptions = {}): Promise<void> {
  const meta = load('meta.json');
  if (opts.datasets) meta.datasets = opts.datasets;
  const ent = load('entitlements-pro.json');
  if (opts.tier && opts.tier !== 'pro') {
    ent.tier = opts.tier;
    if (opts.tier === 'free') {
      ent.limits.history_years_daily = 1;
      ent.limits.screener_max_results = 50;
      for (const k of Object.keys(ent.features)) ent.features[k] = false;
    }
  }
  const routes: [RegExp, unknown][] = [
    [/^\/api\/meta$/, meta],
    [/^\/api\/chart\/[^/]+\/meta$/, load('chart-meta-msft.json')],
    [/^\/api\/chart\/[^/]+\/ohlcv$/, load('ohlcv-msft.json')],
    [/^\/api\/stocks\/[^/]+\/technicals$/, load('technicals-msft.json')],
    [/^\/api\/stocks\/[^/]+\/ratings$/, load('ratings-msft.json')],
    [/^\/api\/screener\/fields$/, load('screener-fields.json')],
    [/^\/api\/screener\/run$/, load('screener-run.json')],
    [/^\/api\/user\/entitlements$/, ent],
    [/^\/api\/plans$/, load('plans.json')],
  ];
  await page.route(/\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    opts.onRequest?.(path + url.search);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body ?? {}) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const err = opts.errors?.[path];
    if (err) return json(err.status, err.body, err.headers);
    if (opts.overrides && path in opts.overrides) return json(200, opts.overrides[path]);
    const hit = routes.find(([re]) => re.test(path));
    if (hit) return json(200, hit[1]);
    return json(404, { error: 'not_found', message: `No mock for ${path}` });
  });
}
