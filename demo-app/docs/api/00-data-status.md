# 00 — Data status: what exists, what is planned

Source: the two backend-project documents `SECURITY_MASTER.md` (state of the DB) and `IMPLEMENTATION_PLAN.md`
(roadmap, almost every checkbox still `[ ]`). Status legend used in every file of this folder:

| Tag | Meaning |
|---|---|
| **DB** | Data is in the database today (per `SECURITY_MASTER.md`). Endpoint still has to be exposed. |
| **CODE** | A pure calculation module exists (no persisted table confirmed). Needs a persisted table + job + endpoint. |
| **PLAN** | Only in the roadmap. Nothing built. |
| **UNKNOWN** | Cannot tell from the documents; needs an answer from the backend project (see `../DATA-PLAN.md` §9). |

## 1. Implemented (DB)

| Domain | What exists | Notes for the front end |
|---|---|---|
| Security master | `security_master`: 13 317 securities. `id` is the stable anchor (**`security_id` ≠ ticker**). | Join everything on `id`. |
| Classification | `sector`, `industry`, `industry_group`, `sic`, `sic_name`, `sector_key`, `industry_key`; ETF/fund fields `fund_asset_class`, `fund_category`, `fund_family`, `fund_focus`, `fund_strategy`; `classification_source/status/updated_at`. SIC → Fama-French FF12/FF48, Yahoo fallback, name heuristics. Target 100–200 industry groups (not IBD's proprietary list). | `classification_status` may be `UNRESOLVED`. Two `classification_source` declarations in the ORM (known bug, backend's). |
| Enrichment V2 | `ipo_date`(+`_source`), `delisting_date`(+`_source`), `shares_outstanding`, `float_shares`, `market_cap` (**whole USD**), `shares_as_of`, `is_adr`, `is_spac`, `is_etf`, `security_master_version = SECURITY_MASTER_V2`. | `market_cap` is a snapshot at `shares_as_of`, not a daily series. |
| Universe flags | 13 317 total → 5 342 rating-eligible → 3 508 pass the eligibility gate. | Price / avg-dollar-volume gates **skipped** (columns do not exist yet), so the 3 508 still contains illiquid names. |
| Identity history | Tables `security_symbol_history`, `security_name_history`, `corporate_actions` **created but empty** (32 tests, no data). | Ticker resolution "as of a date" not available until populated. |
| SEC filing index | `sec_filing`: 197 970 rows; forms 10-Q, 10-K, 20-F, 6-K, 40-F, 8-K; since 2009-04-15. | Index only (accession, form, dates); no financial facts. |
| Daily prices | Exist (Stooq bulk `*.us.txt`, the same source the front end reads today) — **table shape UNKNOWN** (raw vs adjusted, per-security_id?). | See §4. |

## 2. Code only (CODE — no proof of persistence)

| Module | Produces | Missing |
|---|---|---|
| `technical_daily` (pure) | moving averages, price-location, volatility, volume metrics (plan §21) | table, nightly job, endpoint |
| EPS pipelines (pure) | quarterly / annual EPS building blocks | XBRL fact ingest, `financial_quarters`, table, endpoint |
| Eligibility gate (pure) | rating-eligible flag | price + dollar-volume inputs |

## 3. Planned (PLAN)

Everything below is unchecked in `IMPLEMENTATION_PLAN.md` §59.

| Domain (plan §) | Tables named in plan §50 | Front-end value |
|---|---|---|
| OHLCV pipeline, weekly bars, index prices, splits, dividends (§2, §50.2) | `daily_prices`, `weekly_prices`, `index_prices`, `splits`, `dividends` | chart data, adjusted prices, benchmark, RS line |
| Core technicals + RS engine (§11, §21) | `technical_daily`, `technical_weekly`, `relative_strength_history`, `volume_metrics` | server-side indicators, RS rating / line, screener |
| SEC fundamentals (§3, §4, §5, §20) | `xbrl_facts_raw`, `financial_quarters`, `financial_years`, `fundamental_metrics` | earnings block, C/A scores, chart markers |
| Ratings (§12–§19, §43) | `eps_/rs_/smr_/accdist_/sponsorship_/industry_/composite_rating_history`, `earnings_stability_history` | badges, screener columns, sort |
| Industry groups (§16) | `security_industry_history`, `industry_rating_history` | group RS, leaders, heat-map |
| Institutional 13F (§9, §17) | `institutional_managers`, `form13f_filings`, `form13f_holdings`, `institutional_metrics`, `fund_quality` | sponsorship, fund count |
| CAN SLIM (§42) | `canslim_component_scores`, `canslim_score_history` | score gauge with reasons |
| Patterns / trade engine (§22–§41) | `detected_bases`, `base_features`, `base_pivots`, `breakouts`, `sell_signals` | overlays on chart, breakout screens |
| Market regime (§10) | `market_state_history`, `follow_through_days`, `distribution_days`, `stalling_days`, `power_trend_history`, `market_exposure_history` | market banner, M score |
| News / events (§47) | `news_articles`, `company_events`, `event_classifications` | N score, chart markers |
| Backtest (§48) | `backtest.*` | pro feature, later |
| Application (`application.*`) | users, watchlists, saved screens, alerts, layouts | user features (see `09`) |

## 4. Backend/datafetcher facts the front end assumes (to be confirmed)

1. Daily bars exist for every `security_id` in the rating-eligible universe, back to IPO, from Stooq; volume in shares.
2. Prices are **raw (as traded)**; split/dividend adjustment is *planned* (`splits`, `dividends`, adjusted columns).
   Until then the front end must not assume `adjusted_close` exists (it is `null`).
3. No index prices (SPY / ^GSPC / ^IXIC) yet — needed for RS line, M, market state.
4. Nothing is computed for the whole universe yet except what the flag/classification steps produced.

## 5. What the front end does until each dataset exists

| Dataset off | Front-end behaviour |
|---|---|
| prices | keep reading static `*.us.txt` exports (current). |
| technicals | compute in the browser (current `IndicatorCalculationService` port). |
| ratings / canslim / patterns | features hidden (no client fallback — they need the universe). |
| fundamentals | earnings block hidden; chart markers hidden. |
| screener | current v1 `screener/run` on the demo table. |

Details: `10-capabilities-and-fallbacks.md`.
