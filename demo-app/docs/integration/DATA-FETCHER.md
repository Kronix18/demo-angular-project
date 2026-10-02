# Integration paper — DATA FETCHER / PIPELINES (Python + PostgreSQL project)

Audience: whoever runs ingestion, calculations and the database content. Companion: `BACKEND.md` (what the API reads), `../api/` (shapes), `../DATA-PLAN.md`.
Everything below is a **requirement list derived from what the front end and API need**; it is written against what the fetcher documents say exists today (SECURITY_MASTER, PRICE_DATA, DAILY_INGESTION_GUIDE, FUNDAMENTALS, SEC_INGESTION, EPS_STATUS, SMR_STATUS, TECHNICAL_ARCHITECTURE).

## 1. Responsibilities
1. Ingest and validate raw data (prices, indices, splits/dividends, SEC filings/facts, 13F, news) from Stooq, SEC, Yahoo Finance, Business Quant, Alpha Vantage, GDELT.
2. Produce **split-adjusted** price series for everything served (owner decision); never expose or mix dividend-adjusted (total-return) prices in served tables.
3. Calculate technicals, RS/EPS/SMR and all other ratings, industry ranks, market state, patterns, CAN SLIM, and materialise them with point-in-time keys and `model_version`.
4. Build the **`screener_snapshot`** and the other API-facing materialisations after each run.
5. Record run/dataset status (`dataset_status`) — the handshake with the backend.
6. Own schema for market-data domains (`scripts/migrate_*` / `create_all`); give the backend a **read-only role** and a DDL/data dictionary.

## 2. Tables/views the API reads (fetcher must provide; ✅ = exists per docs, 🟡 = partly, ⬜ = to build)
Common columns everywhere derived: `security_id`, a date column named as shown, `model_version`, `calculated_at`. Types are proposals; keep existing ones where they exist.

