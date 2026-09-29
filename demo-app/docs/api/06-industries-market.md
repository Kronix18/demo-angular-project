# 06 — Industry groups and market state

Backing: `security_master.industry_group` (**DB**); `security_industry_history`, `industry_rating_history` (**PLAN**);
`market_state_history`, `follow_through_days`, `distribution_days`, `stalling_days`, `power_trend_history`, `market_exposure_history` (**PLAN**).

## 1. Industry groups

### `GET /api/industries?as_of=&sort=rank:asc&sector_key=`
Phase-1 (DB only) fields have `rs`-dependent ones `null`.
```json
{ "data": [ { "industry_key": "software_infrastructure", "name": "Software—Infrastructure", "sector_key": "technology",
              "stock_count": 74, "rating_eligible_count": 61,
              "group_rs_rating": 96, "group_rank": 12, "group_count": 180, "rank_change_1w": 3, "rank_change_13w": -5,
              "return_1m_pct": 6.2, "return_3m_pct": 14.8, "return_6m_pct": 31.0, "return_12m_pct": 52.4,
              "avg_composite": 84.1, "pct_above_sma_50": 71.0, "pct_above_sma_200": 80.5, "new_highs": 6, "new_lows": 0 } ],
  "meta": { "as_of": "…", "model_version": { "group_rs": "GROUPRS_V1" } } }
```
### `GET /api/industries/{industry_key}` — the row above plus `top_stocks` (top 5 by composite: `security_id, symbol, company_name, composite_rating, rs_rating, eps_rating`) and `history` (weekly rank series, columnar).
### `GET /api/industries/{industry_key}/stocks?sort=composite_rating:desc&limit=50` — same row shape as the screener result.
### `GET /api/sectors` — same as industries aggregated to `sector_key` (available Phase-1 with counts only).

## 2. Market state (M)

### `GET /api/market/state?as_of=`
```json
{ "as_of": "2026-09-22",
  "market_state": "confirmed_uptrend",
  "state_since": "2026-08-12", "exposure_pct": 80,
  "follow_through": { "date": "2026-08-12", "index": "COMP", "gain_pct": 1.9, "volume_ratio": 1.2, "rally_day": 5 },
  "distribution": { "SPX": { "count_25d": 3, "days": ["2026-09-04","2026-09-10","2026-09-18"] },
                    "COMP": { "count_25d": 4, "days": [ … ] } },
  "stalling_days": { "SPX": 0, "COMP": 1 },
  "power_trend": { "active": true, "since": "2026-08-30" },
  "index_position": { "COMP": { "above_ema_21": true, "above_sma_50": true, "above_sma_200": true },
                     "SPX":  { "above_ema_21": true, "above_sma_50": true, "above_sma_200": true } },
  "breadth": { "pct_above_sma_50": 64.2, "pct_above_sma_200": 71.0, "new_highs": 210, "new_lows": 34, "advancers": 2100, "decliners": 1400 } }
```
`market_state`: `market_correction | rally_attempt | follow_through | confirmed_uptrend | uptrend_under_pressure`. `exposure_pct`: 0,20,40,60,80,100.

### `GET /api/market/state/history?from=&to=` — daily columnar `date, market_state, exposure_pct, power_trend, dist_count_spx, dist_count_comp`
Used for chart background shading ("market regime" overlay) and the time machine.
### `GET /api/market/distribution?index=COMP&from=&to=` — list of `{date, index, loss_pct, volume_ratio, expires_on}`.
### `GET /api/market/follow-through?from=&to=` — list of `{date, index, gain_pct, volume_ratio, rally_day_number, attempt_start}`.
### `GET /api/market/breadth?from=&to=` — daily columnar breadth series.

## 3. Front end
Market banner (state pill + exposure meter), chart regime shading, screener "M" gating, Industry page (heat-map treemap by
`return_3m_pct` coloured, sized by `stock_count`). The industry list and sector counts can ship before ratings exist.
