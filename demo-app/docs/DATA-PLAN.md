# Data plan — using the backend security master and the CAN SLIM roadmap in the front end

Date: 2026-09-29. Scope: **front end only**. The backend / data-fetcher are separate projects and are not programmed here.
Inputs: `SECURITY_MASTER.md`, `PRICE_DATA.md`, `DAILY_INGESTION_GUIDE.md`, `EPS_STATUS.md`, `EPS_COVERAGE_TRACKING.md`, `SMR_STATUS.md`, `FUNDAMENTALS.md`, `SEC_INGESTION.md`, `TECHNICAL_ARCHITECTURE.md`, `PROJECT_DESIGN.md`, `MODEL_CHANGELOG.md` (what the DB holds and how the backend is meant to be built; revision 3, 2026-09-29, after the owner's answers) and `IMPLEMENTATION_PLAN.md` (roadmap, §1–§59; its checkboxes are stale).
Outputs: this plan, the API contract for the backend (`docs/api/`), and small tasks (`TASKS/phase-12` … `phase-23`, 141 tasks).

## 1. Audit — what is implemented, what is not, what is planned

Full tables with column names: [`api/00-data-status.md`](api/00-data-status.md). Summary:

| State | Items |
|---|---|
| **In the DB now** | Security master (13 317 securities, stable `security_id`); classification; V2 enrichment (IPO/delisting dates, shares, float, market cap USD, ADR/SPAC/ETF flags); universe gating (5 342 → 3 508); `sec_filing` index (197 970); **daily prices `stock_history` since 1997 (raw Stooq strings, incremental manual import)**; **`splits`, `dividends`, `corporate_actions`**; **`technical_daily` (persisted, ~28 M rows, 23 columns, `TECHNICAL_DAILY_V1`)**; **RS ratings 3M/6M/12M/ER3 (daily)**; **EPS rating `EPS_V5_3` and SMR rating `SMR_V4` on 19 stored dates**; yfinance quarterly financials for foreign issuers; **SEC fundamentals: raw facts (11.3 M), normalised metrics (9.7 M, `FUNDAMENTALS_V2`), reconstructed quarters (`QUARTERS_V2`) with a point-in-time resolver, annual EPS (`ANNUAL_EPS_V1`), fundamental universe of 5 230 CIKs**; index prices expected (S&P 500, Nasdaq) |
| **Tables exist but empty** | `security_symbol_history`, `security_name_history` |
| **Not built** | weekly prices, Composite, Acc/Dis, Sponsorship, Group RS, Earnings Stability, the served fundamentals API (tables exist), RS line / market engine (need the index prices to be exposed), CAN SLIM, patterns / trade engine, market state, 13F, news, backtester, application schema; EPS/SMR are not in any daily cron |

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
| B2 | OHLCV endpoint over `stock_history` (split-adjusted only) + `splits` / `dividends` endpoints + batch + quotes | prices from the backend, split-adjusted label, corp-action markers, watchlist quotes | 13.1–13.3, 13.6, 13.7, 13.9, 13.11 |
| B3 | `/technicals` over `technical_daily` (23 stored columns) | server SMA 10/50/200, EMA 21, ATR14, volume averages, 52w/ATH lines, screener technical filters | 14.1–14.7, 14.12 |
| B4 | `/ratings` over `rs_rating_history`, `eps_rating_history`, `smr_rating_history`, `/ratings/dates` | badges, checkup ratings block, screener rating columns/filters (as-of limited to 19 dates for EPS/SMR) | 16.x |
| B5 | `screener_snapshot` + `screener/fields`, `run` v2, `count`, presets (technical + rating + classification fields) | screener v2 | 15.x |
| B6 | `/filings` (already in DB) | filing markers | 17.1, 17.3 |
| B7 | Expose `index_prices` (expected to exist) + `weekly_prices` | compare with index, RS line, server weekly, market engine input | 13.4, 13.8, 14.9, 14.10 |
| B8 | Serve fundamentals from the existing SEC tables (quarter resolver, growth, annual, metrics — `04`) | earnings block, C/A scores, fundamentals filters | 17.x |
| B9 | Composite, Acc/Dis, Group RS, Earnings Stability, industry ranking; EPS/SMR into the daily cron | full ratings strip, industries page, heat-map | 16.3, 19.1–19.4 |
| B10 | Market engine (needs B7) | market banner, regime shading, M filters | 19.5–19.9 |
| B11 | Pattern / trade engine | overlays, breakout screens | 18.3–18.14 |
| B12 | CAN SLIM scoring (needs B8–B10) | gauge and reasons | 18.1–18.2 |
| B13 | 13F (SEC), symbol/name history filled | institutional block, as-of ticker resolution | 22.1, 22.2 |
| B13b | News ingestion + classifier (`07` §2) | news feed, symbol news tab, chart markers, catalyst filter | 22.3, 22.4, 22.9–22.17 |
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

## 7. Pricing, tiers and licensing — decisions taken (owner delegated, 2026-09-29)

Existing tiers and prices (`subscription.types.ts`): Free 0 · Plus 9.99 · Pro 29.99 · Ultimate 99.99 / month. Rule: **breadth is cheap, depth and derived intelligence is what people pay for.**

**Licensing / branding decisions**
| # | Decision | Reason |
|---|---|---|
| L1 | Data is **display-only**: no bulk data download, no raw-price export, no data API in any tier until a licensed price feed replaces Stooq. Screener result export (derived rows) stays. `api_access` is shown as "coming soon" on the plans page and defaults to `false` in `/api/user/entitlements`. | Stooq's redistribution terms are unverified; a paid tier must not resell raw prices. Derived ratings/technicals are ours. |
| L2 | Price data always labelled "end-of-day, delayed" with the as-of date; no "live". | Data lags (manual import) and delayed data is the safe legal default. |
| L3 | Ratings are shown as **model ratings** produced by this product, versioned. UI never uses "IBD", "Investor's Business Daily", their logos or claims of equivalence; backend-controlled `display_name` for every rating/field. Defaults: "EPS Rating", "RS Rating", "Composite Rating", "Group RS", "Accumulation/Distribution", "Sponsorship", "Earnings Stability"; **"SMR" is shown as "Quality (Sales·Margins·ROE)"** and **"CAN SLIM" as "O'Neil-style growth score"** in headings, with the acronym allowed only in explanatory text. Legal review before public launch; changing names needs no release. | Names other than generic terms may be third-party trademarks; making them configurable removes the risk from the code. |
| L4 | Industry groups are the project's own taxonomy and are called "industry groups" only. | Architecture doc: IBD's groups are proprietary. |
| L5 | Anonymous visitors: **charts for 10 demo symbols** (`MSFT, AAPL, NVDA, AMZN, GOOGL, META, TSLA, AMD, SPY, QQQ`), 1 year daily, no ratings; everything else needs a free account. | Marketing pages need a working demo without exposing the whole dataset. |
| L6 | Payment provider: **Stripe Checkout + customer portal** (hosted; no card data in the app). | Least front-end scope, standard. |
| L7 | Auth: **JWT access + rotating refresh tokens**, Flask side; CORS limited to the app origin. | Matches the current `AuthService` design. |
| L9 | **News:** headline + ≤300-char snippet (only where the source licence allows) + link-out + our own classification; no article bodies, no scraping of publishers. Recommended sources in order: SEC 8-K, Alpha Vantage `NEWS_SENTIMENT`, company press-release RSS, GDELT (discovery), Yahoo headlines as link-out only. Design in `docs/api/07`. | Recreates the TradingView news experience (feed, symbol tab, chart markers, filters) without licensing risk. |
| L10 | **Vendor switch (Yahoo / Business Quant / Alpha Vantage):** all vendors' adjusted figures are acceptable, but the API serves **split-adjusted only** (never Yahoo's dividend-adjusted `adjclose`), declares `meta.source`, `meta.price_basis`, `meta.volume_basis`, and shapes never change with the vendor. Yahoo's terms restrict commercial redistribution and Alpha Vantage / Business Quant have plan-specific display rights → confirm terms before public launch; until then display-only (L1). | Keeps the front end vendor-independent. |
| L8 | Default screener universe: the 3 508-name gate set; the price / dollar-volume gates should be added now that `avg_dollar_volume_50` exists. | Cleaner results; matches the architecture's "rating-eligible" idea. |