| Domain | Table / view | Status | Requirements for the API |
|---|---|---|---|
| Security | `security_master` | ✅ | expose `cik`, `country`, `exchange`, `security_type`, `is_active`, `is_etf/adr/spac`, `is_rating_eligible`, `passes_eligibility_gate` (add if missing), `is_fundamental_rating_eligible`; index `lower(symbol)`, trigram on `company_name` |
| Security | `security_symbol_history`, `security_name_history` | 🟡 empty | populate from `security_identifiers` + corporate actions; contract `01` |
| Security | `security_industry_history` | ⬜ | membership over time for `as_of` group RS |
| Prices | `stock_history` (`security_id,date,open,high,low,close,volume`) | ✅ | serve **split-adjusted**: either adjust at ingestion (vendor-adjusted) or provide view `stock_history_adj`; add `volume_basis` in `dataset_status.meta`; keep `(security_id,date)` PK/index; prices numeric (not VARCHAR) in the served view; cover delisted names |
| Prices | `weekly_prices` | ⬜ | derived from adjusted daily (Mon-start weeks, last-trading-day close, summed volume); rebuilt incrementally |
| Prices | `market_calendar` | ⬜ | trading sessions/holidays/half-days, US (+ CA for TSX) |
| Indices | `index_master(code, stooq_ticker, name, region, country, currency, has_volume, first_bar, last_bar, is_benchmark)` | ⬜ | seeded from the 60 Stooq indices in `../api/02-prices.md`; `TSX` flagged benchmark (interim), `NDQ` market index |
| Indices | `index_prices(index_code, trade_date, open, high, low, close, volume)` | 🟡 expected | ingest all 60 index series with the stock pipeline's validation; **volume for `NDQ`/`TSX` must be present**, else add later |
| Corp. actions | `splits`, `dividends`, `corporate_actions`, `split_review_queue` | ✅ | API exposes only **approved** splits; coverage report vs `stock_history` jumps |
| Technicals | `technical_daily` (23 columns, `TECHNICAL_DAILY_V1`) | ✅ | computed on split-adjusted prices; add optional: `sma_100`, `atr_20/30`, `avg_volume_10` only if cheap (else client-side) |
| Technicals | `technical_weekly` | ⬜ | 10w/40w MAs etc. (low priority) |
| RS | `rs_rating_history` (3M/6M/12M/ER3) | ✅ | daily; column names/`window` documented |
| RS | `relative_strength_history(security_id, trade_date, rs_line, rs_line_high_52w, rs_new_high, benchmark_code, model_version)` | ⬜ | benchmark from `index_master.is_benchmark` (**TSX now**), scale first=100 or documented |
| Ratings | `eps_rating_history`, `smr_rating_history` | ✅ 19 dates | recompute daily or on earnings ingestion (owner); write one row per date computed; keep old dates |
| Ratings | `accdist_/sponsorship_/industry_/composite_rating_history`, `earnings_stability_history` | ⬜ | plan §13–§18; add `raw_score` |
| Ratings | `rating_explain(security_id, effective_date, rating, model_version, payload jsonb)` | ⬜ | inputs/weights/percentile for "Why this rating?" (`../api/03` §3) |
| Ratings | `unrated_reason` column or table | ⬜ | `no_quarterly_data`, `stale_quarter`, `not_eligible`, `too_new`, `no_cik`, `not_available` |
| Fundamentals | `sec_filing` | ✅ | add `items` (8-K item numbers) and optionally `period_end`/`fiscal_period` |
| Fundamentals | `fundamental_period/metric`, `fundamental_quarter_period/metric`, ANNUAL_EPS tables | ✅ | views for `04` (quarterly, annual, metrics); include `source_rank`, `disclosed_at`, `availability_source`; adjusted-EPS series with `source` (`yf_adj`, `av_adj`) |
| Fundamentals | `external_quarter_financials` | ✅ | keep `source`; mark rows used for ratings |
| Industry | `industry_rating_history`, `industry_master` | ⬜ | key `industry_key`, group RS/rank/returns/breadth per date |
| Institutional | `institutional_managers`, `form13f_filings`, `form13f_holdings`, `institutional_metrics`, `fund_quality` | ⬜ | PIT by `filing_date`; SEC 13F |
| CAN SLIM | `canslim_component_scores`, `canslim_score_history` | ⬜ | `reasons jsonb` per component (`../api/05` §1) |
| Patterns | `detected_bases`, `base_features`, `base_pivots`, `breakouts`, `sell_signals` | ⬜ | store **geometry points** `{t,p,role}` and levels (`../api/05` §2) |
| Market | `market_state_history`, `follow_through_days`, `distribution_days`, `stalling_days`, `power_trend_history`, `market_exposure_history`, `rally_attempts`, `market_breadth_daily` | ⬜ | indices = `NDQ` + benchmark (`TSX` interim); notes when volume missing |
| News | `news_articles`, `news_article_symbol`, `event_classifications`, `company_events` | ⬜ | see §6 |
| Screener | `screener_snapshot`, `screener_field` | ⬜ | see §5 |
| Handshake | `dataset_status` | ⬜ | see §3 |

## 3. `dataset_status` — the handshake (build first, M1)
```sql
CREATE TABLE dataset_status (
  dataset        text PRIMARY KEY,        -- security_master, prices, splits, indices, technicals, rs_ratings, eps_rating, smr_rating,
                                          -- fundamentals, filings, composite, accdist, sponsorship, group_rs, canslim, patterns, market,
                                          -- institutional, news, events, screener
  enabled        boolean NOT NULL,        -- switched on for the API (front end shows the dataset only if true)
  data_as_of     date,                    -- newest business date contained
  calculated_at  timestamptz,             -- end of the last successful run
  model_version  text,                    -- e.g. TECHNICAL_DAILY_V1, EPS_V5_3, SMR_V4, RS_12M_V1
  status         text NOT NULL,           -- ok | running | failed | stale
  meta           jsonb NOT NULL DEFAULT '{}'  -- price_basis, volume_basis, source, benchmark, coverage counts, notes
);
```
The backend builds `GET /api/meta` from it. Rules: set `enabled = true` only when the dataset is complete for `data_as_of`; update **after** commit of the data (so the API never advertises rows that are not there); `stale` when `data_as_of` is older than the expected session.

