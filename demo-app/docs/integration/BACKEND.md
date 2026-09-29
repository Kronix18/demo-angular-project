# Integration paper — BACKEND (Flask API project)

Audience: whoever builds the HTTP API. Companion documents: `../api/` (the contract, authoritative for shapes), `DATA-FETCHER.md` (what will be in the database), `../DATA-PLAN.md` (why).
The front end is built against fixtures first, so the backend can deliver endpoint by endpoint (milestones M1…M11 in `README.md`).

## 1. Responsibilities
1. Serve the v2 contract (`docs/api/*`) over HTTPS/JSON; publish an **OpenAPI file generated from Pydantic schemas** (front end generates types from it — task 23.1).
2. **Read-only** access to market-data schemas; own the `application.*` schema (users, subscriptions, watchlists, alerts, layouts, drawings, settings, notes, saved screens, news read-state none).
3. Authentication (JWT access + rotating refresh), authorisation, **tier entitlements enforced server-side** and exposed via `/api/user/entitlements`.
4. Caching (ETag/Cache-Control), rate limiting, pagination, error format, CORS.
5. Composition only: **no financial calculations** (ratings, indicators, patterns come pre-computed from the fetcher's tables). Exceptions that are pure presentation and allowed: percent change, unit formatting, columnar encoding, split-adjusted price view if the fetcher has not materialised it, RS line ratio if not stored.

## 2. Suggested structure (per `TECHNICAL_ARCHITECTURE.md` §22)
```
backend/
  app.py, config.py
  api/        meta.py stocks.py prices.py technicals.py ratings.py fundamentals.py patterns.py
              screener.py industries.py market.py institutional.py news.py indices.py users.py billing.py backtests.py
  schemas/    pydantic models = the contract (one module per docs/api file)
  repositories/  SQL per domain (SQLAlchemy Core for big reads; no ORM object graphs on series)
  services/   entitlement.py, cache.py, screener_compiler.py, asof.py, columnar.py
  auth/       jwt.py, deps.py
  tests/      contract/ (fixtures from the front end), unit/, perf/
```
Libraries already planned: Flask, flask-cors, SQLAlchemy, psycopg, Pydantic, Gunicorn. Migrations for `application.*` only (Alembic is optional; the fetcher project uses `scripts/migrate_*`; agree who runs what).

## 3. Cross-cutting requirements (all endpoints)
| Topic | Requirement | Contract |
|---|---|---|
| Envelope | `{data, meta}` for lists/series; single object otherwise; v1 OHLCV bare array kept | `README.md` §3 |
| Errors | `{error, message, details}` with the listed codes (400/401/402/403/404/409/422/429/503) | §5 |
| Nulls | `null` for missing, never 0/""; empty dataset for a valid symbol = `200` + `data: []` | §2, §5 |
| Units | whole USD, `_pct` percent units, ratings ints/letters, ISO dates, epoch-ms for series | §2 |
| `as_of` | every derived endpoint; resolve `effective_date <= as_of` / `disclosed_at <= as_of`; echo `meta.as_of` and per-rating `effective_dates` | §4 |
| ETag / Cache | strong ETag = hash(dataset_status.calculated_at + params); `304`; `max-age` tiers; user endpoints `private, no-store` | §6 |
| Pagination | `limit` + opaque `cursor`, `sort=field:dir`, `fields=` | §7 |
| Columnar | `format=columnar` on every series endpoint | §8 |
| Tiers | truncate or `402 upgrade_required` with `details.feature`, and set `meta.limits` | `09` |
| Rate limit | per token (anon per IP), `X-RateLimit-*`, `429` + `Retry-After` | `09` §6 |
| Headers | `X-API-Version: 2`, `X-Request-Id` | §1 |
| Split-adjusted only | never serve raw or dividend-adjusted prices; declare `price_basis`, `volume_basis`, `source` | `02` |
| Display names | `GET /api/meta.display_names` (and `display_name` in the screener field catalogue); never hard-code trademark-sensitive names in payload keys | `DATA-PLAN` §7 L3 |

## 4. Endpoint checklist, priority and data source
`Reads` = tables/views the fetcher must provide (see `DATA-FETCHER.md` §2). Priority = milestone.

| M | Endpoint(s) | Contract | Reads |
|---|---|---|---|
| M1 | `GET /api/meta` | README §10 | `dataset_status`, `index_master` (benchmarks), display-name config |
| M1 | `GET /api/chart/{symbol}/meta` | `02` | `security_master`, `stock_history` (min/max date), `splits`, `dataset_status` |
| M1 | `GET /api/stocks/search`, `/stocks/{symbol}`, `/securities/{id}`, `/universe/facets` | `01` | `security_master` (+ trigram index), latest bar for quote |
| M2 | `GET /api/chart/{symbol}/ohlcv` (+`/latest`), `POST /api/chart/ohlcv/batch`, `GET /api/quotes` | `02` | `stock_history` (split-adjusted view), `weekly_prices`, `splits` |
| M2 | `GET /api/indices`, `/indices/{code}/ohlcv` | `02` | `index_master`, `index_prices` |
| M2 | `GET /api/securities/{id}/corporate-actions` | `01` | `splits`, `dividends`, `corporate_actions` (approved only) |
| M3 | `GET /api/stocks/{symbol}/technicals` (+`/latest`), `/rs-line` | `03` | `technical_daily`, `technical_weekly`, `relative_strength_history`, `index_prices` |
| M4 | `GET /api/screener/fields`, `POST /run`, `/count`, `/export`, `GET /presets`, `/api/user/screens` | `08` | `screener_snapshot`, field catalogue table (`screener_field`), `application.saved_screen` |
| M5 | `GET /api/stocks/{symbol}/ratings`, `/ratings/history`, `/ratings/dates`, `/ratings/distribution`, `/ratings/leaders`, `/ratings/explain` | `03` | `rs_rating_history`, `eps_rating_history`, `smr_rating_history`, others as built, `rating_explain` payloads |
| M6 | `/stocks/{symbol}/filings`, `/fundamentals/quarterly|annual|metrics`, `/chart/{s}/markers` | `04` | `sec_filing`, `fundamental_quarter_*` via resolver, ANNUAL_EPS tables |
| M7 | auth, `/user/*`, `/plans`, `/billing/*` | `09` | `application.*`, Stripe webhooks |
| M8 | `/industries*`, `/sectors`, `/market/*` | `06` | `industry_rating_history`, `security_industry_history`, `market_state_history`, `distribution_days`, … |
| M9 | `/stocks/{symbol}/patterns`, `/patterns/*`, `/trade-levels`, `/sell-signals`, `/canslim*` | `05` | `detected_bases`, `base_pivots`, `breakouts`, `sell_signals`, `canslim_*` |
| M10 | `/news*`, `/events*`, `/stocks/{symbol}/institutional*` | `07` | `news_articles`, `news_article_symbol`, `event_classifications`, `company_events`, `institutional_metrics`, `form13f_*` |
| M11 | `as_of` on all; `POST /api/backtests`, `GET /backtests/{id}` | README §4 | PIT snapshots, `backtest.*` |

## 5. Implementation notes per hot path
- **Screener:** compile the filter tree to SQL over `screener_snapshot` with a whitelist of fields from the `screener_field` catalogue (never interpolate field names from input; validate operator per field type; depth ≤ 3, ≤ 30 leaves). Sort/paginate with keyset cursor `(sort_value, security_id)`. `count` shares the compiler. `as_of` picks the partition. Enforce `max_results` by tier and field `min_tier`.
- **OHLCV:** SELECT by `(security_id, date)` range; cast VARCHAR prices to numeric in SQL (`::numeric`) or in the split-adjusted view; apply `adjust_for_splits` result from the fetcher's view rather than recomputing per request; encode columnar without building per-bar dicts. Target: 10 000 daily bars < 150 ms server time, < 400 kB gzip columnar.
- **Symbol resolution:** `symbol` → `security_id` via `security_symbol_history` when populated (as of the requested date); otherwise the current symbol; delisted names resolvable. 404 body carries `suggestions`.
- **Ratings:** each rating has its own date; return `effective_dates`, `unrated` reason and `model_version` map; never fabricate a composite from parts.
- **Fundamentals:** call the point-in-time resolver logic (`pipelines/sec/quarter_resolver.py`, `quarter_growth.py`) or read its views; growth computed per request from two resolutions; preserve `semantic` enums.
- **`GET /api/meta`:** built from `dataset_status`; cache 60 s; anonymous.
- **News:** list from `news_articles` join `news_article_symbol` with keyset cursor on `(published_at, news_id)`; never return article bodies.
- **User data:** optimistic concurrency via `updated_at` (409); opaque JSON documents ≤ 256 KB with `schema_version`.

## 6. Security
JWT (short access, rotating refresh, revocation list), argon2/bcrypt passwords, CORS allow-list of the app origin, parameterised SQL only, request size limits, strict Pydantic validation on bodies, rate limits, audit log for billing changes, Stripe webhook signature verification, no secrets in responses, PII minimisation. All vendor API keys live with the fetcher; the API has none.

## 7. Testing and acceptance (definition of done per endpoint)
1. Pydantic schema = contract; example in the OpenAPI equals the contract example.
2. **Contract test** passes with the front end's fixtures/runner (task 23.2): status, envelope, units, null rules, columnar lengths.
3. Unit tests for `as_of`, tier truncation, errors, cursor paging.
4. Perf test with the real DB size (screener < 300 ms p95 for 50 rows; OHLCV per §5).
5. Entitlement test matrix (anon/free/plus/pro/ultimate).
6. Documented in OpenAPI, with `min_tier` and dataset dependency in `x-` extensions.
7. `docs/api/CHANGELOG.md` entry if anything differs from the contract (differences must be agreed, not silent).

## 8. What the backend can and cannot decide alone
Can: internal structure, caching store, pagination cursors format, extra optional fields (additive). Cannot: renaming/removing fields, changing units, changing tier semantics, serving non-split-adjusted or total-return prices, exposing article bodies (ask the front end / owner).

## 9. Open questions for the backend project
1. Same PostgreSQL instance as the fetcher (recommended, read-only role) or replicated? Latency/consistency expectations.
2. Materialised views vs. tables for `screener_snapshot` and split-adjusted prices — who refreshes and when (see fetcher `DATA-FETCHER.md` §5).
3. Auth: build in Flask (JWT) or delegate (e.g. Auth0)? Contract assumes email+password endpoints in `09`.
4. Stripe account / webhook hosting.
5. Redis (rate-limit + cache) available? Otherwise in-process caches and DB-backed limits.
6. Where does the OpenAPI file live so the front end CI can fetch it (task 23.1)?
