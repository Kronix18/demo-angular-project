# 09 — Users, tiers, entitlements, user data

Backing: `application.*` (**PLAN**, separate from market-data schemas). Front-end today: `AuthService` with hard-coded demo credentials
(task 9.1), tiers in `subscription.types.ts` (`free|plus|pro|ultimate|admin`), `localStorage` for watchlist/layouts/drawings/alerts.

## 1. Auth (task 9.1 contract; JWT Bearer)
| Endpoint | Body → Response |
|---|---|
| `POST /api/auth/register` | `{email, password, name}` → `201 {user}` (email verification optional) |
| `POST /api/auth/login` | `{email, password}` → `{access_token, refresh_token, expires_in, user}` |
| `POST /api/auth/refresh` | `{refresh_token}` → new pair (rotation) |
| `POST /api/auth/logout` | revokes refresh token |
| `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` | standard |
| `GET /api/user/profile`, `PUT /api/user/profile` | existing endpoint; `{id, email, name, role, tier, created_at, settings}` |
JWT claims: `sub`, `role` (`user|admin`), `tier`, `exp`. Access token 15 min, refresh 30 days.

## 2. Entitlements — `GET /api/user/entitlements`
The single source of truth for what the UI shows or greys out; **the backend enforces the same numbers**.
```json
{ "tier": "pro", "status": "active", "renews_at": "2026-10-20",
  "limits": { "history_years_daily": 10, "screener_max_results": 500, "watchlists": 10, "stocks_per_watchlist": 100,
              "alerts": 50, "saved_screens": 20, "saved_layouts": 20, "batch_symbols": 25, "api_calls_per_day": 1000, "export_rows": 500 },
  "features": { "technicals_server": true, "ratings": true, "rs_line": true, "canslim": true, "patterns": true, "trade_levels": true,
                "sell_signals": true, "fundamentals": true, "institutional_summary": true, "institutional_holders": false,
                "events": true, "market_state": true, "industries": true, "screener_as_of": false, "backtest": false,
                "export": true, "api_access": false },
  "usage": { "api_calls_today": 12 } }
```
Feature keys are also what `402 upgrade_required.details.feature` uses.

## 3. Plans — `GET /api/plans` (public)
`[ { tier, name, description, price_monthly, price_yearly, currency, popular, features: {…as above…}, limits: {…} } ]` — replaces the
hard-coded `SUBSCRIPTION_PLANS`, so pricing can change without a release. Pricing proposal: see `../DATA-PLAN.md` §7.

## 4. Billing (**needs product decision**)
`POST /api/billing/checkout {tier, period}` → `{checkout_url}` (hosted provider e.g. Stripe), `POST /api/billing/portal` → `{portal_url}`,
webhook (server-side) updates `tier`/`status`. Front end never handles card data. `GET /api/user/subscription` → current subscription (existing model).

## 5. User data (replaces `localStorage`, all `private, no-store`)
Every collection: `GET` list, `POST` create, `PUT /{id}` replace, `DELETE /{id}`; body includes `updated_at` (optimistic concurrency, `409` on stale).
| Path | Item |
|---|---|
| `/api/user/watchlists` | `{id, name, position, items:[{security_id, symbol, added_at, note}]}`; `POST /{id}/items`, `DELETE /{id}/items/{security_id}` |
| `/api/user/alerts` | `{id, security_id, symbol, type: price_cross|price_pct|indicator|rating|breakout, condition:{op,value,…}, active, last_triggered_at, notify:[email,push]}` (evaluation server-side once EOD data lands; **PLAN**) |
| `/api/user/layouts` | `{id, name, state: {…front-end JSON…}}` — chart layout (panes, indicators, chart type, scale) |
| `/api/user/templates` | indicator templates, same shape |
| `/api/user/drawings?security_id=` | `{security_id, items: [ …drawing objects… ], updated_at}` (one document per user+security) |
| `/api/user/settings` | theme, default interval, default chart type, column presets |
| `/api/user/notes?security_id=` | per-stock note |
| `/api/user/positions` | (Ultimate, later) `{security_id, entry_price, shares, entry_date}` → feeds `trade-levels?entry=` |
`state`/drawings are opaque versioned JSON (`schema_version`); the backend stores, does not interpret. Max 256 KB per document.

## 6. Rate limiting
Per token, headers `X-RateLimit-Limit/Remaining/Reset`; `429` with `Retry-After`. Anonymous: 60/min/IP.

## 7. Decisions (2026-09-29, see `../DATA-PLAN.md` §7)
- `api_access` is `false` for all tiers until a licensed price feed exists; `/api/plans` lists it as `coming_soon: true`.
- Anonymous: `/api/plans`, `/api/meta`, `/api/universe/facets` and charts (1 y daily, no ratings) for the 10 demo symbols `MSFT, AAPL, NVDA, AMZN, GOOGL, META, TSLA, AMD, SPY, QQQ` (`GET /api/plans` also returns `demo_symbols`). Everything else → `401`.
- `GET /api/meta` (or plans) returns `display_names: { "smr_rating": "Quality (Sales·Margins·ROE)", "canslim_score": "O'Neil-style growth score", … }` used for every rating label; the front end never hard-codes rating names.
- Payment: Stripe Checkout + portal; auth: JWT + rotating refresh.
