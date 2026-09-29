# Data plan — using the backend security master and the CAN SLIM roadmap in the front end

Date: 2026-09-29. Scope: **front end only**. The backend / data-fetcher are separate projects and are not programmed here.
Inputs: `SECURITY_MASTER.md`, `PRICE_DATA.md`, `DAILY_INGESTION_GUIDE.md`, `EPS_STATUS.md`, `EPS_COVERAGE_TRACKING.md`, `SMR_STATUS.md` (what the DB holds; the last five arrived in a second batch and changed the picture, revision 2026-09-29) and `IMPLEMENTATION_PLAN.md` (roadmap, §1–§59; its checkboxes are stale).
Outputs: this plan, the API contract for the backend (`docs/api/`), and small tasks (`TASKS/phase-12` … `phase-22`, 119 tasks).

## 1. Audit — what is implemented, what is not, what is planned

Full tables with column names: [`api/00-data-status.md`](api/00-data-status.md). Summary:

| State | Items |
|---|---|
| **In the DB now** | Security master (13 317 securities, stable `security_id`); classification; V2 enrichment (IPO/delisting dates, shares, float, market cap USD, ADR/SPAC/ETF flags); universe gating (5 342 → 3 508); `sec_filing` index (197 970); **daily prices `stock_history` since 1997 (raw Stooq strings, incremental manual import)**; **`splits`, `dividends`, `corporate_actions`**; **`technical_daily` (persisted, ~28 M rows, 23 columns, `TECHNICAL_DAILY_V1`)**; **RS ratings 3M/6M/12M/ER3 (daily)**; **EPS rating `EPS_V5_3` and SMR rating `SMR_V4` on 19 stored dates**; yfinance quarterly financials for foreign issuers |
| **Tables exist but empty** | `security_symbol_history`, `security_name_history` |
| **Not built** | weekly and index prices (so no RS *line* and no market engine yet), Composite, Acc/Dis, Sponsorship, Group RS, Earnings Stability, general fundamentals endpoint tables, CAN SLIM, patterns / trade engine, market state, 13F, news, backtester, application schema; EPS/SMR are not in any daily cron |

Consequences after the second batch:
- **Much more can be consumed today than first thought:** prices (raw + split-adjusted on demand), splits/dividends markers, server technicals (only the 23 stored columns), daily RS ratings, EPS and SMR ratings (19 dates), filings, classification. The order below is re-prioritised accordingly.
- **Ratings are model estimates** (EPS ρ≈0.75, SMR ρ≈0.80 vs IBD), sparse in time (19 dates) and partial in coverage; the UI must label them and show "not rated" reasons (tasks 16.12–16.14).
- **Price policy is fixed by the backend:** split-only adjustment, **no total-return adjusted series, volume not split-adjusted** (13.3, 13.11).
- **Freshness is manual** (Stooq download by hand): show "data as of", never "live" (12.12).
- Still to be designed against the contract: everything in "Not built".

## 2. Principles

1. **Contract first, fixtures second, backend later.** Each front-end task is verified against contract fixtures (task 12.2) so front-end work never waits on the backend.
2. **Backend wins, front end falls back.** If a dataset is available the client never recomputes it; if not, it falls back (chart indicators, static price files, v1 screener) or hides the feature.
3. **Discoverable, not configured.** `/api/meta`, `/api/chart/{symbol}/meta`, `/api/user/entitlements` decide what is shown; no environment flags per feature.
4. **Point-in-time everywhere.** Every derived endpoint accepts `as_of`; this later enables the time machine, replay with ratings, and a survivorship-safe screener.
5. **Backend-computed overlays are read-only.** Patterns, pivots, stops are drawn from server geometry; user drawings stay separate.

## 3. Recommended delivery order for the backend (what unlocks the most front-end value)

