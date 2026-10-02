# 03 — Technicals, RS line, ratings

Backing: `technical_daily` (**DB**, `TECHNICAL_DAILY_V1`, ~28 M rows), `rs_rating_history` (**DB**, daily), `eps_`/`smr_rating_history` (**DB**, 19 stored dates), `technical_weekly`, `relative_strength_history` (RS line), other `*_rating_history` (**PLAN**). Front-end today: computes indicators client-side (`IndicatorCalculationService`).

## 1. Technical series

### `GET /api/stocks/{symbol}/technicals`
| Param | Meaning |
|---|---|
| `interval` | `1d` (default) or `1w` |
| `from`, `to`, `format`, `limit` | as OHLCV (`format=columnar` recommended) |
| `series` | comma list from the catalogue below; default = all in the tier |
| `as_of` | latest row not after this date |

Columnar answer (timestamps identical to OHLCV bars so the client zips by index or by `timestamp`):
```json
{ "data": { "timestamp": [1758499200000, …],
            "sma_10": [ … ], "ema_21": [ … ], "sma_50": [ … ], "sma_200": [ … ],
            "atr_14": [ … ], "atr_14_pct": [ … ], "vol_avg_50": [ … ], "rel_volume": [ … ], "ud_volume_ratio": [ … ] },
  "meta": { "as_of": "2026-09-22", "calculated_at": "…", "model_version": { "technicals": "TECHNICAL_DAILY_V1" } } }
```
Warm-up values are `null` (never `0`); arrays are the same length as the timestamp array.

**Series catalogue** = the real `technical_daily` columns (API key = column name, so no mapping layer):

| Group | Series | Unit | Status |
|---|---|---|---|
| Moving averages | `sma_10`, `ema_21`, `sma_50`, `sma_200` | price | DB |
| Price location | `high_52w`, `low_52w`, `ath_high`; `pct_from_52w_high`, `pct_from_52w_low`, `pct_from_sma_50`, `pct_from_sma_200` (percent); `new_52w_high`, `new_ath` (bool) | | DB |
| Volatility | `true_range`, `atr_14`, `atr_pct` (= ATR14/close×100) | | DB |
| Volume | `avg_volume_20`, `avg_volume_50`, `avg_dollar_volume_50`, `relative_volume_50`, `up_volume_50`, `down_volume_50`, `up_down_volume_ratio_50` | shares / USD / ratio | DB |
| Not stored (front end keeps calculating) | SMA 100, ATR 20/30, avg volume 10, weekly 10w/40w MAs, MA slopes, days-above counters, days-since-high, volume dry-up flags | | PLAN, low priority |

Formulas frozen by `TECHNICAL_DAILY_V1`; a formula change means a new `model_version` and a full rebuild (`--rebuild`), so clients must key caches by it.
Because the columns are `*_50`/`*_20`, the client uses server series only when the chart asks for exactly SMA 10/50/200, EMA 21, ATR 14 or avg-volume 20/50.

Indicators the front end has beyond this list (RSI, MACD, Bollinger, Stochastic, Ichimoku, Supertrend, VWAP…) **stay client-side**;
the server only replaces the ones in the catalogue. The client asks the server for `sma_*`, `ema_*`, `atr_*`, `vol_avg_*` only
when the requested period equals a stored period (10/21/50/100/200/14/20/30…); other periods are calculated locally.

Parity contract: the client keeps its Python-golden tests; backend series must match those fixtures to `1e-6` relative
(state the SMA/EMA seeding rule in `meta`; series are computed on split-adjusted closes, `meta.price_basis = "split_adjusted"`). See tasks 14.x.

### `GET /api/stocks/{symbol}/technicals/latest` — the newest row of everything (checkup technical block, screener drawer).

## 2. Relative strength

