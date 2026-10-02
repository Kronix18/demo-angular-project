# Integration papers — three projects, one product

| Project | Owns | Paper |
|---|---|---|
| **Front end** (this repo, Angular) | UI, chart, screener, client-side indicators, fallbacks | `../DATA-PLAN.md`, `../api/`, `TASKS/` |
| **Backend** (Flask API) | HTTP API, auth, tiers, caching, screener queries, user data (`application.*`) | [`BACKEND.md`](BACKEND.md) |
| **Data fetcher / pipelines** (Python, PostgreSQL) | ingestion, normalisation, calculations, ratings, patterns, market engine, the database content | [`DATA-FETCHER.md`](DATA-FETCHER.md) |

## 1. Data flow

```
 vendors ──► DATA FETCHER ──► PostgreSQL ──► BACKEND (Flask) ──► FRONT END (Angular)
 Stooq, SEC, Yahoo,   writes market data,    reads market data      draws, filters,
 BusinessQuant,       ratings, snapshots,    (read-only role),      explains, gates
 AlphaVantage, news   dataset_status         owns application.*     by entitlements
```

Rules that keep the three projects independent (from the backend design: *ingestion must not know the UI, calculations must not know the API, the front end never calculates authoritative ratings*):
1. **The database is the interface between fetcher and backend.** The fetcher writes; the backend has a **read-only** role on market-data schemas and read/write only on `application.*`.
2. **The HTTP contract (`docs/api/`) is the interface between backend and front end.** Later replaced by the backend's OpenAPI file.
3. **`dataset_status` is the handshake.** The fetcher records, per dataset, `data_as_of`, `calculated_at`, `model_version`, `status`; the backend turns it into `GET /api/meta`; the front end turns that into "what is switched on". (Spec in `DATA-FETCHER.md` §3.)
4. **Everything served is split-adjusted; the vendor never leaks through the shapes** (`source` is metadata).
5. **Point-in-time everywhere:** `effective_date` / `disclosed_at` / `available_at` columns are mandatory so `as_of` works without special code.
6. **Additive changes only** on any interface; breaking change = new version. Change process: PR to `docs/api` (front end + backend review) → `docs/api/CHANGELOG.md`.

## 2. Milestones (cross-project)

| M | Outcome visible to a user | Fetcher delivers | Backend delivers | Front end (tasks) |
|---|---|---|---|---|
| M0 | Nothing changes; mock-driven foundation | – | – | 12.x, 23.1–23.3 |
| M1 | Search, symbol header, capability discovery, industry counts | `dataset_status`, `index_master` | B1: `/meta`, `/chart/{s}/meta`, `/stocks/search`, `/stocks/{s}`, `/universe/facets`, OpenAPI v0 | 12.8–12.12, 15.13, 16.9, 19.1 |
| M2 | Charts from the API, split-adjusted, compare + world indices | split-adjusted `stock_history`, `weekly_prices`, `index_prices` (60 Stooq indices), `market_calendar`, splits/dividends approved | B2: OHLCV, batch, quotes, indices, corporate actions | 13.x, 19.10 |
| M3 | Server indicators, RS line | `technical_daily` (+ weekly), `relative_strength_history` (vs TSX) | B3: `/technicals`, `/rs-line` | 14.x |
| M4 | Screener v2 (classification + technical + RS/EPS/quality) | `screener_snapshot` nightly | B5: fields, run, count, presets, export | 15.x |
| M5 | Ratings and checkup | rating tables daily + `ratings/dates`, explain payloads | `/ratings*`, `/ratings/explain` | 16.x |
| M6 | Fundamentals, filings, earnings markers | resolver outputs served views, `sec_filing.items` | `/filings`, `/fundamentals/*`, `/markers` | 17.x |
| M7 | Accounts, tiers, sync | – | auth, entitlements, plans, billing, `application.*` | 20.x, 21.x, 9.1 |
| M8 | Industries + market state | industry ranks, market engine tables | `/industries*`, `/market/*` | 19.1–19.9 |
| M9 | Patterns, trade levels, growth score | base engine, CAN SLIM tables | `/patterns*`, `/trade-levels`, `/canslim` | 18.x |
| M10 | News + institutional | news ingestion/classifier, 13F | `/news*`, `/events*`, `/institutional*` | 22.x |
| M11 | Time machine, backtest | PIT snapshots | `as_of` everywhere, `/backtests` | 22.5–22.8 |

Front-end tasks are always done first against fixtures (12.2), so a milestone is "done" when (a) fetcher tables exist, (b) backend endpoints pass the contract tests (23.2), (c) front-end tasks pass their browser verification against the real backend (23.7).

## 3. Hand-off artefacts each project owes the others

| From → To | Artefact |
|---|---|
| Front end → Backend | `docs/api/*`, fixtures (`docs/api/fixtures/`, task 12.2), contract-test runner (23.2), the prioritised endpoint list (this file §2) |
| Backend → Front end | OpenAPI file (from Pydantic), staging URL, sample tokens per tier, `/api/meta` |
| Backend → Fetcher | list of columns/views the API reads (`BACKEND.md` §4), performance needs (indexes), retention needs |
| Fetcher → Backend | DDL of every table/view the API reads, `dataset_status` rows, data dictionary (units, nullability, PIT columns), a data sample for fixtures |
| Fetcher → Front end | via backend only |

## 4. Environments
`local` (mock server, fixtures) · `staging` (real DB snapshot, backend on staging, front end pointed via `<meta name="api-url">`) · `production`. The front end never contains vendor keys or DB access.

## 5. Open decisions carried across all three
See `../DATA-PLAN.md` §9 and each paper's "Open questions" section.