| # | Backend deliverable | Unlocks in the front end | Front-end tasks |
|---|---|---|---|
| B1 | `/api/meta`, `/api/chart/{symbol}/meta`, `/api/stocks/search`, `/api/stocks/{symbol}`, `/api/universe/facets` (DB only) | search, header, capability discovery, industry counts, screener universe selector | 12.8, 12.9, 15.13, 16.9, 19.1 |
| B2 | OHLCV endpoint over `stock_history` (`adjust=none|split`) + `splits` / `dividends` endpoints + batch + quotes | prices from the backend, split-adjusted toggle, corp-action markers, watchlist quotes | 13.1–13.3, 13.6, 13.7, 13.9, 13.11 |
| B3 | `/technicals` over `technical_daily` (23 stored columns) | server SMA 10/50/200, EMA 21, ATR14, volume averages, 52w/ATH lines, screener technical filters | 14.1–14.7, 14.12 |
| B4 | `/ratings` over `rs_rating_history`, `eps_rating_history`, `smr_rating_history`, `/ratings/dates` | badges, checkup ratings block, screener rating columns/filters (as-of limited to 19 dates for EPS/SMR) | 16.x |
| B5 | `screener_snapshot` + `screener/fields`, `run` v2, `count`, presets (technical + rating + classification fields) | screener v2 | 15.x |
| B6 | `/filings` (already in DB) | filing markers | 17.1, 17.3 |
| B7 | Index prices + weekly bars | compare with index, RS line, server weekly, market engine input | 13.4, 13.8, 14.9, 14.10 |
| B8 | Serve fundamentals (expose the pipelines' quarterly inputs; annual; metrics) | earnings block, C/A scores, fundamentals filters | 17.x |
| B9 | Composite, Acc/Dis, Group RS, Earnings Stability, industry ranking; EPS/SMR into the daily cron | full ratings strip, industries page, heat-map | 16.3, 19.1–19.4 |
| B10 | Market engine (needs B7) | market banner, regime shading, M filters | 19.5–19.9 |
| B11 | Pattern / trade engine | overlays, breakout screens | 18.3–18.14 |
| B12 | CAN SLIM scoring (needs B8–B10) | gauge and reasons | 18.1–18.2 |
| B13 | Symbol/name history filled; 13F; news events | as-of ticker resolution; institutional and catalyst blocks | 22.x |
| B14 | Application schema + auth + billing | accounts, tiers, sync | 20.x, 21.x |

The front-end can begin B14-independent work immediately; auth (task 9.1) is blocked until B14's auth part exists.

## 4. Stock charts

**Today:** static `*.us.txt` → client aggregation → client indicators; drawings/layouts in localStorage.

**Target (in order of value):**
1. **Prices from the API** (13.x): backend-first data source with static fallback, adjusted toggle, server weekly/monthly, batch compare, index compare, quotes, delisted/first-bar clamping, tier-truncation notice.
2. **Server technicals** (14.x): SMA/EMA/ATR/volume averages read from `technical_daily` when the period is stored, everything else stays local; parity harness against the Python golden fixtures so both paths are pixel-equal; price-location lines (52w/ATH), MA-relation badges, RS-line pane + new-high marker.
3. **Marker layer** (17.2 + 13.9/17.3/17.4/18.8/18.10/19.7/22.3): one framework for splits, dividends, filings, earnings, breakouts, sell signals, distribution/FTD, news.
4. **Read-only overlay layer** (18.4–18.9): base box, cup/handle, double bottom, flat base, pivot line, buy zone, stops, 20–25 % profit zone from server geometry.
5. **Context** (16.3–16.5, 19.6): ratings strip, ratings in the legend, market-regime shading.
6. **Time machine** (22.5–22.7): `as_of` for the chart and replay.

**Interceptors** (12.3–12.7, 13.2): error mapping, auth/refresh, ETag cache, retry, entitlement (402 → paywall event), and the backend-first data-source interceptor. Rationale and the rules are in [`api/10-capabilities-and-fallbacks.md`](api/10-capabilities-and-fallbacks.md).

## 5. Stock screener

**Today:** demo table (`ticker, name, price, volume, change_percent, market_cap, sector, industry`) with local filters.

**What can be screened, per backend stage:**
- After B1/B2: sector, industry, industry group, exchange, type, ETF/ADR/SPAC flags, market cap, float, shares, IPO age, price, volume, dollar volume, % change.
- After B4: MAs (21/50/200) relations, % from 52w-high/ATH/52w-low, ATR %, relative volume, up/down volume ratio, RS-line new high.
- After B7: EPS/sales growth (quarterly, 3Q average, acceleration), CAGR 3y/5y, ROE, margins.
- After B8: composite, EPS, RS (+3/6/9/12m), SMR, Acc/Dis, Sponsorship, Group RS, Earnings Stability.
- After B11/B12: pattern type, base stage/quality, distance to pivot, in buy zone, breakout today / days ago, failed breakout, breakout quality, early entry, CAN SLIM total and C/A/N/S/L/I/M.
- After B13: fund count/change, institutional ownership, consecutive quarters, catalyst in last 60 days.

**Design:** schema-driven builder from `/api/screener/fields` (15.1–15.4) so new fields appear without a release; and/or tree; live count; presets (CAN SLIM, Breakout-ready, Recent breakouts, Top industry leaders, RS leaders, Earnings accelerators); saved screens; CSV/JSON export; universe selector (gate 3 508 / rating-eligible 5 342 / all 13 317, with the explanation that the price/dollar-volume gates are not yet applied); tier-locked fields; `as_of` for Ultimate; v1 fallback (15.14).

## 6. Everything else

| Feature | Source | Tasks |
|---|---|---|
| Stock checkup page (ratings, CAN SLIM, earnings, technical, industry, pattern blocks) | plan §46 | 16.9–16.11, 17.5–17.8, 18.1, 18.2, 18.13, 19.4 |
| Industries page + heat-map | `industry_group`, group RS | 19.1–19.3 |
| Market page / banner | market engine | 19.5–19.9 |
| Watchlists with server quotes, ratings columns | 13.7, 16.x | 21.2 |
| Server-side alerts (price, rating, breakout) | needs EOD jobs | 21.6 |
| Sync of layouts / drawings / templates / settings | `application.*` | 21.x |
| Institutional & news | 13F, events | 22.1–22.4 |
| Backtest | later | 22.8 |
| Data-info popover (as-of, model versions) | `meta` | 12.11 |

## 7. Pricing and tiers (proposal — needs the owner's decision)

Existing tiers and prices (`subscription.types.ts`): Free 0 · Plus 9.99 · Pro 29.99 · Ultimate 99.99 / month. Guiding rule: **breadth is cheap, depth and
derived intelligence is what people pay for.** Data licensing may constrain this (see §9, Q9).

| Capability | Free | Plus (9.99) | Pro (29.99) | Ultimate (99.99) |
|---|---|---|---|---|
| Daily history depth | 1 y | 3 y | 10 y | 20 y (full) |
| Intervals | daily | daily, weekly | + monthly | all |
| Chart tools | basic drawing set | all 105 tools | all | all |
| Indicators | 3 client-side | all client-side | + server technicals, RS line | all |
| Compare symbols | 1 | 3 | 5 | 8 |
| Screener results | 50 | 200 | 500 | unlimited |
| Screener fields | classification, price/volume, basic technicals | + fundamentals | + ratings, CAN SLIM, patterns | + institutional, events, `as_of` |
| Presets / saved screens | 3 presets / 0 | all / 3 | all / 20 | all / unlimited |
| Ratings (badges, checkup) | Composite + RS only | + EPS, SMR | all ratings | all + history |
| CAN SLIM score | – | total only | total + reasons | + history |
| Patterns, pivots, stops, sell signals | – | – | yes | yes + early entries |
| Market state / industries | banner only | + industries list | + group RS, heat-map | + breadth, history |
| Watchlists / items | 1 / 10 | 3 / 25 | 10 / 100 | unlimited |
| Alerts | – | 5 (price) | 50 (+ rating, breakout) | unlimited |
| Export | – | – | CSV 500 rows | CSV / JSON unlimited |
| Institutional holders, news events | – | – | summary | full |
| Time machine (`as_of`), backtest | – | – | – | yes |
| API access (calls/day) | 0 | 0 | 1 000 | 10 000 |
| Ads | yes | no | no | no |

All numbers are delivered by `/api/plans` and `/api/user/entitlements`, so they can change without a release (tasks 20.2, 20.3).

## 8. Phases and dependencies

```
12 API foundation ──┬─► 13 Prices ──► 14 Technicals ─────────────┐
   (no backend)     ├─► 15 Screener v2 ──► (filters grow with 16–19, 22)
                    ├─► 16 Ratings/Checkup ◄─ backend B8
                    ├─► 17 Fundamentals/Markers ◄─ B6/B7
                    ├─► 18 CAN SLIM/Patterns ◄─ B11/B12 (needs 17.2 marker layer, 14 technicals)
                    ├─► 19 Industries/Market ◄─ B9/B10 (needs 13.8 index data)
                    ├─► 20 Accounts/Tiers ◄─ B14 (+ existing 9.1)
                    └─► 21 User data sync ◄─ B14      22 Institutional/Events/Time machine ◄─ B13, all
```
119 tasks (index: `TASKS/README.md`, Phases 12–22). Phase 12 can start immediately; each later task lists the backend dataset it needs.

## 9. What I still need from you / the other two projects

**Answered by the second batch of documents:** price table shape (`stock_history`, raw strings, split-only adjustment, volume unadjusted), persistence of technicals (`technical_daily`, 23 columns), what EPS/SMR/RS are and their model versions and coverage, nightly schedule (manual Stooq download today).

**Still open:**
1. **Real current backend**: OpenAPI or the list of live routes and their real response shapes (`/api/screener/*`, `/api/stocks/*`, `/api/user/*`, `/api/chart/*`) — to reconcile with this contract.
2. **Index/benchmark prices** (SPX, NDX/COMP, RUT, DJI or ETF proxies SPY/QQQ/IWM): available? source? (blocks RS line, market engine, compare-with-index.)
3. **Price basis of `technical_daily`**: computed on raw or split-adjusted closes? (the chart shows split-adjusted; 14.12 needs the answer.) Are the 592 verified splits the complete set for the universe or only the EPS subset?
4. **Fundamentals**: which tables hold the quarterly/annual SEC-derived numbers (revenue, net income, EPS GAAP/adjusted, margins, ROE, shares) and can they be served point-in-time?
5. **Ratings cadence**: will EPS/SMR be recomputed daily/weekly going forward (cron) or stay on 19 dates? Will `effective_date` history be extended?
6. **Composite / Acc-Dis / Group RS / Sponsorship**: planned order and dates (drives when the checkup and industries pages get real data).
7. **Freshness**: plan to automate the Stooq download? Expected data lag; `next_refresh_after` semantics.
8. **Exact `security_master` column names** (exchange, security type, eligibility flags, cik) — contract uses proposed names in `01`.
9. **Licensing**: Stooq redistribution / commercial display; yfinance and Alpha Vantage terms for derived EPS; 13F/news sources. Limits the free tier and the API tier.
10. **Product decisions**: tier matrix in §7, payment provider, anonymous demo charts, whether Free may see all symbols' ratings.
11. **Universe policy**: default screener universe (3 508 gate); when will price/dollar-volume gates be applied (`avg_dollar_volume_50` now exists)?
12. **Auth**: JWT + refresh as in `09`, or sessions/cookies? CORS origins.
13. **Rating honesty**: may the UI call them "EPS Rating / SMR Rating" or must they carry a different name (IBD trademarks) — legal/branding decision.

## 10. Risks

- **Contract drift** between this repo and the backend: mitigated by fixtures (12.2) and the parity/contract specs; when the backend publishes OpenAPI, generate types from it and diff against `docs/api`.
- **Pixel/parity differences** between server and client indicators: 14.1 harness blocks regressions.
- **Payload size** on long series: columnar format, ETag, gzip, tier depth.
- **Ratings not available for the full universe** (only the gated 3 508): UI must show "not rated" distinctly from "loading" and "dataset off".
- **Look-ahead in demo `as_of`**: only trust point-in-time data after the backend confirms `effective_date` semantics.
