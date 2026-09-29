# 08 — Screener

Extends v1 (`GET api/screener/filters`, `POST api/screener/run`, response `{results: Stock[], result_count, filters_used, timestamp, meta}`).
v1 keeps working unchanged; v2 is selected by sending `"version": 2` in the run body (and `GET /api/screener/fields`).
Backing: a **daily denormalised snapshot table** `screener_snapshot` (see §5) so a screen is a single indexed scan, never a join of 10 tables.

## 1. Field catalogue — `GET /api/screener/fields`
The front end builds the filter UI **from this response**; adding a field on the backend needs no front-end release.
```json
{ "data": [ { "key": "eps_rating", "label": "EPS Rating", "display_name": "EPS Rating", "group": "ratings", "type": "int", "min": 1, "max": 99, "unit": null,
              "operators": ["gte","lte","between","eq"], "sortable": true, "default_column": true,
              "min_tier": "plus", "description": "…", "dataset": "eps_rating" },
            { "key": "sector_key", "label": "Sector", "group": "classification", "type": "enum", "options_ref": "/api/universe/facets#sectors",
              "operators": ["in","not_in"], "min_tier": "free", "dataset": "security_master" },
            { "key": "smr_rating", "type": "grade", "options": ["A","B","C","D","E"], "operators": ["in","gte_grade","lte_grade"] } ],
  "meta": { "groups": ["classification","price_volume","technicals","fundamentals","ratings","canslim","patterns","institutional","events"],
            "available_datasets": ["security_master","prices"] } }
```
`display_name` is the **user-facing label controlled by the backend** (default = `label`), so trademark-sensitive names can be changed without a release (see `../DATA-PLAN.md` §7). `type`: `int | number | pct | usd | shares | bool | enum | grade | date | string`. Fields whose `dataset` is not in `available_datasets` are
returned with `available:false` (greyed "coming soon" in the UI) — never omitted silently.

### Field list by group (key — type — source)
| Group | Keys | Status |
|---|---|---|
| classification | `sector_key`, `industry_key`, `industry_group`, `exchange`, `security_type`, `is_etf`, `is_adr`, `is_spac`, `sic` | DB |
| price_volume | `price`, `change_pct`, `volume`, `market_cap`, `shares_outstanding`, `float_shares`, `ipo_date`, `age_years` | DB / prices |
| technicals | `pct_from_52w_high`, `pct_from_52w_low`, `pct_from_sma_50`, `pct_from_sma_200`, `new_52w_high`, `new_ath`, `atr_pct`, `relative_volume_50`, `up_down_volume_ratio_50`, `avg_volume_50`, `avg_dollar_volume_50`; derived booleans `above_ema_21`, `above_sma_50`, `above_sma_200` (price vs the stored MAs); later `rs_new_high` | **DB** (`technical_daily`) |
| fundamentals | `eps_yoy_pct`, `eps_3q_avg_yoy_pct`, `eps_acceleration`, `sales_yoy_pct`, `sales_3q_avg_yoy_pct`, `sales_acceleration`, `eps_cagr_3y_pct`, `eps_cagr_5y_pct`, `roe_pct`, `gross_margin_pct`, `operating_margin_pct`, `net_margin_pct`, `margin_trend_pct` | PLAN |
| ratings | `rs_rating`, `rs_3m_rating`, `rs_6m_rating`, `rs_exp_3m` (**DB, daily**); `eps_rating`, `smr_rating` (**DB, 19 stored dates → screener `as_of` limited to those**); `composite_rating`, `accdist_rating`, `sponsorship_rating`, `group_rs_rating`, `group_rank`, `earnings_stability` (PLAN) | mixed |
| canslim | `canslim_score`, `c_score`, `a_score`, `n_score`, `s_score`, `l_score`, `i_score`, `m_score` | PLAN |
| patterns | `pattern_type`, `base_stage`, `base_quality_score`, `distance_to_pivot_pct`, `in_buy_zone`, `breakout_today`, `breakout_days_ago`, `failed_breakout`, `breakout_quality_score`, `early_entry_available` | PLAN |
| institutional | `fund_count`, `fund_count_change_q`, `institutional_ownership_pct`, `consecutive_quarters_increase` | PLAN |
| events | `has_catalyst_60d`, `days_since_earnings` | PLAN |

