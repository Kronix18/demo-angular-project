> **v2 contract (2026-09-29):** the full, current contract the backend has to implement — tables, fields, formats, tiers — is in
> [`docs/api/README.md`](docs/api/README.md) (files `00`–`10`); the plan behind it is [`docs/DATA-PLAN.md`](docs/DATA-PLAN.md).
> This file is the **v1** chart/auth spec; v2 extends it additively and never breaks it.

# API Backend Specification for Charting Features

## Purpose
This document specifies the backend API endpoints required to support the Angular charting features. The backend implementation should be handled in a separate session, focusing only on providing the necessary data endpoints.

**This spec is the single source of truth for the data contract.** Where the current
frontend code disagrees with it (e.g. the timestamp bug noted below), the code is wrong
and this spec wins.

## Current demo data source
Until the backend exists, the demo runs on **Stooq daily test files** (`.us.txt`).
Task 2.1 copies them from the (read-only, out-of-repo) test-data directory into
`demo-app/public/test-data/`, where the dev server serves them as static files and
`ChartDataService` parses them client-side. The endpoints below are the contract the
future backend must fulfill to replace that client-side fetch.

**Available symbols — exactly these 8 (NO AAPL, no GOOGL, nothing else):**

| Symbol | File | First bar | Last bar |
|---|---|---|---|
| IA | `ia.us.txt` | 2005-02-25 | 2026-09-22 |
| MSFT | `msft.us.txt` | 1986-03-13 | 2026-09-22 |
| MU | `mu.us.txt` | 1989-05-16 | 2026-09-22 |
| NVDA | `nvda.us.txt` | 1999-01-22 | 2026-09-22 |
| PLTR | `pltr.us.txt` | 2020-09-30 | 2026-09-22 |
| QQEW | `qqew.us.txt` | 2006-04-25 | 2026-09-22 |
| QQQ | `qqq.us.txt` | 1999-03-10 | 2026-09-22 |
| QQQE | `qqqe.us.txt` | 2012-03-26 | 2026-09-22 |

MSFT carries ~40 years of daily bars (from 1986) — see the performance notes in task 6.4.

**File format (Stooq daily):** a header line
`<TICKER>,<PER>,<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<VOL>,<OPENINT>`
followed by CSV rows such as
`MSFT.US,D,19860313,000000,0.0615709,0.069028,0.0615709,0.069028,1496329307.4141,0`.
Rows are **daily only** (`PER=D`, `TIME` always `000000`); dates are `YYYYMMDD`;
line endings are **CRLF** (parsers must not leave `\r` in the last field).

## Core Principles
1. **Data-Only Backend**: The backend should focus on providing raw financial data
2. **Client-Side Calculations**: Technical indicators, chart rendering, and interactions should happen in the Angular frontend
3. **Stateless Endpoints**: All endpoints should be stateless and cacheable where appropriate
4. **Consistent with Existing API**: Should follow the same patterns as existing endpoints in the application

## Timestamp contract
- **All timestamps are Unix epoch MILLISECONDS (UTC)** — in responses (`timestamp`
  field), in request params (`from`/`to`), and in metadata. No other unit, no strings.
- The Stooq source dates (`YYYYMMDD`, time `000000`) convert via `Date.UTC(y, m-1, d)`.
- **Known frontend bug (fixed in task 2.1):** the current parser emits `YYYYMMDDHHMMSS`
  integers (e.g. `20240115000000`), which are NOT epoch milliseconds. This spec — epoch
  ms — is the contract; the frontend is fixed to match it, not the other way round.

## Symbol normalization
- Symbols are **uppercase** in API paths: `/api/chart/ohlcv/MSFT` (not `MSFT.US`).
- The Stooq `.US` exchange suffix is **stripped in URLs** and **re-added by the backend**
  when resolving the underlying `msft.us.txt` file.
- Demo-phase client equivalent (task 2.1): `MSFT`, `msft`, and `msft.us` all normalize
  to the same URL `test-data/msft.us.txt`
  (`test-data/${symbol.toLowerCase().replace(/\.us$/,'')}.us.txt`).
- Unknown/normalized-away symbols yield `404` per the error contract below.

## Interval model (v1 = TIME family only)
Derived from the Python reference `services/intervals.py` (see `docs/PORT-INVENTORY.md` §3).
The API serves only **calendar-based TIME intervals** for v1:

| Code | Family | Demo availability | Semantics |
|---|---|---|---|
| `1d` | TIME | **demo-available** | daily passthrough (no aggregation) |
| `1w` | TIME | **demo-available** | weekly resample anchored **W-FRI** (open=first, high=max, low=min, close=last, volume=sum) |
| `1M` | TIME | backend aggregation (optional in v1) | 1-month calendar buckets |
| `3M` | TIME | backend aggregation (optional in v1) | 3-month (quarterly) buckets |
| `6M` | TIME | backend aggregation (optional in v1) | 6-month (half-year) buckets |
| `12M` | TIME | backend aggregation (optional in v1) | 12-month (yearly) buckets |
| `1m`, `5m`, `1h` | TIME | **backend-only — NOT demoable** | intraday; the demo data contains only `PER=D` rows, so these cannot be served until the backend has intraday data |

Month-bucket rule (from `stock_service._to_month_bars`): bucket index =
`floor((year*12 + month - 1) / months)`; each bucket takes `date=last`,
`open=first`, `high=max`, `low=min`, `close=last`, `volume=sum`. Only
`months ∈ {1, 3, 6, 12}` is accepted. In the demo phase, `1w` and month buckets may be
computed client-side from daily bars; the backend may take over that aggregation later.

