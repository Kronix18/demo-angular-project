# 00 — Data status: what exists, what is planned

Source: the two backend-project documents `SECURITY_MASTER.md` (state of the DB) and `IMPLEMENTATION_PLAN.md`
(roadmap, almost every checkbox still `[ ]`). Status legend used in every file of this folder:

| Tag | Meaning |
|---|---|
| **DB** | Data is in the database today (per the backend docs `SECURITY_MASTER`, `PRICE_DATA`, `DAILY_INGESTION_GUIDE`, `EPS_STATUS`, `SMR_STATUS`). Endpoint still has to be exposed. |
| **CODE** | A pure calculation module exists (no persisted table confirmed). Needs a persisted table + job + endpoint. |
| **PLAN** | Only in the roadmap. Nothing built. |
| **UNKNOWN** | Cannot tell from the documents; needs an answer from the backend project (see `../DATA-PLAN.md` §9). |

## 1. Implemented (DB)

| Domain | What exists | Notes for the front end |
|---|---|---|
| Security master | `security_master`: 13 317 securities. `id` is the stable anchor (**`security_id` ≠ ticker**). | Join everything on `id`. |
| Classification | `sector`, `industry`, `industry_group`, `sic`, `sic_name`, `sector_key`, `industry_key`; ETF/fund fields; `classification_source/status/updated_at`. SIC → Fama-French plus fallbacks; target 100–200 industry groups. | `classification_status` may be `UNRESOLVED`. |
| Enrichment V2 | `ipo_date`, `delisting_date`, `shares_outstanding`, `float_shares`, `market_cap` (**whole USD**), `shares_as_of`, `is_adr`, `is_spac`, `is_etf`. | `market_cap` is a snapshot, not a daily series. |
| Universe flags | 13 317 → 5 342 rating-eligible → 3 508 pass the gate (price / dollar-volume gates still skipped, but `avg_dollar_volume_50` now exists in `technical_daily`, so they can be added). | |
| **Daily prices** | **`stock_history`**: `(security_id, date)` PK, `open/high/low/close` stored as `VARCHAR(20)`, `volume NUMERIC`, from 1997-01-02, ~95 % of Stooq tickers mapped. **Provider (Stooq) prices as ingested, not mutated**; split-adjusted views are derived on demand. Incremental daily import (`sync_stooq_daily.py`), idempotent, **currently a manual Stooq download** (bot-walled). Current through the last finalised session (guide verified 2026-09-04). | Prices are strings in the DB → the API must cast to numbers. No `adj_close`, no dividend-adjusted series **by design** (total-return is rejected for pattern geometry). |
| Intraday | `stock_history_intraday` (5 and 60 min) exists but holds only indices / forex / metals today, **no US stocks**. | No intraday charts. |
| **Splits / dividends** | `splits(security_id, ex_date, factor)` (4.0 = 4:1, 0.5 = 1:2 reverse), `dividends(security_id, ex_date, amount, currency)`, mirrored into `corporate_actions` (types `ticker_change`, `name_change`, `merger`, `delisting`, `split`, `dividend`). `split_review_queue` + `stock_history_audit` hold detected-but-unapproved splits. 592 verified splits loaded for the EPS work. | Populated at least for EPS; coverage for the whole universe to confirm. **Volume is NOT split-adjusted** (frozen policy). |
| **`technical_daily`** | Persisted, ~28 M rows, model `TECHNICAL_DAILY_V1`, incremental after each price import. Columns: `sma_10, ema_21, sma_50, sma_200, high_52w, low_52w, ath_high, pct_from_52w_high, pct_from_52w_low, new_52w_high, new_ath, pct_from_sma_50, pct_from_sma_200, true_range, atr_14, atr_pct, avg_volume_20, avg_volume_50, avg_dollar_volume_50, relative_volume_50, up_volume_50, down_volume_50, up_down_volume_ratio_50`. | Not stored: SMA 100, ATR 20/30, avg volume 10, weekly MAs, MA slopes, days-above counters. Chart needs of these stay client-side. |
| **RS ratings** | `rs_rating_history`, updated daily by `update_ratings.py`: `RS_3M_V1`, `RS_6M_V1`, `RS_12M_V1` (canonical "original"), `RS_ER3_V1` (3-month exponential). Whole eligible universe per date; < 5 sessions of history → 1. | No 9-month window. No RS *line* (needs index prices). |
| **EPS rating** | `EPS_V5_3` in prod on **19 stored dates** (2023-07 … 2026-09-15), not daily. Adjusted EPS is the primary input (YF_ADJ / AV_ADJ), GAAP fallback. Rank correlation vs IBD ≈ 0.75, 91 % coverage of IBD's list on 2026-06-17. Backfill of foreign filers running until ~2026-10-20. | It is a **model estimate**, not IBD's number. REITs weak (ρ 0.40). |
| **SMR rating** | `smr_rating_history`, `SMR_V4` (bank scoring) on the same 19 dates; letters A–E by quintile from sales growth, after-tax and pretax margin, ROE. ρ ≈ 0.80 vs IBD, ~80 % coverage of IBD-graded names. Data source `external_quarter_financials` (yfinance quarters, 488 foreign issuers) + SEC-derived `PROFITABILITY_V1` inputs. | Not in any cron. Unrated when the latest quarter is > 250 days old. |
| Identity history | `security_symbol_history`, `security_name_history` created but **empty**. | Ticker-as-of resolution not available. |
| SEC filing index | `sec_filing`: 197 970 rows (10-Q, 10-K, 20-F, 6-K, 40-F, 8-K; since 2009-04-15). | Index only. |
| Fundamentals (partial) | Point-in-time SEC-derived quarterly inputs (revenue, margins, EPS, ROE) exist inside the EPS/SMR pipelines, GAAP and adjusted EPS series, and REIT FFO extraction. **Table names for a general fundamentals endpoint are UNKNOWN.** | Ask which tables are queryable. |