**Tier matrix** (numbers delivered by `/api/plans` and `/api/user/entitlements`, changeable without a release):

| Capability | Free | Plus (9.99) | Pro (29.99) | Ultimate (99.99) |
|---|---|---|---|---|
| Daily history depth | 1 y | 3 y | 10 y | 20 y (full) |
| Intervals | daily | daily, weekly | + monthly | all |
| Chart tools | basic drawing set | all 105 tools | all | all |
| Indicators | 3 client-side | all client-side | + server technicals, RS line | all |
| Compare symbols | 1 | 3 | 5 | 8 |
| Screener results | 50 | 200 | 500 | unlimited |
| Screener fields | classification, price/volume, basic technicals | + fundamentals | + ratings, CAN SLIM-style score, patterns | + institutional, events, `as_of` |
| Presets / saved screens | 3 presets / 0 | all / 3 | all / 20 | all / unlimited |
| Ratings (badges, checkup) | RS only | + EPS, Quality | all ratings | all + history + "why this rating" |
| Growth score (CAN SLIM-style) | – | total only | total + reasons | + history |
| Patterns, pivots, stops, sell signals | – | – | yes | yes + early entries |
| Market state / industries | banner only | + industries list | + group RS, heat-map | + breadth, history |
| Watchlists / items | 1 / 10 | 3 / 25 | 10 / 100 | unlimited |
| Alerts | – | 5 (price) | 50 (+ rating, breakout) | unlimited |
| Export (derived results only) | – | – | CSV 500 rows | CSV / JSON unlimited |
| Institutional holders | – | – | summary | full |
| News | market headlines, 24 h, 20 items | + per-symbol (7 days) | + filters, sentiment, 90 days, chart markers | full history, watchlist feed, news alerts |
| Time machine (`as_of`), backtest | – | – | – | yes |
| Data API | – | – | coming soon | coming soon |
| Ads | yes | no | no | no |

