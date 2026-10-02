# 04 — Fundamentals and SEC filings

Backing (all **DB**, from `SEC_INGESTION.md` + `FUNDAMENTALS.md`):

| Table | Role |
|---|---|
| `sec_filing` | one row per accession: `accession_number` (PK), `cik`, `form`, `filed` (date), `accepted_at` (EDGAR acceptance time, 3 rows NULL), `acceptance_source`. 197 970 rows. |
| `sec_financial_fact` | raw XBRL facts (11.3 M rows, immutable). Never exposed. |
| `fundamental_concept_map`, `fundamental_period`, `fundamental_metric` | normalised facts (**FUNDAMENTALS_V2**, 9 709 314 rows), keyed by accession so restatements are separate versions. |
| `fundamental_quarter_period`, `fundamental_quarter_metric` | standalone quarters (**QUARTERS_V2**): `quarter_start`, `quarter_end`, `fiscal_year_start`, `fiscal_quarter`, `sequence_source`; per metric `value`, `unit`, `source_rank` (DIRECT 0 / DERIVED 100), `disclosed_at`, `accession_number`. |
| resolver `resolve_issuer_quarters(engine, cik, as_of, metric_keys)` | point-in-time pick: `source_rank ASC, disclosed_at DESC, id DESC` among rows with `disclosed_at <= as_of`. |
| ANNUAL_EPS_V1 tables | annual primary EPS history, 1Y/3Y/5Y chains and CAGR endpoints. |

Growth and acceleration are **not stored**: the API computes them per request from two point-in-time quarter resolutions (current quarter and the same fiscal quarter 330–400 days earlier, closest to 364), so a later restatement never leaves stale growth. Only issuers in `FUNDAMENTAL_UNIVERSE_V1` (5 230 CIKs; `is_fundamental_rating_eligible`) have full coverage.

## 1. Filings (ships first)

### `GET /api/stocks/{symbol}/filings?form=10-K,10-Q&from=&to=&limit=50&cursor=`
```json
{ "data": [ { "accession_number": "0000950170-26-012345", "cik": "0000789019", "form": "10-Q",
              "filed": "2026-07-29", "accepted_at": "2026-07-29T20:11:00Z", "available_at": "2026-07-29",
              "acceptance_source": "edgar_submissions",
              "url": "https://www.sec.gov/Archives/edgar/data/789019/000095017026012345/" } ],
  "meta": { "total": 118 } }
```
`available_at = COALESCE(accepted_at::date, filed)` (backend point-in-time rule); the API builds `url` from `cik` + accession (no extra column needed). Forms: 10-Q, 10-K, 20-F, 6-K, 40-F, 8-K. **Not stored:** period end, fiscal period, amendment flag, 8-K item numbers — the contract does not promise them (join to `fundamental_quarter_period` for period info when the filing is a 10-Q/10-K). Join symbol → `security_master.cik`.

## 2. Quarterly financials

