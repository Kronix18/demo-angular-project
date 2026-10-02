import { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
  /** Access tokens the mock treats as expired: non-auth requests carrying them get 401 token_expired. */
  expiredTokens?: string[];
  /** path → fail the first `times` GETs with `status` (then behave normally). */
  flaky?: Record<string, { status: number; times: number; headers?: Record<string, string> }>;
  /** Send ETag on GET 200s and honour If-None-Match with 304. */
  etag?: boolean;
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
    [/^\/api\/user\/profile$/, load('user-profile.json')],
  ];
  const flakyCount: Record<string, number> = {};
  await page.route(/\/api\//, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    opts.onRequest?.(path + url.search);
    const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
      route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', ...headers }, body: JSON.stringify(body ?? {}) });
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (path === '/api/auth/refresh') return json(200, { access_token: 'new-token', refresh_token: 'new-refresh', expires_in: 900 });
    const bearer = route.request().headers()['authorization']?.replace('Bearer ', '');
    if (bearer && opts.expiredTokens?.includes(bearer)) return json(401, { error: 'token_expired', message: 'Token expired' });
    const fl = opts.flaky?.[path];
    if (fl && (flakyCount[path] = (flakyCount[path] ?? 0) + 1) <= fl.times) return json(fl.status, { error: 'server_error', message: 'Temporarily unavailable' }, fl.headers);
    const err = opts.errors?.[path];
    if (err) return json(err.status, err.body, err.headers);
    if (opts.overrides && path in opts.overrides) {
      const ov = opts.overrides[path];
      if (opts.etag && route.request().method() === 'GET') {
        const tag = `"${createHash('md5').update(JSON.stringify(ov)).digest('hex')}"`;
        if (route.request().headers()['if-none-match'] === tag) return route.fulfill({ status: 304, headers: { ETag: tag, 'access-control-allow-origin': '*' } });
        return json(200, ov, { ETag: tag, 'access-control-expose-headers': 'ETag' });
      }
      return json(200, ov);
    }
    const hit = routes.find(([re]) => re.test(path));
    const body = hit ? hit[1] : undefined;
    if (hit && opts.etag && route.request().method() === 'GET') {
      const tag = `"${createHash('md5').update(JSON.stringify(body)).digest('hex')}"`;
      if (route.request().headers()['if-none-match'] === tag) return route.fulfill({ status: 304, headers: { ETag: tag, 'access-control-allow-origin': '*' } });
      return json(200, body, { ETag: tag, 'access-control-expose-headers': 'ETag' });
    }
    if (hit) return json(200, hit[1]);
    return json(404, { error: 'not_found', message: `No mock for ${path}` });
  });
}
