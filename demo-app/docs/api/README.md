# Frontend ⇄ Backend API contract (v2)

**Audience:** the backend / data-fetcher projects. **Scope:** everything this Angular app needs from them, in the
shape the app will consume it. This is a *contract*, not an implementation: the backend is a separate project and is
**not** programmed here. Where the front end's current code disagrees with this document, this document wins.

| File | Domain |
|---|---|
| [`00-data-status.md`](00-data-status.md) | What exists in the database today, what is planned, what the front end will do until it exists |
| this file | Conventions that apply to every endpoint |
| [`01-security-master.md`](01-security-master.md) | Securities, search, identity history, corporate actions, universe facets |
| [`02-prices.md`](02-prices.md) | OHLCV (raw / split-adjusted), intervals, quotes, indices, batch, metadata |
| [`03-technicals-ratings.md`](03-technicals-ratings.md) | Technical series, RS line, the IBD-style ratings and their history |
| [`04-fundamentals.md`](04-fundamentals.md) | SEC filings, quarterly / annual financials, earnings, growth metrics |
| [`05-canslim-patterns.md`](05-canslim-patterns.md) | CAN SLIM scores with reasons, bases, pivots, breakouts, trade levels, sell signals |
| [`06-industries-market.md`](06-industries-market.md) | Industry groups, market state, distribution / follow-through days, exposure |
| [`07-institutional-events.md`](07-institutional-events.md) | 13F sponsorship, news / catalyst events |
| [`08-screener.md`](08-screener.md) | Field catalogue, query model, run / export, presets, saved screens |
| [`09-user-tiers.md`](09-user-tiers.md) | Auth, profile, entitlements, plans, watchlists, alerts, layouts, drawings |
| [`10-capabilities-and-fallbacks.md`](10-capabilities-and-fallbacks.md) | How the front end decides between "backend has it" and "calculate it here" |

Older, still-valid chart endpoints are in [`../../API-BACKEND-SPEC.md`](../../API-BACKEND-SPEC.md) (v1); v2 extends them
and never breaks them.

---

## 1. Transport

**No API exists yet — this whole folder is the specification of what the backend (Flask + SQLAlchemy + Pydantic, per `TECHNICAL_ARCHITECTURE.md` §1) SHOULD serve.** The v1 spec and the front end's current calls are equally unimplemented and are superseded where they differ. Route mapping to the backend's own sketch (`TECHNICAL_ARCHITECTURE.md` §36): `GET /stock/{symbol}/…` = `GET /api/stocks/{symbol}/…`, `POST /screener` = `POST /api/screener/run`, `POST /backtests` = `POST /api/backtests`. Response models should be Pydantic schemas generated into an OpenAPI file that replaces this folder as the source of truth once it exists.

- HTTPS, JSON (`application/json; charset=utf-8`), gzip or brotli. CORS allows the Angular origin(s); the base URL is
  configured per deployment (`<meta name="api-url">`, see `src/app/core/api-url.ts`).
- Paths keep the existing `/api/...` prefix (`/api/screener/*`, `/api/stocks/{symbol}`, `/api/user/*`, `/api/chart/*`).
  New endpoints are **additive**; a breaking change gets a new path (`/api/v3/…`), never a silent change.
- Every response carries `X-API-Version: 2` and `X-Request-Id`.

**Division of labour (backend design rule §37):** the front end never calculates *authoritative* ratings; it may calculate display-only values (chart indicators) and falls back to them only when the backend has no series.

## 2. Naming, units, formats

| Thing | Rule |
|---|---|
| JSON keys | `snake_case` for every new endpoint (matches the DB columns and the existing screener / user endpoints). The v1 OHLCV bar keeps its single-word keys (`timestamp`, `open`, …). |
| Symbols in paths | UPPERCASE ticker without exchange suffix (`MSFT`, not `MSFT.US`). Resolved **as of the requested date** (ticker reuse / renames: see `01-security-master.md`). |
| Security identity | Every payload that concerns a security includes `security_id` (`security_master.id`, integer). Joins are by id, never by symbol. |
| Time series points | `timestamp` = Unix epoch **milliseconds, UTC** (v1 contract). For daily data that is `Date.UTC(y, m-1, d)`. |
| Calendar dates | ISO `YYYY-MM-DD` strings (`period_end`, `filing_date`, `as_of`, `ipo_date`). |
| Date-times | ISO-8601 UTC with `Z` (`calculated_at`, `accepted_at`). |
| Money | USD as a plain number in **whole dollars** (`market_cap: 3120000000000`), prices in dollars. Never millions / billions. |
| Shares / volume | Plain numbers of shares. |
| Growth, returns, margins, ROE | **Percent units**, key ends in `_pct` (`eps_yoy_pct: 48.2` means +48.2 %). Ratios have no suffix (`ud_volume_ratio: 1.34`). |
| Ratings / scores | `*_rating` integer 1–99 (RS, EPS, Composite, Group RS, Earnings Stability); letter ratings as strings (`smr_rating: "A"`, `accdist_rating: "B+"`, `sponsorship_rating: "A"`); `*_score` 0–100 (CAN SLIM sub-scores, base / breakout quality). |
| Missing values | `null`, never `0`, `""` or `"N/A"`. A missing series is an empty array (v1 rule). |
| Enums | lower_snake strings, stable and documented (e.g. `market_state: "confirmed_uptrend"`). |
| Booleans | JSON booleans. |

## 3. Envelope

- **Single resource:** the object itself.
- **Lists / series:** `{ "data": [ … ], "meta": { … } }`. (Exception kept for compatibility: the v1 OHLCV endpoints return a
  bare array.)
