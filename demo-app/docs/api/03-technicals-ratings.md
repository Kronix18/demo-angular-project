# 03 — Technicals, RS line, ratings

Backing: `technical_daily`, `technical_weekly`, `relative_strength_history`, `volume_metrics` (**CODE** for the first, rest **PLAN**);
`*_rating_history` tables (**PLAN**). Front-end today: computes indicators client-side (`IndicatorCalculationService`).

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
  "meta": { "as_of": "2026-09-22", "calculated_at": "…", "model_version": { "technicals": "TECH_V1" } } }
```
Warm-up values are `null` (never `0`); arrays are the same length as the timestamp array.

**Series catalogue** (`technical_daily` columns; weekly table has `_w` set):

| Group | Series names | Unit |
|---|---|---|
| Moving averages | `sma_10`, `ema_21`, `sma_50`, `sma_100`, `sma_200`; weekly `sma_10w`, `sma_40w` | price |
| MA relations | `above_ema_21`, `above_sma_50`, `above_sma_200`, `ema_21_gt_sma_50`, `sma_50_gt_sma_200` (bool); `ema_21_slope`, `sma_50_slope`, `sma_200_slope` (% / bar) ; `days_above_sma_50`, `weeks_above_sma_10w` (int) | |
| Price location | `high_52w`, `low_52w`, `ath`, `atl` (price); `pct_from_high_52w`, `pct_from_low_52w`, `pct_from_ath` (`_pct`); `days_since_high_52w`, `days_since_ath` (int) | |
| Volatility | `atr_14`, `atr_20`, `atr_30`; `atr_14_pct`, `atr_20_pct`, `atr_30_pct` (= ATR/close×100) | |
| Volume | `vol_avg_10/20/50`, `vol_vs_avg_10/20/50` (ratio), `dollar_vol_avg_50`, `ud_volume_ratio`, `rel_volume`, `max_daily_vol_1y`, `max_weekly_vol_1y`, `volume_dry_up`, `volume_accumulation`, `volume_distribution` (bool) | |

Indicators the front end has beyond this list (RSI, MACD, Bollinger, Stochastic, Ichimoku, Supertrend, VWAP…) **stay client-side**;
the server only replaces the ones in the catalogue. The client asks the server for `sma_*`, `ema_*`, `atr_*`, `vol_avg_*` only
when the requested period equals a stored period (10/21/50/100/200/14/20/30…); other periods are calculated locally.

Parity contract: the client keeps its Python-golden tests; backend series must match those fixtures to `1e-6` relative
(SMA/EMA seeding rule: EMA seeded with the first SMA, `alpha = 2/(n+1)`) — see `03` tasks 14.x.

### `GET /api/stocks/{symbol}/technicals/latest` — the newest row of everything (checkup technical block, screener drawer).

## 2. Relative strength

### `GET /api/stocks/{symbol}/rs-line?benchmark=SPX&interval=1d&format=columnar`
`rs_line = close / benchmark_close` (scaled so the first point is 100, or as the backend defines — **state it in `meta.scale`**).
```json
{ "data": { "timestamp":[…], "rs_line":[…], "rs_line_new_high":[false,…] },
  "meta": { "benchmark": "SPX", "scale": "first=100", "model_version": { "rs": "RS_LEGACY_V1" } } }
```
Tables: `relative_strength_history(security_id, trade_date, rs_line, rs_line_high_52w, rs_new_high bool, model_version)`.
Needs `index_prices` (see `02`).

## 3. Ratings

Object `Ratings` (all nullable; each has the same `effective_date` semantic):
```json
{
  "security_id": 4821, "effective_date": "2026-09-22",
  "composite_rating": 98, "eps_rating": 97,
  "rs_rating": 94, "rs_3m_rating": 91, "rs_6m_rating": 93, "rs_9m_rating": 90, "rs_12m_rating": 95, "rs_exp_3m": 88,
  "smr_rating": "A", "accdist_rating": "B+", "sponsorship_rating": "A",
  "group_rs_rating": 96, "group_rank": 12, "group_count": 180, "rank_in_group": 2, "group_size": 31,
  "earnings_stability": 14,
  "base_quality_score": 88, "breakout_quality_score": 94, "canslim_score": 91
}
```
| Field | Scale | Table | Plan § |
|---|---|---|---|
| `composite_rating` | 1–99 | `composite_rating_history` | 18 |
| `eps_rating` | 1–99 | `eps_rating_history` | 12 |
| `rs_rating`, `rs_3m/6m/9m/12m_rating`, `rs_exp_3m` | 1–99 | `rs_rating_history` | 11 |
| `smr_rating` | `A`–`E` | `smr_rating_history` | 14 |
| `accdist_rating` | `A+ A A- B+ B B- C+ C C- D+ D D- E` | `accdist_rating_history` | 15 |
| `sponsorship_rating` | `A`–`E` | `sponsorship_rating_history` | 17 |
| `group_rs_rating`, `group_rank`, `group_count`, `rank_in_group`, `group_size` | 1–99 / ints | `industry_rating_history` | 16 |
| `earnings_stability` | 1–99 (**low = stable**, per plan example "14"; document this in UI) | `earnings_stability_history` | 13 |

Every `*_rating_history` row: `(security_id, effective_date, value, model_version, calculated_at)`, PK `(security_id, effective_date, model_version)`.
Indexes: `(effective_date, value)` for screener percentile queries.

### `GET /api/stocks/{symbol}/ratings?as_of=`  → one `Ratings` (+ `meta.model_version`).
### `GET /api/stocks/{symbol}/ratings/history?from=&to=&fields=composite_rating,eps_rating,rs_rating&interval=1w`
Columnar `{ effective_date:[…], composite_rating:[…], … }`. Used for the ratings sparkline and for the chart's RS-rating pane.
### `GET /api/ratings/distribution?field=rs_rating&as_of=`  — histogram (99 buckets) for the screener slider hint.
### `GET /api/ratings/leaders?field=composite_rating&limit=25&industry_key=&as_of=`  — top-N list of `{security_id, symbol, company_name, value}`.

## 4. Front-end use
Chart legend badges (RS, Composite), RS-line pane, stock header ratings strip, screener columns, watchlist columns, checkup.
Until the datasets exist `GET /api/meta.datasets` lacks `ratings` and none of these render.