Implementation tasks: 20.2 (entitlements), 20.3 (plans from API), 20.8 (backend-controlled display names), 16.12 (model-rating labelling), 22.3 and 22.9–22.17 (news).

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
   23 Quality/contract tests/cut-over runs in parallel from phase 12 on and closes the plan
```
141 tasks (index: `TASKS/README.md`, Phases 12–23). Phase 12 can start immediately; each later task lists the backend dataset it needs.

## 9. Answers received and what is still open

**Owner answers (2026-09-29):**
1. *No API is serving.* → The contract in `docs/api/` describes what the backend **should serve**; there is nothing to reconcile with (v1 spec and the front end's current calls are equally hypothetical). The backend is planned as Flask + SQLAlchemy + Pydantic (`TECHNICAL_ARCHITECTURE.md`); an OpenAPI export should replace `docs/api` as source of truth when it exists.
2. *Index prices should exist.* → Owner supplied the Stooq index list (60 tickers). Codes follow Stooq (`NDQ` = Nasdaq Composite, not `COMP`). **The list has no S&P 500, Dow, Russell or NYSE.** Owner decision: **`TSX` is the interim S&P 500 replacement** (RS-line benchmark; market engine = `NDQ` + `TSX`); Stooq lists index volume, missing volume would be added later as an index. Exposed via `/api/meta.benchmarks` (`is_interim`), so switching to `SPX` later needs no front-end change. Catalogue: `docs/api/02-prices.md`.
3. *Split-adjusted everything, probably the whole universe.* → Contract assumes `technical_daily`, RS and patterns are on split-adjusted prices (`meta.price_basis`); task 14.12 verifies by fixture and falls back per symbol if not.
4. *Fundamentals are SEC tables.* → Confirmed and mapped in `04-fundamentals.md` (`sec_filing`, `fundamental_period/metric`, `fundamental_quarter_period/metric`, PIT resolver, growth semantics).
5. *Ratings recomputed daily or at least on earnings ingestion.* → Contract reports `effective_dates` and `/ratings/dates`, so it works for daily and for event-driven recomputation.
6. *Licensing: I decide.* → Decisions in §7.

**Owner answers, round 2 (2026-09-29):**
- *Split adjustment:* everything served is split-adjusted, act as if it already is → contract has no raw mode, `price_basis` always `split_adjusted`; tasks 13.3 / 13.11 / 14.12 simplified.
- *Whole-universe split coverage:* believed yes → assumed.
- *Vendors:* data fetching mostly moves to Yahoo / Business Quant / Alpha Vantage (they carry adjusted figures) → contract is source-agnostic (L10).
- *13F:* from SEC (`07` §1). *News:* undecided, "try to recreate TradingView news" → full design in `07` §2, source ranking, tasks 22.9–22.17, decision L9.
- *Security-master columns (`is_active`, `country`, `cik`, eligibility flags):* "yes, otherwise they will be once integration is required" → the names in `01` are the contract.

**Round 3 (2026-09-29):** index list = Stooq (above); extra security-master columns will be exposed when integration requires it; news provider and licence terms TBD.

**Still open (small; none blocks front-end work):**
- Index volume for `NDQ` and `TSX` (owner: Stooq lists it; if not, backend adds it as an index later).
- Index table name (`index_master` / `index_prices` proposed); whether `market_calendar` will exist.
- Whether `sec_filing` will gain period end and 8-K item numbers (needed for the earnings-8-K news category).
- News: which provider(s) the backend picks (recommendation: SEC 8-K + Alpha Vantage) and the redistribution terms of the chosen plan.
- Business Quant / Alpha Vantage / Yahoo plan terms for displaying derived data to paying users.
- Stripe account and auth service configuration.

## 10. Cross-project integration

Papers for the other two projects: [`integration/README.md`](integration/README.md) (data flow, ground rules, milestones M0–M11, hand-off artefacts), [`integration/BACKEND.md`](integration/BACKEND.md) (Flask API: endpoint checklist with data sources, cross-cutting rules, security, acceptance) and [`integration/DATA-FETCHER.md`](integration/DATA-FETCHER.md) (tables/views the API reads, `dataset_status` handshake, nightly order, `screener_snapshot`, news/13F ingestion, vendor independence, quality gates).

## 11. Milestones and definition of done

Milestones M0–M11 and their per-project deliverables are in `integration/README.md` §2. A milestone is done when (a) the fetcher's tables exist and pass their quality gates, (b) the backend endpoints pass the contract tests (task 23.2), (c) the front-end tasks pass browser verification against the real backend (23.7 cut-over checklist), and (d) `docs/api/CHANGELOG.md` records any deviation.

**Plan-level definition of done**
- Charts: all price/technical/RS data from the API when available, static fallback otherwise; overlays and markers from server data only.
- Screener: schema-driven, every documented field available or shown "coming soon", presets, saved screens, export, `as_of` for Ultimate.
- Ratings/checkup: every non-null rating shown with model label, date, reason for unrated; checkup blocks per dataset.
- Accounts: entitlements and plans from the API; paywalls; user data synced; anonymous demo mode.
- News: feed, symbol tab, filters, markers, reader dialog.
- Quality: datasets on/off matrix green, contract tests green against staging, accessibility and performance budgets met, cut-over checklist executed.

## 12. Testing strategy
1. **Unit** (Vitest) per service/pipe/component, written first (task rules).
2. **Fixture-driven e2e** (Playwright, task 12.2 helper) for every task; **datasets on/off × tier × auth matrix** (23.3).
3. **Contract tests** against staging (23.2) and generated types (23.1) so drift fails CI.
4. **Parity tests**: server vs client indicators against Python golden fixtures (14.1, 14.12).
5. **Visual**: pixel checks for overlays (pivot, buy zone, markers), light and dark screenshots for new components.
6. **Performance budgets** (23.5) and **accessibility** (23.6).

## 13. Benchmark decision (interim)
Stooq offers no S&P 500; the owner chose **`TSX` (S&P/TSX Composite) as the interim replacement**, with `NDQ` for the market engine. RS *ratings* (stock vs stock) are unaffected; only the RS line and the market state use it. Exposed as `meta.benchmarks` with `is_interim: true`; switching to `SPX` later needs no front-end change (task 13.12). Trade-off: a Canadian index is a weaker proxy for US market direction, so market-state output is shown with an "interim benchmark" note.

## Execution status (2026-10-02)
Phase 12 (API foundation, 12 tasks) and task 13.1 are implemented, tested and pushed; everything else is NOT STARTED. Exact state, deviations, open questions and the next step (13.2) are in [`HANDOFF.md`](HANDOFF.md). The app now defaults to a backend on `http://localhost:3000`.

## 14. Risks

- **Contract drift** between this repo and the backend: mitigated by fixtures (12.2) and the parity/contract specs; when the backend publishes OpenAPI, generate types from it and diff against `docs/api`.
- **Pixel/parity differences** between server and client indicators: 14.1 harness blocks regressions.
- **Payload size** on long series: columnar format, ETag, gzip, tier depth.
- **Ratings not available for the full universe** (only the gated 3 508): UI must show "not rated" distinctly from "loading" and "dataset off".
- **Look-ahead in demo `as_of`**: only trust point-in-time data after the backend confirms `effective_date` semantics.
