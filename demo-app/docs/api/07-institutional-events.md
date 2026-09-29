# 07 — Institutional sponsorship and news events

## 1. Institutional (13F)  — **PLAN** (`institutional_managers`, `form13f_filings`, `form13f_holdings`, `institutional_metrics`, `fund_quality`)

13F data is quarterly and public **45 days after quarter end**; `as_of` must only include filings filed by then (no look-ahead).

### `GET /api/stocks/{symbol}/institutional?as_of=`
```json
{ "security_id": 4821, "as_of": "2026-09-22", "latest_quarter": "2026-06-30",
  "fund_count": 5120, "fund_count_change_q": 84, "fund_count_change_pct": 1.7,
  "institutional_ownership_pct": 74.2, "shares_held": 5510000000,
  "consecutive_quarters_increase": 4,
  "top_quality_holders": 38, "sponsorship_rating": "A",
  "history": { "quarter": ["2025-09-30","2025-12-31","2026-03-31","2026-06-30"], "fund_count": [ … ], "shares_held": [ … ] } }
```
### `GET /api/stocks/{symbol}/institutional/holders?quarter=2026-06-30&sort=shares:desc&limit=25`
`{ manager_id, manager_name, shares, value_usd, pct_of_shares_out, change_shares, change_pct, is_new, is_sold_out, quality_score, filing_date }`.
Ultimate only (proposal, see `09`) (`feature: "holders"`).
### `GET /api/institutions/{manager_id}` (name, AUM, quality score, top holdings) — later.

## 2. News / catalyst events — **PLAN** (`news_articles`, `company_events`, `event_classifications`)

### `GET /api/stocks/{symbol}/events?from=&to=&types=&min_importance=&limit=50`
```json
{ "data": [ { "event_id": 55123, "date": "2026-08-01", "published_at": "2026-08-01T13:05:00Z",
              "type": "new_product", "sentiment": "positive", "importance": 4,
              "headline": "…", "source": "…", "url": "…", "summary": null,
              "confidence": 0.82, "classifier_version": "EVENT_V1" } ] }
```
`type`: `new_product`, `new_management`, `new_contract`, `earnings_surprise`, `guidance_raise`, `guidance_cut`, `merger_acquisition`,
`fda_approval`, `patent`, `buyback`, `insider_buying`, `upgrade`, `downgrade`, `lawsuit`, `regulatory`, `other`.
Licensing note: only `headline`, `url` and our own classification are returned; article bodies are never exposed (licence).
### `GET /api/events/recent?types=&min_importance=4&limit=50` — market-wide feed (screener "N" filter: `has_catalyst_60d`).
