# 04 — Fundamentals and SEC filings

Backing: `sec_filing` (**DB**, 197 970 rows); `xbrl_facts_raw`, `financial_quarters`, `financial_years`, `fundamental_metrics` (**PLAN**;
EPS building blocks exist as **CODE**).

## 1. Filings (can ship first, only needs the DB)

### `GET /api/stocks/{symbol}/filings?form=10-K,10-Q&from=&to=&limit=50&cursor=`
```json
{ "data": [ { "accession": "0000950170-26-012345", "form": "10-Q", "filing_date": "2026-07-29", "accepted_at": "2026-07-29T20:11:00Z",
              "period_end": "2026-06-30", "fiscal_year": 2026, "fiscal_period": "Q4", "is_amendment": false,
              "primary_doc_url": "https://www.sec.gov/Archives/…" } ],
  "meta": { "total": 118 } }
```
Forms: 10-Q, 10-K, 20-F, 6-K, 40-F, 8-K. Column names above are the contract; map from `sec_filing` (**confirm actual names**).
Used for chart "filing" markers and the checkup earnings block. `8-K` marker filter: `items=2.02` (earnings) when stored.

## 2. Quarterly / annual financials (**PLAN**)

### `GET /api/stocks/{symbol}/fundamentals/quarterly?limit=12&as_of=`
```json
{ "data": [ {
    "period_end": "2026-06-30", "fiscal_year": 2026, "fiscal_quarter": 4, "filing_date": "2026-07-29", "is_restated": false,
    "revenue": 76400000000, "net_income": 27200000000, "eps_gaap_diluted": 3.65, "eps_adjusted": null,
    "gross_profit": 53000000000, "operating_income": 34000000000, "pretax_margin_pct": 45.1, "net_margin_pct": 35.6,
    "shares_diluted": 7450000000,
    "eps_yoy_pct": 15.2, "revenue_yoy_pct": 17.1, "eps_qoq_pct": 3.4, "revenue_qoq_pct": 2.0,
    "eps_yoy_pct_prev": 12.8, "eps_acceleration": true, "revenue_acceleration": true,
    "earnings_date": "2026-07-29" } ],
  "meta": { "eps_basis": "gaap_diluted", "as_of": "…" } }
```
Rules: derive Q4 (10-K minus 9-month YTD) and Q2/Q3 from YTD as the backend's quarter-reconstruction does; `is_restated` when a later
filing changed the number (point-in-time: `as_of` returns the value known then). Amounts in whole USD, per-share in USD.

### `GET /api/stocks/{symbol}/fundamentals/annual?limit=10&as_of=`
`fiscal_year, period_end, revenue, net_income, eps_gaap_diluted, eps_growth_pct, roe_pct, operating_margin_pct, net_margin_pct,
 eps_cagr_3y_pct, eps_cagr_5y_pct` (CAGR only on the latest row).

### `GET /api/stocks/{symbol}/fundamentals/metrics?as_of=`  (`fundamental_metrics`, latest snapshot)
`eps_yoy_pct, eps_3q_avg_yoy_pct, eps_acceleration_pct, sales_yoy_pct, sales_3q_avg_yoy_pct, sales_acceleration_pct,
 eps_cagr_3y_pct, eps_cagr_5y_pct, roe_pct, gross_margin_pct, operating_margin_pct, net_margin_pct, margin_trend_pct,
 debt_to_equity, shares_outstanding, float_shares, market_cap` (plan §4, §5, §20).

### `GET /api/stocks/{symbol}/earnings-calendar` → `{ last_report_date, next_report_date (estimate|confirmed), is_estimated }` (**PLAN**, only if a source exists).

## 3. Chart markers
`GET /api/chart/{symbol}/markers?types=earnings,filing,split,dividend,news&from=&to=` (one call for all marker layers):
```json
{ "data": [ { "timestamp": 1753747200000, "type": "earnings", "label": "E", "detail": "EPS 3.65 (+15%)", "ref": { "period_end": "2026-06-30" } },
            { "timestamp": 1753747200000, "type": "filing",   "label": "10-Q", "ref": { "accession": "…" } } ] }
```
Requires only the datasets behind the requested `types`; unknown/unavailable types are simply absent (never an error).

## 4. Backend requirements
- Normalised concept map (Revenue, NetIncome, EPS diluted…), currency USD only for now; ADR / 20-F filers flagged.
- 10-K/A and 10-Q/A handled (`is_amendment`, `is_restated`).
- `filing_date`/`accepted_at` stored so point-in-time (`as_of`) is exact.