## 2. Not yet built (PLAN)

| Domain (plan §) | Tables named in plan §50 | Front-end value |
|---|---|---|
| Weekly bars, index prices (§2, §50.2) | `weekly_prices`, `index_prices` | weekly interval, benchmark, RS line, market state |
| SEC fundamentals as a served dataset (§3, §4, §5, §20) | `financial_quarters`, `financial_years`, `fundamental_metrics` (probably fed by the pipelines above) | earnings block, C/A scores, chart markers |
| Accumulation/Distribution, Sponsorship, Group RS, Earnings Stability, **Composite** (§13, §15–§18) | `accdist_/sponsorship_/industry_/composite_rating_history`, `earnings_stability_history` | badges, screener columns |
| Industry groups ranking (§16) | `industry_rating_history` | group RS, leaders, heat-map |
| Institutional 13F (§9, §17) | `form13f_*`, `institutional_metrics` | sponsorship |
| CAN SLIM (§42) | `canslim_*` | gauge with reasons |
| Patterns / trade engine (§22–§41) | `detected_bases`, `base_pivots`, `breakouts`, `sell_signals` | overlays |
| Market regime (§10) | `market_state_history`, `follow_through_days`, `distribution_days`, … | market banner |
| News / events (§47) | `news_articles`, `company_events` | N score, markers |
| Backtest (§48) | `backtest.*` | later |
| Application schema | users, watchlists, saved screens, alerts, layouts | user features (see `09`) |

## 3. Facts the API design now relies on

1. **Prices are raw provider prices; the API derives split-adjusted ones** from `splits` (`SPLIT_ONLY`). `adjust=all` (total return) is **not offered**. **Volume is returned as stored** (no split division) unless the caller asks `adjust_volume=true`.
2. **Ratings exist only on 19 stored dates**, not per day. `/ratings` therefore answers "latest stored date not after `as_of`" and reports the actual `effective_date`; history is sparse (see `03`). RS ratings are daily.
3. **Ratings are model estimates** of the IBD-style concept (versioned: `EPS_V5_3`, `SMR_V4`, `RS_*_V1`). The UI labels them "model rating", shows `model_version`, and never claims they equal IBD's.
4. Coverage is partial by design: only the rated universe (~3 000–3 500 names per date), foreign 20-F filers mostly unrated. Every rating field can be `null` with an `unrated_reason` (`no_quarterly_data`, `stale_quarter`, `not_eligible`, `too_new`, `no_cik`).
5. **Data freshness is human-driven today** (manual Stooq download → import → technicals → RS). `data_as_of` may lag several days; `next_refresh_after` may be `null`. The front end must show the date, never imply "live".
6. IBD changed its own method on 2026-04-27 (SMR / EPS). Backend models track IBD's behaviour at each date; front end just shows `model_version`.

## 4. What the front end does until each dataset exists

| Dataset off | Front-end behaviour |
|---|---|
| prices | keep reading static `*.us.txt` exports (current). |
| technicals | compute in the browser (current `IndicatorCalculationService` port). |
| RS / EPS / SMR ratings | badges hidden until `datasets` lists `ratings`; partial ratings show only the fields that are non-null. |
| composite, A/D, sponsorship, group RS, CAN SLIM, patterns | features hidden (no client fallback — they need the universe). |
| fundamentals | earnings block hidden; chart markers hidden. |
| screener | current v1 `screener/run` on the demo table. |

Details: `10-capabilities-and-fallbacks.md`.
