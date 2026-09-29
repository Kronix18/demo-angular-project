# 02 — Prices

Backing: `stock_history` (**DB**), `splits`, `dividends`, `corporate_actions` (**DB**), `weekly_prices`, `index_prices` (**PLAN**).
This extends the v1 OHLCV contract in `../../API-BACKEND-SPEC.md` (`/api/chart/...`); v1 bars are kept as they are.

## Tables as they are today (from `PRICE_DATA.md`)

`stock_history(security_id, date, open, high, low, close, volume)` — PK `(security_id, date)`, `date >= 1997-01-02`, prices `VARCHAR(20)`
(**the API casts to numbers**), `volume NUMERIC`; provider prices as ingested. `splits(security_id, ex_date, factor)` (4.0 = 4:1 forward, 0.5 = 1:2 reverse),
`dividends(security_id, ex_date, amount, currency)`, `corporate_actions` (generic log). `stock_history_intraday` exists (5 / 60 min) but has no US stocks.

Still needed (**PLAN**): `weekly_prices` (derived from daily, so the client never aggregates when it exists) and `market_calendar` (sessions/holidays; lets the front end draw gaps correctly). **`index_prices(index_code, trade_date, open, high, low, close, volume)`** is expected to exist (Stooq): codes `SPX` (S&P 500, RS-line benchmark), `NDQ` (Nasdaq Composite, the market-engine index) and `NDX` (Nasdaq 100), and optional `NYA`, `RUT`, `DJI`; validated like stocks (calendar, duplicates, absurd returns). Volume for cash indices may be null.

**Adjustment policy (owner decision, supersedes the earlier raw/adjusted toggle):** every price the API returns is **split-adjusted** (whether adjusted at ingestion by the vendor or on demand by `adjust_for_splits`). Total-return (dividend) adjustment is **never served** — pattern geometry needs split-only. There is no raw mode. **Volume basis** is declared in `meta.volume_basis`: `as_reported` (Stooq, not divided by splits) or `split_adjusted` (vendors such as Yahoo); the chart labels it and the optional `adjust_volume=true` only applies when the basis is `as_reported`.

## `GET /api/chart/{symbol}/ohlcv`   (v1 path kept; v2 params)

| Param | Values | Default |
|---|---|---|
| `interval` | `1d`, `1w`, `1mo` (`1m…4h` = intraday, **not planned**, return `400 bad_interval`) | `1d` |
| `from`, `to` | epoch-ms **or** `YYYY-MM-DD` | full history |
| `adjust` | only `split` is accepted (default); `none` and `all` → `400 bad_request` | `split` |
| `adjust_volume` | `true` divides volume by the split factor (only for volume-dry-up analysis) | `false` |
| `limit` | max bars (newest first cut) | tier depth |
| `format` | `json`, `columnar` | `json` |
| `as_of` | `YYYY-MM-DD` — bars not later than that | latest |

v1 array item (unchanged):
```json
{ "timestamp": 1758499200000, "open": 425.1, "high": 429.3, "low": 424.2, "close": 427.31, "volume": 21500000 }
```
Optional extra `include=split_factor` (cumulative factor, 1 = none) only for tooltips such as "prices adjusted for 3 splits". Volume follows `meta.volume_basis`.

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
  "intervals": ["1d","1w","1mo"], "price_basis": "split_adjusted", "volume_basis": "as_reported", "split_count": 3, "source": "yahoo",
  "price_scale": 2, "currency": "USD", "delisted": false,
  "datasets": { "technicals": true, "rs_line": false, "patterns": false, "fundamental_markers": false } }