### `GET /api/stocks/{symbol}/rs-line?benchmark=&interval=1d&format=columnar`
`benchmark` is optional; the default is `GET /api/meta` → `benchmarks.default` (**currently `TSX`, the S&P/TSX Composite, an interim stand-in for the S&P 500 which Stooq's list does not provide** — owner decision 2026-09-29; it switches to `SPX` when that index is added, with no front-end change). The UI shows the benchmark name next to the pane and marks it "interim" when `benchmark_is_interim` is true.
`rs_line = close / benchmark_close` (scaled so the first point is 100, or as the backend defines — **state it in `meta.scale`**).
```json
{ "data": { "timestamp":[…], "rs_line":[…], "rs_line_new_high":[false,…] },
  "meta": { "benchmark": "TSX", "benchmark_is_interim": true, "scale": "first=100", "model_version": { "rs": "RS_LEGACY_V1" } } }
```
Tables: `relative_strength_history(security_id, trade_date, rs_line, rs_line_high_52w, rs_new_high bool, model_version)`.
Needs `index_prices` (see `02`).

## 3. Ratings

**Availability today:** RS ratings daily; **EPS and SMR only on the 19 stored dates (target: recompute daily, or at least whenever new earnings are ingested — the contract does not depend on which)** (2023-07-25 … 2026-09-15); Composite, Acc/Dis, Sponsorship, Group RS, Earnings Stability **not built**.
All values are **model estimates** (ρ ≈ 0.75 EPS, ≈ 0.80 SMR vs IBD), versioned, and may be `null` with a reason.

Object `Ratings` (every rating nullable):
```json
{
  "security_id": 4821,
  "effective_dates": { "rs": "2026-09-22", "eps": "2026-09-15", "smr": "2026-09-15", "composite": null },
  "rs_rating": 94, "rs_3m_rating": 91, "rs_6m_rating": 93, "rs_12m_rating": 95, "rs_exp_3m": 88,
  "eps_rating": 97, "eps_basis": "adjusted",
  "smr_rating": "A",
  "accdist_rating": null, "sponsorship_rating": null, "composite_rating": null,
  "group_rs_rating": null, "group_rank": null, "group_count": null, "rank_in_group": null, "group_size": null,
  "earnings_stability": null,
  "base_quality_score": null, "breakout_quality_score": null, "canslim_score": null,
  "unrated": { "eps": null, "smr": "stale_quarter", "composite": "not_available" },
  "model_version": { "rs_12m": "RS_12M_V1", "rs_3m": "RS_3M_V1", "rs_6m": "RS_6M_V1", "rs_exp_3m": "RS_ER3_V1", "eps": "EPS_V5_3", "smr": "SMR_V4" }
}
```
| Field | Scale | Table | Status |
|---|---|---|---|
| `rs_rating` (= 12M, canonical), `rs_3m_rating`, `rs_6m_rating`, `rs_exp_3m` | 1–99 | `rs_rating_history` | DB, daily (`rs_9m/12m` naming: only 3M/6M/12M/ER3 exist) |
| `eps_rating`, `eps_basis` (`adjusted`\|`gaap`) | 1–99 | `eps_rating_history` | DB, 19 dates |
| `smr_rating` | `A`–`E` (quintiles) | `smr_rating_history` | DB, 19 dates |
| `accdist_rating` | `A+ … E` | `accdist_rating_history` | PLAN |
| `sponsorship_rating` | `A`–`E` | `sponsorship_rating_history` | PLAN |
| `group_rs_rating`, `group_rank`, … | 1–99 / ints | `industry_rating_history` | PLAN |
| `earnings_stability` | 1–99 (**low = stable**) | `earnings_stability_history` | PLAN |
| `composite_rating` | 1–99 | `composite_rating_history` | PLAN |

`unrated` explains a null: `no_quarterly_data`, `stale_quarter` (latest quarter > 250 days), `not_eligible`, `too_new` (< 5 sessions), `no_cik`, `not_available` (rating not built yet). The UI shows "not rated" (with the reason in a tooltip) distinctly from "loading" and "dataset off".
Every `*_rating_history` row (backend design §27: `security_id, date, rating, raw_score, model_version, calculated_at`): API `effective_date` = `date`, and `raw_score` is exposed only on the explain endpoint; PK `(security_id, effective_date, model_version)`; index `(effective_date, value)` for percentile queries.

### `GET /api/stocks/{symbol}/ratings?as_of=`  → one `Ratings`. Each rating uses the latest row with `effective_date <= as_of`; `effective_dates` shows which date each came from (they differ while EPS/SMR are sparse).
### `GET /api/stocks/{symbol}/ratings/history?from=&to=&fields=rs_rating,eps_rating,smr_rating`
Columnar per field: `{ "rs_rating": { "date":[…], "value":[…] }, "eps_rating": { … } }` — **each field has its own dates** because EPS/SMR have only 19 points; the sparkline draws steps, not interpolated lines.
### `GET /api/stocks/{symbol}/ratings/explain?rating=eps_rating&as_of=`  (**PLAN**, backend design §33 "Why is EPS Rating 94?")
```json
{ "rating": "eps_rating", "value": 97, "raw_score": 0.93, "model_version": "EPS_V5_3", "effective_date": "2026-09-15",
  "inputs": [ { "key": "eps_yoy_pct_q0", "label": "Latest quarter EPS growth", "value": 48.2, "weight": 0.3, "basis": "adjusted" },
              { "key": "eps_yoy_pct_q1", "value": 41.0, "weight": 0.2 } ],
  "percentile": 97.2, "universe_size": 3010, "notes": ["turnaround score capped at 0.7"] }
```
Front end: "Why this rating?" popover (task 16.15). Generic shape: `inputs[]` of `{key,label,value,weight?,basis?}`.
### `GET /api/ratings/dates` → `{ "rs": ["2026-09-22", …], "eps": [ 19 dates ], "smr": [ 19 dates ] }` — lets the time machine and screener date picker offer only valid dates.
### `GET /api/ratings/distribution?field=rs_rating&as_of=`  — histogram for slider hints.
### `GET /api/ratings/leaders?field=rs_rating&limit=25&industry_key=&as_of=`  — top-N `{security_id, symbol, company_name, value}`.

## 4. Front-end use
Chart legend badges (RS, Composite), RS-line pane, stock header ratings strip, screener columns, watchlist columns, checkup.
Until the datasets exist `GET /api/meta.datasets` lacks `ratings` and none of these render.