### `GET /api/stocks/{symbol}/fundamentals/quarterly?limit=12&as_of=&metrics=`
```json
{ "data": [ {
    "quarter_start": "2026-04-01", "quarter_end": "2026-06-30", "fiscal_year_start": "2025-07-01", "fiscal_quarter": 4,
    "disclosed_at": "2026-07-29T20:11:00Z", "availability_source": "accepted_at",
    "metrics": {
      "revenue":       { "value": 76400000000, "unit": "USD", "source": "direct", "accession_number": "…" },
      "eps_diluted":   { "value": 3.65, "unit": "USD/shares", "source": "direct", "accession_number": "…" },
      "eps_basic":     { "value": 3.68, "unit": "USD/shares", "source": "direct" },
      "net_income":    { "value": 27200000000, "unit": "USD", "source": "derived" },
      "gross_profit": { … }, "operating_income": { … }, "pretax_income": { … } },
    "primary_eps": { "value": 3.65, "concept": "eps_diluted", "fallback": null },
    "growth": {
      "eps":     { "yoy_pct": 15.2, "semantic": "positive_base", "prior_quarter_end": "2025-06-30", "prior_value": 3.17, "acceleration_pp": 2.4 },
      "revenue": { "yoy_pct": 17.1, "semantic": "positive_base", "prior_quarter_end": "2025-06-30", "prior_value": 65200000000, "acceleration_pp": 1.1 } } } ],
  "meta": { "as_of": "…", "model_version": { "quarters": "QUARTERS_V2", "fundamentals": "FUNDAMENTALS_V2" } } }
```
Rules taken from the backend:
- `metrics` keys = backend metric keys lower-cased: `revenue, eps_diluted, eps_basic, net_income, net_income_common, gross_profit, operating_income, pretax_income, income_tax, operating_cash_flow, capex, r_and_d, sg_and_a, operating_expense, total_cost_and_expense`… (default response returns the core set; `metrics=` widens it). Balance-sheet instants, shares outstanding and weighted-average shares are **never** derived quarters.
- `source: "direct"` (reported standalone quarter, always wins) or `"derived"` (Q2 = H1 − Q1, Q3 = 9M − H1, Q4 = FY − 9M). Derived values may differ slightly from a later direct one (Apple Q3 FY26: direct 2.02, derived would be 2.03) — the UI shows a "derived" marker.
- `fiscal_year_start` / `fiscal_quarter` may be `null` when derivations disagree (`sequence_source = DERIVED_BOUNDARY_CONFLICT`); never guessed.
- `primary_eps.concept`: diluted EPS is primary; `eps_basic` only as `fallback: "BASIC_FALLBACK"` for issuers without a diluted concept (e.g. REITs, ~2.3 %).
- `growth.*.semantic` (backend enum, lower-cased): `positive_base` (normal, `yoy_pct` defined), `zero_to_positive`, `zero_to_zero`, `zero_to_negative`, `loss_to_profit`, `loss_to_zero`, `negative_base` — for the last six `yoy_pct` is `null` and the UI shows the semantic in words.
- `acceleration_pp` = current YoY − prior-quarter YoY (percentage points), only when both are defined and the two quarter ends are 70–120 days apart, else `null`.
- **Adjusted EPS** (used by the ratings, from yfinance / Alpha Vantage) is a separate, non-SEC series: `eps_adjusted: { value, source: "yf_adj"|"av_adj" }` may accompany `primary_eps` when available; ratings' `eps_basis` says which one was used.
- Non-US 20-F/6-K filers often have annual data only → sparse quarters are normal. Banks (interest income + non-interest income), utilities and REIT FFO use alternate revenue concepts; `meta.revenue_basis` says which.
- Excluded facts (EPS plausibility flags `EXTREME_ABS_EPS_1M`, `IDENTITY_MISMATCH_100X`, …) never appear; `meta.excluded_count` is optional diagnostics.

### `GET /api/stocks/{symbol}/fundamentals/annual?limit=10&as_of=`
`fiscal_year_end`, `disclosed_at`, `primary_eps {value, concept, fallback}`, `revenue`, `net_income`, `roe_pct`, `operating_margin_pct`, `net_margin_pct`, `eps_growth_pct` (+`semantic`), and on the newest row `eps_cagr_3y_pct`, `eps_cagr_5y_pct` — **CAGR is `null` for ~62–69 % of issuers** (needs positive endpoints on a consecutive chain), and `chain_3y`, `chain_5y` booleans say why.

### `GET /api/stocks/{symbol}/fundamentals/metrics?as_of=`  (snapshot, plan §20; may be a view over the tables above)
`eps_yoy_pct, eps_3q_avg_yoy_pct, eps_acceleration_pp, sales_yoy_pct, sales_3q_avg_yoy_pct, sales_acceleration_pp, eps_cagr_3y_pct, eps_cagr_5y_pct, roe_pct, gross_margin_pct, operating_margin_pct, net_margin_pct, margin_trend_pp, debt_to_equity, shares_outstanding, float_shares, market_cap` plus `coverage: { "quarterly_growth": true, "annual_1y": true, "cagr_3y": false }`.

## 3. Chart markers
`GET /api/chart/{symbol}/markers?types=earnings,filing,split,dividend,news&from=&to=`:
```json
{ "data": [ { "timestamp": 1753747200000, "type": "earnings", "label": "E", "detail": "EPS 3.65 (+15%)", "ref": { "quarter_end": "2026-06-30" } },
            { "timestamp": 1753747200000, "type": "filing", "label": "10-Q", "ref": { "accession_number": "…" } } ] }
```
`earnings` markers are placed at `disclosed_at` (the moment the market could know), not at quarter end. Unavailable types are absent, never an error.

## 4. Point in time
Every endpoint here accepts `as_of`; rows with `disclosed_at > as_of` never appear; a restated value replaces the older one only after its own `disclosed_at` (backend resolver rule). `period_end > available_at` facts never form historical quarters.

## 5. Backend requirements
- Expose the resolver and growth logic behind these endpoints (pipelines `pipelines/sec/quarter_resolver.py`, `quarter_growth.py` already exist).
- Return `disclosed_at`, `source`, `availability_source` (`accepted_at` | `filed_next_day_fallback` for the 3 filings without acceptance time).
- Currency USD only for now; other units are excluded by unit-family enforcement.
- Keep `model_version` strings (`FUNDAMENTALS_V2`, `QUARTERS_V2`, `PRIMARY_EPS_V1`, `ANNUAL_EPS_V1`, `EPS_QUALITY_V1`) in `meta` so the front end can show provenance.
