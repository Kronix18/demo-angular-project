# 02 — Prices

Backing: daily bars (**DB, shape UNKNOWN**), planned `daily_prices`, `weekly_prices`, `index_prices`, `splits`, `dividends` (**PLAN**).
This extends the v1 OHLCV contract in `../../API-BACKEND-SPEC.md` (`/api/chart/...`); v1 bars are kept as they are.

## Table shapes the backend must provide

`daily_prices` — one row per `(security_id, trade_date)`, PK on that pair (+ index `(trade_date)` for cross-sectional jobs).

| Column | Type | Notes |
|---|---|---|
| `security_id` | int FK | |
| `trade_date` | date | exchange session date |
| `open, high, low, close` | numeric(18,6) | **raw** (as traded) |
| `volume` | bigint | shares |
| `adj_factor` | numeric(20,10) | cumulative split factor (1.0 = none); price×factor = split-adjusted |
| `adj_close` | numeric(18,6) null | total-return adjusted (dividends), null until `dividends` exist |
| `dollar_volume` | numeric(22,2) | close×volume, needed by the eligibility gate |
| `source`, `updated_at` | text, timestamptz | provenance |

`weekly_prices` — same columns, `week_start` (Monday) instead of `trade_date`; derived from daily (**do not** let the client
aggregate when it exists). `index_prices` — `(index_code, trade_date, open, high, low, close, volume)` for `SPX`, `NDX`, `COMP`,
`RUT`, `DJI` (+ ETF proxies `SPY`, `QQQ`, `IWM`). `splits(security_id, effective_date, ratio_from, ratio_to)`,
`dividends(security_id, ex_date, pay_date, amount, currency)`.

## `GET /api/chart/{symbol}/ohlcv`   (v1 path kept; v2 params)

| Param | Values | Default |
|---|---|---|
| `interval` | `1d`, `1w`, `1mo` (`1m…4h` = intraday, **not planned**, return `400 bad_interval`) | `1d` |
| `from`, `to` | epoch-ms **or** `YYYY-MM-DD` | full history |
| `adjust` | `none`, `split`, `all` (split+dividend) | `split` |
| `limit` | max bars (newest first cut) | tier depth |
| `format` | `json`, `columnar` | `json` |
| `as_of` | `YYYY-MM-DD` — bars not later than that | latest |

v1 array item (unchanged):
```json
{ "timestamp": 1758499200000, "open": 425.1, "high": 429.3, "low": 424.2, "close": 427.31, "volume": 21500000 }
```
v2 optional extras (`include=raw_close,adj_factor`): `raw_close`, `adj_factor` — lets the front end toggle adjusted/unadjusted
without a second request. `adjust=split` returns prices already multiplied by `adj_factor`; volume divided by it.

Headers: `X-Data-As-Of`, `ETag`. Empty history → `200 []` (not 404) when the symbol exists.

### `GET /api/chart/{symbol}/ohlcv/latest` — single newest bar (+ previous close), for watchlist / header refresh.

### `POST /api/chart/ohlcv/batch`  — compare overlay, watchlist sparklines, screener rows
```json
{ "symbols": ["MSFT","AAPL"], "interval": "1d", "from": "2025-09-22", "fields": ["timestamp","close"], "format": "columnar" }
→ { "data": { "MSFT": { "timestamp":[…], "close":[…] }, "AAPL": { … } }, "meta": { … } }
```
Max 25 symbols per call; free tier 5, plus 10.

### `GET /api/chart/{symbol}/meta`  (the v1 metadata endpoint, extended)
```json
{ "security_id": 4821, "first_bar": "1986-03-13", "last_bar": "2026-09-22", "bar_count": 10200,
  "intervals": ["1d","1w","1mo"], "adjusted": { "split": true, "dividend": false },
  "price_scale": 2, "currency": "USD", "delisted": false,
  "datasets": { "technicals": true, "rs_line": false, "patterns": false, "fundamental_markers": false } }
```
This single call replaces probing in the chart page: it says which server datasets the chart may request.

### `GET /api/indices/{code}/ohlcv`  (**PLAN**) — same shape as stock OHLCV; used by RS line, compare-to-index, market view.

### `GET /api/quotes?symbols=MSFT,AAPL`  — latest EOD quote for up to 100 symbols (`close, change, change_pct, volume, as_of`).
The app is end-of-day; `meta.delayed = "eod"` is always set so the UI can label it.

## Front-end interceptor behaviour (informational)
`ohlcvSourceInterceptor`: request → try backend → on `404`/`503`/`network`/missing capability → static `*.us.txt` fallback
(current path). Response mapped by `mapOhlcv()` to the internal `Bar`; both paths produce identical arrays so the chart
cannot tell them apart. See `10-capabilities-and-fallbacks.md`.

## Tier truncation (see `09`)
Depth follows `historicalDataYears` per tier: free 1, plus 3, pro 10, ultimate 20, admin unlimited (values in `09-user-tiers.md`). Truncated responses carry `meta.limits.history_years` and `truncated:true`.