## 2. Run — `POST /api/screener/run`
```json
{
  "version": 2, "as_of": null,
  "universe": "gate",                      // "gate" (3 508, default) | "rating_eligible" | "all"
  "filter": { "op": "and", "items": [
      { "field": "rs_rating", "op": "gte", "value": 80 },
      { "field": "sector_key", "op": "in", "value": ["technology","healthcare"] },
      { "field": "price", "op": "between", "value": [10, 500] },
      { "op": "or", "items": [ { "field": "pattern_type", "op": "in", "value": ["flat_base","cup_with_handle"] },
                               { "field": "breakout_today", "op": "eq", "value": true } ] } ] },
  "sort": [ { "field": "composite_rating", "dir": "desc" } ],
  "columns": ["symbol","company_name","price","change_pct","composite_rating","eps_rating","rs_rating"],
  "limit": 50, "cursor": null
}
```
Operators: `eq, ne, gt, gte, lt, lte, between, in, not_in, is_null, not_null, gte_grade, lte_grade`. Nesting depth ≤ 3, ≤ 30 leaves.
Unknown field/operator → `400 bad_filter` with `details.field`. A field of a higher tier → `402 upgrade_required`.
Legacy body `{ "filters": {…}, "limit": n }` (v1 flat keys) is still accepted and mapped server-side.

Response:
```json
{ "data": [ { "security_id": 4821, "symbol": "MSFT", "company_name": "Microsoft Corporation", "price": 427.31, "change_pct": 0.75,
              "composite_rating": 98, "eps_rating": 97, "rs_rating": 94 } ],
  "meta": { "as_of": "2026-09-22", "total": 143, "limit": 50, "next_cursor": "…", "universe": "gate", "took_ms": 38,
            "limits": { "max_results": 200, "truncated": true }, "model_version": { … } } }
```
Always present in each row: `security_id`, `symbol`, `company_name`. v1 rows (`ticker`, `name`, `change_percent`, …) are returned when `version` is absent.

## 3. Other endpoints
| Endpoint | Purpose |
|---|---|
| `POST /api/screener/count` | same body → `{ "count": 143 }` only; live "N matches" while editing filters; not counted against quota |
| `POST /api/screener/export` | same body + `format: csv|json` → file (`Content-Disposition`); tier `exportData` |
| `GET /api/screener/presets` | system presets: `{ id, name, description, filter, sort, columns, min_tier }` — **CAN SLIM**, **Breakout-ready**, **Recent breakouts**, **Top industry leaders**, **RS leaders**, **Earnings accelerators**, **New highs with RS line**, **Tight & quiet (VCP-like)**, **Value + growth** |
| `GET/POST/PUT/DELETE /api/user/screens` | saved screens `{ id, name, filter, sort, columns, created_at, updated_at, is_alert }`; `409` on duplicate name; limit by tier |
| `GET /api/screener/history?limit=20` | recent runs (server-side, optional) |

## 4. Point in time
`as_of` (past date) runs the same body against the snapshot of that date (`screener_snapshot` partitioned by `as_of`); universe = securities
active on that date (survivorship-safe, includes since-delisted). Tier: Ultimate. Powers "what would this screen have found on 2024-03-01".

## 5. Table `screener_snapshot` (materialised nightly, last step of the batch)
PK `(as_of, security_id)`, partition by `as_of` (monthly). One column per screenable field above (same names/units); `NULL` if the dataset is off.
Indexes: btree on `(as_of, composite_rating)`, `(as_of, rs_rating)`, `(as_of, sector_key)`, partial on `breakout_today`, `in_buy_zone`. Keep 2 years hot,
older on cold storage. Row ≈ 200 B × 3 508 × 250 days ≈ 175 MB/year — small.

## 6. Front-end use
Filter builder (fields drive UI), column chooser, presets menu, saved screens, result table with sortable columns, CSV export, watchlist add,
"open chart" links carrying the screener's `symbol`, and `as_of` picker.