```
This single call replaces probing in the chart page: it says which server datasets the chart may request.

### `GET /api/indices/{code}/ohlcv`  (**expected DB**, endpoint PLAN) — same shape as stock OHLCV; used by RS line, compare-to-index, market view.

### `GET /api/quotes?symbols=MSFT,AAPL`  — latest EOD quote for up to 100 symbols (`close, change, change_pct, volume, as_of`).
The app is end-of-day; `meta.delayed = "eod"` is always set so the UI can label it.

## Front-end interceptor behaviour (informational)
`ohlcvSourceInterceptor`: request → try backend → on `404`/`503`/`network`/missing capability → static `*.us.txt` fallback
(current path). Response mapped by `mapOhlcv()` to the internal `Bar`; both paths produce identical arrays so the chart
cannot tell them apart. See `10-capabilities-and-fallbacks.md`.

## Tier truncation (see `09`)
Depth follows `historicalDataYears` per tier: free 1, plus 3, pro 10, ultimate 20, admin unlimited (values in `09-user-tiers.md`). Truncated responses carry `meta.limits.history_years` and `truncated:true`.

## Index catalogue (Stooq, supplied by the owner 2026-09-29)

API code = Stooq ticker without the `^` (`^NDQ` → `NDQ`). `GET /api/indices` returns this catalogue (`{code, stooq_ticker, name, region, country, currency, has_volume, first_bar, last_bar}`; region/country/currency below are my mapping, the backend should own it in an `index_master` table); `GET /api/indices/{code}/ohlcv` serves bars like stocks.

| Region | Codes (name) |
|---|---|
| North America | `NDQ` Nasdaq Composite (US, USD) · `NDX` Nasdaq 100 (US) · `TSX` S&P/TSX Composite (CA, CAD) · `IPC` IPC (MX, MXN) |
| South America | `BVP` Bovespa (BR, BRL) · `IPSA` (CL, CLP) · `MRV` Merval (AR, ARS) |
| Europe — Western | `AEX` (NL) · `BEL20` (BE) · `CAC` CAC 40 (FR) · `DAX`, `MDAX`, `SDXP` (SDAX), `TDXP` (TecDAX), `CDAX` (DE) · `FMIB` FTSE MIB (IT) · `FTM` FTSE 250 (GB, GBP) · `IBEX` IBEX 35 (ES) · `PSI20` (PT) · `SMI` (CH, CHF) · `ATH` Athex Composite (GR) |
| Europe — Nordic/Baltic | `OMXC25` (DK, DKK) · `OMXS` (SE, SEK) · `HEX` (FI) · `OSEAX` (NO, NOK) · `ICEX` (IS, ISK) · `OMXR` Riga · `OMXT` Tallinn · `OMXV` Vilnius · `NOMUC` (Nasdaq Nordic composite — to confirm) |
| Europe — Central/East | `PX` (CZ, CZK) · `BUX` (HU, HUF) · `BET` (RO, RON) · `SAX` (SK) · `SOFIX` (BG, BGN) · `MT30` (MT) · `MOEX`, `MOEX10`, `MCFTR` (MOEX TR), `RTS`, `RTSTR` (RU, RUB) · `XU100` (TR, TRY) |
| Asia-Pacific | `AOR` All Ordinaries (AU, AUD) · `HSI` Hang Seng (HK, HKD) · `NKX` Nikkei 225 (JP, JPY) · `KOSPI` (KR, KRW) · `TWSE` TAIEX (TW, TWD) · `SHC` SSE Composite, `SHBS` SSE B-Share (CN) · `SNX` Sensex (IN, INR) · `STI` Straits Times (SG, SGD) · `KLCI` (MY, MYR) · `SET` (TH, THB) · `JCI` (ID, IDR) · `PSEI` (PH, PHP) · `NZ50` (NZ, NZD) |
| Middle East / Africa | `TASI` (SA, SAR) · `TOP40` JSE Top 40 (ZA, ZAR) |
| Commodities | `CRY` CRB Index (global, USD) |

**Gaps that matter for the product:** the list has no `SPX` (S&P 500), `DJI`, `RUT`, `NYA`. Required additions: **`SPX`** (RS-line benchmark and market engine). Nice to have: `DJI`, `RUT`, `NYA`, plus `VIX`. Until `SPX` exists, `SPY.US` (Stooq ETF, in the stock table) is the documented proxy and `meta.benchmark_proxy = "SPY"` is returned. Non-US indices are for the compare overlay and a world-markets page; they are **not** inputs to any rating or to the market state (which uses `SPX` + `NDQ`). Index volume may be null or non-comparable (do not compute distribution days from indices lacking volume; the market engine needs `NDQ` and `SPX`/`SPY` volume — confirm availability). Currencies differ: compare overlays normalise to % change from the common start date (`mode=percent`), never plot raw levels of different indices on one axis.
