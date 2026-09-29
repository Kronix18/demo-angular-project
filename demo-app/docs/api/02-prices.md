# 02 — Prices

Backing: `stock_history` (**DB**), `splits`, `dividends`, `corporate_actions` (**DB**), `weekly_prices`, `index_prices` (**PLAN**).
This extends the v1 OHLCV contract in `../../API-BACKEND-SPEC.md` (`/api/chart/...`); v1 bars are kept as they are.

## Tables as they are today (from `PRICE_DATA.md`)

`stock_history(security_id, date, open, high, low, close, volume)` — PK `(security_id, date)`, `date >= 1997-01-02`, prices `VARCHAR(20)`
(**the API casts to numbers**), `volume NUMERIC`; provider prices as ingested. `splits(security_id, ex_date, factor)` (4.0 = 4:1 forward, 0.5 = 1:2 reverse),
`dividends(security_id, ex_date, amount, currency)`, `corporate_actions` (generic log). `stock_history_intraday` exists (5 / 60 min) but has no US stocks.

Still needed (**PLAN**): `weekly_prices` (derived from daily, so the client never aggregates when it exists) and `index_prices(index_code, trade_date, open, high, low, close, volume)` for `SPX`, `NDX`, `COMP`, `RUT`, `DJI` (or ETF proxies `SPY`, `QQQ`, `IWM`).

**Adjustment policy (frozen by the backend):** split-only back-adjustment derived on demand (`adjust_for_splits`, each bar before an ex-date divided by the product of later forward-split factors);
total-return (dividend) adjustment is **rejected** for chart/pattern use; raw stored rows are never mutated; **volume is returned as stored** unless `adjust_volume=true`.

## `GET /api/chart/{symbol}/ohlcv`   (v1 path kept; v2 params)

| Param | Values | Default |
|---|---|---|
| `interval` | `1d`, `1w`, `1mo` (`1m…4h` = intraday, **not planned**, return `400 bad_interval`) | `1d` |
| `from`, `to` | epoch-ms **or** `YYYY-MM-DD` | full history |
| `adjust` | `none`, `split` (`all`/total-return → `400 bad_request`, not offered) | `split` |
| `adjust_volume` | `true` divides volume by the split factor (only for volume-dry-up analysis) | `false` |
| `limit` | max bars (newest first cut) | tier depth |
| `format` | `json`, `columnar` | `json` |
| `as_of` | `YYYY-MM-DD` — bars not later than that | latest |

v1 array item (unchanged):
```json
{ "timestamp": 1758499200000, "open": 425.1, "high": 429.3, "low": 424.2, "close": 427.31, "volume": 21500000 }
```
v2 optional extras (`include=raw_close,split_factor`): `raw_close`, `split_factor` (cumulative, 1 = none) — lets the front end toggle adjusted/unadjusted
without a second request. `adjust=split` returns prices already adjusted; **volume is untouched** (frozen policy).

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
  "intervals": ["1d","1w","1mo"], "adjusted": { "split": true }, "split_count": 3,
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