**Non-goal — range bars:** the RANGE family (`1R`, `10R`, `100R`, `1000R`) is NOT part
of this contract. The Python reference raises
`NotImplementedError("Range bars are not yet implemented.")` for it, so the API must
not promise these intervals; requesting one is a `400`.

## Required Endpoints

### 1. OHLCV Data Endpoint
```
GET /api/chart/ohlcv/{symbol}
Symbol: uppercase, .US suffix stripped (e.g. MSFT, not MSFT.US)
Query Parameters:
  - interval: string (1d, 1w, 1M, 3M, 6M, 12M) - default: 1d
  - limit: number (default: 100, max: 1000)
  - from: timestamp (Unix epoch ms, optional)
  - to: timestamp (Unix epoch ms, optional)

Response:
  [
    {
      "timestamp": number (Unix epoch milliseconds),
      "open": number,
      "high": number,
      "low": number,
      "close": number,
      "volume": number
    }
  ]
```
Field names are **exactly** those of `src/app/core/models/ohlcv.model.ts`:
`timestamp`, `open`, `high`, `low`, `close`, `volume` — in that shape, no extras, no
renames.

### 2. Symbol Search/Autocomplete Endpoint
```
GET /api/chart/symbols/search
Query Parameters:
  - q: string (search query)
  - limit: number (default: 10)

Response:
  [
    {
      "symbol": string,
      "name": string,
      "exchange": string,
      "type": string (stock, etf, crypto, etc.)
    }
  ]
```
Until the backend exists, results should only contain symbols the data source can
actually serve (demo phase: the 8 symbols listed above — the demo has no AAPL).

### 3. Available Intervals Endpoint
```
GET /api/chart/intervals
Response:
  [
    { "value": "1d", "label": "1 Day" },
    { "value": "1w", "label": "1 Week" },
    { "value": "1M", "label": "1 Month" },
    { "value": "3M", "label": "3 Months" },
    { "value": "6M", "label": "6 Months" },
    { "value": "12M", "label": "1 Year" }
  ]
```
Intraday values (`1m`, `5m`, `1h`) are returned only once the backend actually has
intraday data; the demo data cannot serve them.

### 4. Chart Data Metadata Endpoint
```
GET /api/chart/metadata/{symbol}
Response:
  {
    "symbol": string,
    "name": string,
    "exchange": string,
    "currency": string,
    "dataAvailableFrom": timestamp (Unix milliseconds),
    "dataAvailableTo": timestamp (Unix milliseconds),
    "supportedIntervals": ["1d", "1w", "1M", "3M", "6M", "12M"]
  }
```
`dataAvailableFrom` reflects real history depth — e.g. MSFT daily data starts
1986-03-13.

### 5. Multiple Symbols Data Endpoint (for watchlists)
```
POST /api/chart/ohlcv/batch
Request Body:
  {
    "symbols": ["MSFT", "NVDA", "QQQ"],
    "interval": "1d",
    "limit": 50
  }

Response:
  {
    "MSFT": [OHLCV array],
    "NVDA": [OHLCV array],
    "QQQ": [OHLCV array]
  }
```
Symbols must exist in the data source (demo list above); unknown symbols return an
empty array (see error contract) rather than failing the whole batch.

## Range presets (client-side concern — NOT an API feature)
The range buttons of task 4.3 — **1M / 3M / 6M / YTD / 1Y / ALL** — are computed
**client-side**; the API has no `range` or `preset` parameter. The client translates
a preset into a `from`/`to` timestamp window (or an index slice of the loaded array)
and calls the timestamp-windowed OHLCV endpoint.

Preset semantics (ported from the Python `chart/range_presets.py`; see
`docs/PORT-INVENTORY.md` §3.4):
- The reference point is the **last AVAILABLE BAR's date, not today's date** (test data
  may lag the current date).
- `1M`/`3M`/`6M` → last bar's date − N months; `1Y` → last bar's date − 1 year;
  `YTD` → Jan 1 of the last bar's year; `ALL` → first bar (index 0).
- Clamp the computed start to the available history.
(The Python preset enum is `3M/6M/YTD/1Y/2Y/5Y/ALL`; the Angular button set trades
`2Y`/`5Y` for `1M`. The anchor rule ports verbatim.)

## Error contract
| Case | Status | Body |
|---|---|---|
| Unknown symbol (not in data source) | `404` | JSON error shape below |
| Bad interval (not in the v1 TIME family, incl. range bars) | `400` | JSON error shape below |
| Malformed params (non-numeric limit/from/to) | `400` | JSON error shape below |

```
{
  "error": string,        // stable machine code, e.g. "symbol_not_found", "bad_interval"
  "message": string,      // human-readable, safe to show in the 6.3 error state
  "details": object      // optional, e.g. { "supportedIntervals": ["1d", "1w", ...] }
}
```

**Demo-data phase equivalent:** there is no backend yet, so no real HTTP errors occur.
The client treats a **failed fetch or an empty OHLCV array as the 404 equivalent** —
task 6.3's error/empty states key off that empty array. (Per the data-format rules
below: no data is always an empty array, never `null`.)

## Data Format Notes
- All timestamps are Unix epoch milliseconds (UTC) — see the timestamp contract
- Numbers are JSON numbers, not strings
- Empty arrays are returned for no data, not `null`
- Error responses follow the error contract above
- CORS headers should allow requests from the Angular frontend
- Rate limiting may be applied per IP/API key

## Implementation Guidelines
1. Reuse existing data fetching layers where possible
2. Implement proper caching for frequently requested symbols
3. Consider implementing WebSocket endpoints for real-time updates (future enhancement)
4. Ensure proper error handling per the error contract (invalid symbols, bad intervals, date ranges)
5. Prefer `from`/`to` windowing over `limit` for large history requests (MSFT daily spans ~40 years / ~10k bars)