## 4. Nightly (and event-driven) run — order and cadence
Existing order (`TECHNICAL_ARCHITECTURE.md` §32 + `DAILY_INGESTION_GUIDE.md`), with the additions this project's consumers need (**bold**):
1. update security master · 2. ingest prices (Stooq bulk; vendors as they are switched to Yahoo / Business Quant / Alpha Vantage; **split-adjust**) · 3. **ingest index prices (60 indices)** · 4. corporate actions (split detection → review queue → approve) · 5. SEC submissions · 6. new XBRL facts · 7. 13F (quarterly window) · 8. news/events (every 15–60 min, separate job) · 9. rebuild affected normalised fundamentals/quarters · 10. technicals (`build_technical_daily`) · **10b. weekly prices/technicals** · 11. RS ratings (`update_ratings`) · **11b. RS line vs benchmark** · 12. **EPS/SMR/other ratings — daily, and immediately after each earnings ingestion for affected issuers (owner decision)** · 13. industry ranks · 14. CAN SLIM · 15. market state (needs NDQ + benchmark volumes) · 16. patterns/breakouts/sell signals · 17. **build `screener_snapshot` for `data_as_of`** · 18. ML features (fetcher-internal) · 19. **update `dataset_status`** (last step) · 20. refresh materialised views/caches.
Every stage idempotent and restartable; a failed stage sets its dataset `status='failed'` and leaves previous `data_as_of` untouched.
**Freshness target:** all API-facing datasets for session D available by 08:00 UTC of D+1 (proposal); until the Stooq download is automated the run is manual and `dataset_status.data_as_of` simply lags — the front end shows the date.

## 5. `screener_snapshot` and `screener_field`
`screener_snapshot(as_of date, security_id, …)` — PK `(as_of, security_id)`, partitioned monthly; one column per screenable field with the **same key and unit as the API field** (`docs/api/08` field list): classification (`sector_key`, `industry_key`, …), price/volume (`price`, `change_pct`, `volume`, `market_cap`, …), technicals (`pct_from_52w_high`, `atr_pct`, `relative_volume_50`, `up_down_volume_ratio_50`, `avg_dollar_volume_50`, booleans `above_ema_21/sma_50/sma_200`, `new_52w_high`, `new_ath`), fundamentals (`eps_yoy_pct`, `sales_yoy_pct`, `roe_pct`, …), ratings (`rs_rating`, `eps_rating`, `smr_rating`, …), patterns, institutional, events. NULL when the dataset is off or the security is unrated. Indexes: `(as_of, rs_rating)`, `(as_of, composite_rating)`, `(as_of, sector_key)`, partial on `breakout_today`, `in_buy_zone`. Universe = all securities active on `as_of` (delisted ones included on their past dates: survivorship safe), with columns `is_rating_eligible`, `passes_gate` so the API can filter `universe`. Keep 2 years hot; back-fill history on demand for `as_of`.
`screener_field(key, label, display_name, group, type, unit, min, max, operators[], sortable, default_column, min_tier, dataset, description, options_ref)` — the catalogue the backend serves; new columns become new rows.

## 6. News and institutional ingestion (requirements)
- **News** (`../api/07` §2): sources ranked SEC 8-K, Alpha Vantage `NEWS_SENTIMENT`, company press-release RSS, GDELT (discovery), Yahoo headlines (link-only). Store headline, ≤ 300-char snippet **only if the source licence allows**, URL, source key, provider, provider id, language, `published_at` (UTC), ticker links with `relevance`, classification (`category`, `sentiment_label/score`, `importance`, `classifier_version`, `confidence`), `dedupe_hash` (normalised headline + day). No article bodies, no publisher scraping. Entity linking to `security_id` via ticker/CIK/name. 8-K items → `category` (2.02 earnings, 5.02 management, 1.01 agreement, 2.01 M&A). Backfill 90 days at launch; retention full for headlines.
- **13F**: SEC quarterly, PIT by **filing date**; CUSIP→security mapping table; metrics per security per quarter (`fund_count`, change, ownership %, consecutive quarters increase, top-quality holders); `holders` list per quarter.
- **Rate limits**: SEC ≤ 10 req/s (internal limiter 5–8 req/s; `pipelines/sec/client.py` still empty), vendor quotas (Alpha Vantage per plan) → queue with priorities as in the EPS backfill.