- `meta` is always present on v2 endpoints:

```json
{
  "as_of": "2026-09-22",            // date of the newest data in the response (EOD date)
  "calculated_at": "2026-09-23T02:14:05Z",   // when derived values were computed (omit for raw data)
  "model_version": { "eps": "EPS_V1", "rs": "RS_LEGACY_V1", "composite": "COMPOSITE_V1" },  // omit if none apply
  "source": "stooq",                // provenance of raw data where it matters
  "limits": { "history_years": 3, "truncated": true },   // set when the caller's tier cut the response
  "total": 3508, "limit": 50, "next_cursor": "eyJvIjo1MH0"  // lists that paginate
}
```

## 4. Point-in-time (`as_of`)

Endpoints that return **derived** data (`ratings`, `canslim`, `patterns`, `screener`, `market`, `industries`,
`institutional`, `fundamentals`) accept `as_of=YYYY-MM-DD` and answer *"what did the system know on that date"*:
fundamentals only after their filing date, 13F only after filing, ratings from the row whose `effective_date <= as_of`.
Without it, `as_of` = the latest EOD date. Responses echo `meta.as_of`. This powers the front end's later "time machine"
(historical screener / replay) and must not require a different code path on the server.

## 5. Errors

Existing contract, extended:

```json
{ "error": "symbol_not_found", "message": "No security MSFTX", "details": { } }
```

| HTTP | `error` | When | `details` |
|---|---|---|---|
| 400 | `bad_request`, `bad_interval`, `bad_filter`, `bad_field` | malformed / unknown params, invalid filter tree | `{ "field": "eps_rating", "allowed": [...] }` |
| 401 | `unauthenticated`, `token_expired` | missing / expired token | – |
| 402 | `upgrade_required` | the feature or depth needs a higher tier | `{ "required_tier": "pro", "feature": "patterns" }` |
| 403 | `forbidden` | role, not tier | – |
| 404 | `symbol_not_found`, `not_found` | unknown symbol / id | `{ "suggestions": ["MSFT"] }` |
| 409 | `conflict` | e.g. saved screen name taken | – |
| 422 | `validation_failed` | body fails validation | per-field messages |
| 429 | `rate_limited` | quota | header `Retry-After` (s) |
| 503 | `data_not_ready` | dataset not computed for the date yet | `{ "dataset": "ratings", "expected_by": "…" }` |

**Empty is not an error**: a valid symbol with no rows in a dataset returns `200` with `data: []` (or `null` fields);
the front end uses that plus `/api/capabilities` (§10 file) to decide what to show.

## 6. Caching

All market data is end-of-day and changes once per trading day after the nightly run, so:

- `ETag` (+ `If-None-Match` → `304`) on every GET; `Last-Modified` = end of the batch that produced it.
- `Cache-Control: public, max-age=300, stale-while-revalidate=3600` for the latest-day endpoints,
  `max-age=86400, immutable` for closed history (`to` < latest EOD − 7 days) and for `as_of` in the past.
- User-specific endpoints: `Cache-Control: private, no-store`.
- `GET /api/meta` (see below) tells the client when the next refresh is expected, so it can drop cached data at that moment.

## 7. Pagination, sorting, field selection

- `limit` (default 50, max per endpoint) + opaque `cursor` (preferred) or `offset`. Lists return `meta.total` when cheap.
- `sort=field:desc,other:asc` where the field is in the endpoint's documented sortable set.
- `fields=a,b,c` limits the returned columns (screener, technicals, ratings). Unknown fields → `400 bad_field`.

## 8. Large series: columnar format (optional but strongly wanted)

MSFT daily is ~10 000 bars × 6 fields. Series endpoints accept `format=columnar` and then return
`{ "timestamp":[…], "open":[…], … }` (same names, equal-length arrays) instead of an array of objects (~3× smaller,
and the chart windowing code can consume it without an object per bar). Default stays the array-of-objects form.

## 9. Auth and tiers

`Authorization: Bearer <jwt>` (see `09-user-tiers.md`). The token carries `sub`, `role`, `tier`. Tier limits are enforced
**server-side** (truncate / 402), and *also* exposed through `GET /api/user/entitlements` so the front end can hide or
explain instead of failing. Anonymous access is allowed only for what the marketing pages need
(`/api/plans`, `/api/meta`, and — decision for the product owner — a sample of chart data for the demo symbols).

## 10. Health and versions

```
GET /api/meta
{
  "api_version": 2,
  "data_as_of": { "prices": "2026-09-22", "technicals": "2026-09-22", "rs": "2026-09-22", "eps": "2026-09-15", "smr": "2026-09-15",
                  "fundamentals": "2026-09-19", "institutional": "2026-06-30", "market": "2026-09-22" },
  "next_refresh_after": "2026-09-23T02:00:00Z",   // may be null: the daily import is manual today
  "model_versions": { "technicals": "TECHNICAL_DAILY_V1", "rs": ["RS_3M_V1","RS_6M_V1","RS_12M_V1","RS_ER3_V1"], "eps": "EPS_V5_3", "smr": "SMR_V4" },
  "datasets": ["security_master","prices","splits","technicals","rs_ratings","eps_rating","smr_rating","filings"]   // later: weekly, index_prices, fundamentals, composite, patterns, market, institutional, events
}
```

`datasets` lists what is switched on in this deployment; the front end treats anything missing as "not available yet"
and falls back (see `10-capabilities-and-fallbacks.md`). This is what lets the backend ship dataset by dataset with no
front-end release.
