# 10 — Capabilities and fallbacks

Goal: the front end runs against **any** backend maturity (nothing, prices only, everything) without a release, and prefers
backend values over its own calculations whenever they exist.

## 1. Discovery
1. On bootstrap: `GET /api/meta` (cache in memory, refresh after `next_refresh_after`). Gives `datasets`, `data_as_of`, `model_versions`.
2. Per symbol (chart, stock page): `GET /api/chart/{symbol}/meta` → `datasets` booleans for that symbol (e.g. a fresh IPO has
   no `technicals`/`rs_line`; ETFs have no `fundamentals`, `canslim`).
3. Per user: `GET /api/user/entitlements`.
A feature is on **iff** dataset available ∧ symbol supports it ∧ entitlement true. Otherwise: hidden (no data), or shown locked with an
upgrade CTA (entitlement false), or "not available yet" (dataset off).

## 2. Data-source rules (chart)
| Data | Preferred | Fallback | Parity |
|---|---|---|---|
| OHLCV | `/api/chart/{symbol}/ohlcv` | static `*.us.txt` | identical `Bar[]` |
| SMA/EMA/ATR/volume-avg with stored period | `/technicals` | client calc | ≤ 1e-6 rel. vs Python golden fixtures |
| Any other period / RSI / MACD / BB / … | client calc | – | – |
| RS line | `/rs-line` | none (needs index + universe) | – |
| Patterns, pivots, stops, sell markers | `/patterns`, `/trade-levels`, `/sell-signals` | none | – |
| Earnings / filing / split / news markers | `/markers` | none | – |
| Ratings badges | `/ratings` | none | – |
Rule: **if the backend answers, never calculate the same series locally**; if it answers `503 data_not_ready`, retry once after 30 s then fall back.

## 3. HTTP interceptor chain (front end; informational for the backend)
1. `apiUrlInterceptor` — base URL (`API_URL`).
2. `authInterceptor` — Bearer; `401 token_expired` → refresh once → retry.
3. `entitlementInterceptor` — `402` → emits an `upgrade_required` event (paywall dialog), does not toast.
4. `etagCacheInterceptor` — `If-None-Match`; `304` → cached body; drops entries when `/api/meta` says new data.
5. `retryInterceptor` — GET only: `429` (respects `Retry-After`), `503`, network; max 2, jittered.
6. `dataSourceInterceptor` — for chart OHLCV / technicals: backend-first, static fallback (`§2`).
7. `errorInterceptor` — maps `{error,message,details}` to a typed `ApiError`; one toast policy.

## 4. What the backend must guarantee for this to work
- `GET /api/meta` and `/api/chart/{symbol}/meta` are cheap (cached, < 20 ms) and truthful.
- Missing dataset for a valid symbol → `200` with empty data, not `404`; unknown symbol → `404 symbol_not_found`.
- Timestamps/bars identical between endpoints (technicals arrays align to OHLCV timestamps).
- `model_version` changes whenever a formula changes; the front end shows it in a "data info" popover and keys its cache with it.