## 7. Vendor independence and licensing flags
- Adapter interface per dataset (`PriceDataProvider`: Stooq, Yahoo, BusinessQuant, AlphaVantage) — the tables never change shape when the vendor changes; keep `source` per row/series.
- Store per source a `redistributable`/`display_rights` flag in `data_source(source, kind, display_allowed, snippet_allowed, notes)`; the backend uses it to decide what may be shown (front end only ever sees derived/allowed fields).
- Never serve Yahoo `adjclose` (dividend-adjusted). If a vendor supplies adjusted volume, record `volume_basis='split_adjusted'` in `dataset_status.meta`.

## 8. Data quality gates (must pass before `enabled=true`)
Calendar validation (missing/duplicate sessions vs `market_calendar`), absurd-return and split-jump detection (feeds `split_review_queue`), volume anomaly check, symbol-mapping coverage, index continuity, technicals recomputed from adjusted prices match a golden sample (front end supplies its Python golden fixtures for SMA/EMA/ATR: rel. tolerance 1e-6), rating coverage report per date (rated / eligible), PIT test ("filing accepted May 7 must not appear in a May 6 snapshot"), `dataset_status` consistency. Publish a per-run quality report (row counts, coverage %, failures).

## 9. Point-in-time and versioning rules the API relies on
`effective_date` (ratings), `disclosed_at`/`available_at` (fundamentals, filings), `filing_date` (13F), `published_at` (news). Never overwrite history: new `model_version` = new rows (or a new partition); the API selects `effective_date <= as_of`. Keep old `model_version` rows for the time machine. Formula changes bump `model_version`.

## 10. Schema ownership and access
Fetcher owns migrations for all schemas except `application.*` (backend). Create roles: `fetcher_rw`, `api_ro` (SELECT on market-data, ratings, news, etc.), `api_app` (RW on `application.*`). Provide the backend with DDL and a data dictionary (units, nullability, PIT columns, model_version domain) — `DATA_DICTIONARY.md` was deleted in favour of `MODEL_CHANGELOG.md`; recreate a **machine-readable dictionary** (`docs/data_dictionary.yaml`) for the columns above, because the backend and OpenAPI depend on it.

## 11. Delivery order and acceptance (mirrors milestones in `README.md`)
| M | Fetcher deliverable | Acceptance |
|---|---|---|
| M1 | `dataset_status`, `index_master`, exposure of security columns, trigram index | API `/meta` and `/stocks/search` served from them |
| M2 | split-adjusted served prices, `weekly_prices`, `market_calendar`, `index_prices` (60 indices, volume for NDQ/TSX), approved splits view | OHLCV for 20 golden symbols equals reference (split days continuous); index continuity report |
| M3 | technicals on adjusted prices, `relative_strength_history` vs benchmark | golden parity (1e-6) |
| M4 | `screener_snapshot` nightly + `screener_field` | count/run < 300 ms on 3 508 names |
| M5 | rating tables daily + explain payloads + unrated reasons | coverage report; `/ratings/dates` correct |
| M6 | fundamentals views, `sec_filing.items` | resolver PIT tests |
| M8 | industry ranks, market engine | reproducibility test of market states on golden periods |
| M9 | base engine + CAN SLIM tables with geometry/reasons | golden patterns |
| M10 | news pipeline + 13F | dedupe test, licence flags |

## 12. Open questions for the fetcher project
1. Which vendor becomes primary per dataset (prices: Stooq vs Yahoo vs Alpha Vantage; fundamentals: SEC + Business Quant), and their plan terms for showing derived data to paying users.
2. Are the 60 Stooq index series already loaded? Is volume present for `NDQ` and `TSX`? (If not: add.)
3. Is `technical_daily` computed on split-adjusted prices today (owner: everything will be)? Verify with the golden sample.
4. Target schedule (time of day) and whether the Stooq download can be automated.
5. Price-gate / dollar-volume gate (`avg_dollar_volume_50` now exists) for the eligibility flag.
6. Will `sec_filing` gain `items`/`period_end`?
7. Which news provider(s) and plan; who maintains the press-release feed list.
8. Retention and partition policy for `screener_snapshot`, `technical_daily` (28 M rows, partition by year?).
