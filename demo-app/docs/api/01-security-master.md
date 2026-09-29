# 01 — Security master

Backing: `security_master` (**DB**), `splits`, `dividends` (**DB**), `corporate_actions` (**DB**), `security_symbol_history`, `security_name_history` (**DB, empty**).
Conventions: see `README.md`.

## Object: `Security`

```json
{
  "security_id": 4821,
  "symbol": "MSFT",
  "company_name": "Microsoft Corporation",
  "exchange": "NASDAQ",
  "security_type": "common_stock",
  "sector": "Technology", "industry": "Software—Infrastructure", "industry_group": "Software",
  "industry_key": "software_infrastructure", "sector_key": "technology",
  "sic": "7372", "sic_name": "Services-Prepackaged Software",
  "ipo_date": "1986-03-13", "delisting_date": null,
  "shares_outstanding": 7430000000, "float_shares": 7420000000, "market_cap": 3120000000000, "shares_as_of": "2026-09-19",
  "is_adr": false, "is_spac": false, "is_etf": false,
  "is_rating_eligible": true, "passes_eligibility_gate": true,
  "fund": null,
  "classification_status": "RESOLVED"
}
```

| Field | Column | Type | Status |
|---|---|---|---|
| `security_id` | `security_master.id` | int | DB |
| `symbol`, `company_name`, `exchange`, `security_type` | same names (**exact column names: confirm**) | string | DB |
| `sector`, `industry`, `industry_group`, `sector_key`, `industry_key`, `sic`, `sic_name` | same | string | DB |
| `ipo_date`, `delisting_date` | same | date | DB |
| `shares_outstanding`, `float_shares` | same | NUMERIC(20,2) → number | DB |
| `market_cap` | `market_cap` | whole USD | DB (snapshot) |
| `is_adr`, `is_spac`, `is_etf` | same | bool | DB |
| `is_rating_eligible`, `passes_eligibility_gate` | **flags/columns to expose (name TBC)** | bool | DB (5 342 / 3 508) |
| `fund` | `fund_asset_class`, `fund_category`, `fund_family`, `fund_focus`, `fund_strategy` | object \| null (only when `is_etf`) | DB |
| `classification_status` | same | `RESOLVED` \| `UNRESOLVED` \| … | DB |

`market_cap` must be re-derived from a price for "live" market cap in the screener (see `08`); the snapshot is fine for
the stock header. Never exposed: `classification_source`, `security_master_version` (internal), except in `?debug=1`.

## Endpoints

### `GET /api/stocks/search?q=&limit=10&type=&exclude_etf=`  — extends v1 (`api/stocks/search`)
Type-to-search dialog (Phase 11) and compare / watchlist add. Ranking: exact symbol → symbol prefix → name prefix →
name contains. Includes delisted only when `include_delisted=true`.
```json
{ "data": [ { "security_id": 4821, "symbol": "MSFT", "company_name": "Microsoft Corporation",
              "exchange": "NASDAQ", "security_type": "common_stock", "is_etf": false, "is_delisted": false } ],
  "meta": { "total": 1 } }
```
Index needs: `lower(symbol)` prefix, trigram (`pg_trgm`) on `company_name`.

### `GET /api/stocks/{symbol}`  — extends v1
Returns one `Security` plus a `quote` (latest close, change, volume) and `capabilities` (see `10`):
```json
{ "security": { … }, "quote": { "as_of": "2026-09-22", "close": 427.31, "change": 3.2, "change_pct": 0.75,
                                 "volume": 21500000, "high_52w": 468.35, "low_52w": 309.45 },
  "capabilities": { "prices": true, "technicals": true, "ratings": false } }
```
`?as_of=YYYY-MM-DD` resolves the symbol as of that date via `security_symbol_history` (ticker reuse / renames);
until that table is populated the current symbol is used and `meta.symbol_resolution = "current_only"`.

### `GET /api/securities/{security_id}`  — same body, addressed by id (used by links, alerts, saved layouts).

### `GET /api/securities/{security_id}/identity`  (**PLAN**, needs the empty history tables filled)
```json
{ "symbol_history": [ { "symbol": "FB", "effective_from": "2012-05-18", "effective_to": "2022-06-09", "is_current": false },
                      { "symbol": "META", "effective_from": "2022-06-09", "effective_to": null, "is_current": true } ],
  "name_history":   [ { "company_name": "Facebook, Inc.", "effective_from": "…", "effective_to": "…" } ] }
```
`effective_from` inclusive, `effective_to` exclusive, `null` = current (as the backend defines it).

### `GET /api/securities/{security_id}/corporate-actions?from=&to=&type=`  (**DB** for split/dividend)
Feeds chart markers (split "S", dividend "D") and the adjusted-price toggle.
```json
{ "data": [ { "effective_date": "2024-06-10", "action_type": "split", "details": { "factor": 10.0 }, "source": "…" },
            { "effective_date": "2026-08-14", "action_type": "dividend", "details": { "amount": 0.83, "currency": "USD" }, "source": "…" } ] }
```
`action_type` (backend CHECK domain): `split | dividend | merger | delisting | ticker_change | name_change`. Split `details`: `{"factor": 4.0}` (4.0 = 4:1, 0.5 = 1:2 reverse; the API may add `ratio_from/ratio_to`); dividend `details`: `{"amount": 0.83, "currency": "USD"}`. Sourced from `splits` / `dividends` (PK `security_id, ex_date`) and mirrored in `corporate_actions`; only **approved** splits are exposed (detected ones wait in `split_review_queue`).

### `GET /api/universe/facets`  (**DB**, cheap)
Drives screener dropdowns and the industry tree. Counts respect the eligibility gate unless `scope=all`.
```json
{ "sectors": [ { "key": "technology", "name": "Technology", "count": 610 } ],
  "industries": [ { "key": "software_infrastructure", "name": "Software—Infrastructure", "sector_key": "technology", "count": 74 } ],
  "exchanges": [ { "key": "NASDAQ", "count": 1811 } ],
  "security_types": [ { "key": "common_stock", "count": 3300 } ],
  "counts": { "total": 13317, "rating_eligible": 5342, "passes_gate": 3508 } }
```

## Requirements on the backend (summary)
1. Expose the eligibility flags as columns (or a materialised view) so screener/search can filter cheaply.
2. Populate the three history tables (or tell us they will stay empty → the front end never offers "as of" symbol resolution).
3. Provide `exchange` and a normalised `security_type` enum (`common_stock | adr | etf | fund | preferred | warrant | right | unit | other`).
