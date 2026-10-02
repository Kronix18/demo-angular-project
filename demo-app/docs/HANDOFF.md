# HANDOFF — state of the data/backend integration work (written 2026-10-02)

Read this first if you are picking the work up (another agent or a developer). Everything here is true of branch
`claude/determined-knuth-bzgrv3` (PR #1 on `kronix18/demo-angular-project`, **do not open another PR**); the last
commit when this was written is `640bd90` plus the commit that adds this file. Working directory: `demo-app/`.

## 1. What the project is and what this effort is

Angular 21 stock screener/chart app (standalone components, zoneless, signals, Chart.js; Vitest via `ng test`; Playwright e2e).
The chart is TradingView-style (done in earlier sessions, Phases 0–11). **This effort** prepares the front end to consume a
separate **backend (Flask API)** and **data fetcher (Python/PostgreSQL pipelines)** that live in other projects and are
**not programmed here**. What was produced:

| Deliverable | Where |
|---|---|
| Audit of what the backend DB has / lacks, strategy, decisions (licensing, tiers, benchmark…), milestones | [`docs/DATA-PLAN.md`](DATA-PLAN.md) |
| The API contract the backend should serve (conventions, endpoints, tables, fields, units, tiers) | [`docs/api/`](api/README.md) (files `00`–`10`, `CHANGELOG.md`, `fixtures/`) |
| Integration papers for the other two projects | [`docs/integration/`](integration/README.md), `BACKEND.md`, `DATA-FETCHER.md` |
| 141 small tasks (phases 12–23) in the repo's task template | [`TASKS/README.md`](../TASKS/README.md) (rows for 12.x–23.x) |
| The first tasks, executed | Phase 12 complete (12 tasks) + 13.1 (this document §3) |

## 2. How to work here (rules that were followed; keep following them)

1. **TDD, strict**: write the spec, run it, see it fail for the right reason (RED), **commit `test: …`**, then implement (GREEN), commit `feat: …`. One logical commit per task. Commit trailers (required by the environment):
   `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01QxvMY7jm6iunotHw8qKGL1` (use your own session link if you are another agent).
2. **Browser proof** for every task (Playwright, real Chromium): the user-visible outcome, console clean. Where a task is only a service/layer, say so in the task's "Verification results" (done that way for 12.9 and 13.1).
3. No colour literals and no `var(--x, #fff)`-style fallbacks: all colours come from tokens in `src/styles/theme.scss` (a guard spec, `src/styles.spec.ts`, enforces it; new tokens added so far: `--c-warning`, `--c-warning-text`, `--c-warning-bg`). Icons are drawn SVG (`src/app/shared/icons/icons.ts`, spec enforces coverage).
4. Mark a task finished with `python3 scripts/task-done.py <id> "<notes, \n = bullet>" [STATUS]` — it fills the task file's *Verification results* and the status cell in `TASKS/README.md`. **Never regenerate the task files** (the generator was a throw-away script; regenerating would wipe statuses). Edit task files by hand if the plan changes, and record the change in `docs/api/CHANGELOG.md` when it touches the contract.
5. The graphify checkpoint required by `TASKS/README.md` was **skipped for all of this work: the `graphify` CLI is not installed in the container**. Install it (`pip install graphifyy`, see task 0.1) if you want to honour that rule.

### Commands
```bash
cd demo-app
npm test -- --watch=false                       # unit (Vitest). NOTE: ng test compiles EVERY spec: one RED spec with a missing import
                                                #   breaks the whole run. To see RED in isolation use: npx ng test --watch=false --include='path/to/x.spec.ts'
                                                #   and commit it before implementing (the full suite will be red until you do).
npx ng build                                    # must have no warnings
CHROMIUM_PATH=/opt/pw-browsers/chromium npx playwright test           # e2e (starts ng serve itself on :4200); 62 pass, 1 skipped (LOCAL_BACKEND)
CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e:prod              # production-bundle smoke (2 tests)
npm run backend:check [-- http://host:port]     # checks a running backend: reachable, CORS, /api/meta shape
LOCAL_BACKEND=1 npx playwright test e2e/local-backend.spec.ts         # e2e against a REAL server on localhost:3000 (skipped otherwise)
```
Last verified state (2026-10-02): **581 unit tests, 62 e2e (+1 skipped), 2 prod smoke, `ng build` clean.**

## 3. What is DONE (all committed and pushed)

| Task | Result (files under `src/app/…` unless noted) |
|---|---|
| 12.1 | `core/api/types.ts` – contract types (`ApiEnvelope`, `ApiMeta`, `ApiErrorBody/Code`, `Tier`/`TIERS`, `DatasetName`, `MetaResponse`, `ChartMetaResponse`, `isApiErrorBody`) |
| 12.2 | `docs/api/fixtures/*.json` (meta, chart meta, ohlcv json + columnar, technicals, ratings, screener fields/run, entitlements, plans, user profile) and `e2e/mock-api.ts` → `mockApi(page, {datasets, tier, errors, overrides, flaky, expiredTokens, etag, onRequest})` |
| 12.3 | `core/api/errors.ts` – `ApiError`, `toApiError`, `shouldToast` (never for 402/404/token_expired/data_not_ready), `ApiErrorService` (one deduped toast, 6 s), `errorInterceptor` (rethrows the ORIGINAL HttpErrorResponse so legacy callers are unaffected), `SILENT_ERRORS` context token for optional discovery calls; `shared/api-toast` (`<app-api-toast/>` in `app.html`) |
| 12.4 | `core/api/token-store.ts` (only place touching token storage; keys `auth_token`, `auth_refresh_token`), `core/api/auth-interceptor.ts` (Bearer on API calls only, shared single refresh via `TokenRefresher`, replay marked by `HttpContextToken`, stale-token 401s replay without a 2nd refresh, failed refresh → `AuthService.logout()`) |
| 12.5 | `core/api/etag-cache.ts` – `ETagCache` LRU (200) keyed by auth scope+URL, `If-None-Match`, 304 → cached body, `onDataAsOf()` evicts when `/api/meta` data dates move |
| 12.6 | `core/api/retry-interceptor.ts` – GET-only retry of 429/503/network, `Retry-After` else 500 ms·2ⁿ ±25 % jitter (`RETRY_JITTER` token), max 2. `ApiService` no longer retries by itself nor sets the Authorization header |
| 12.7 | `core/api/upgrade.ts` – `entitlementInterceptor` turns 402 `upgrade_required` into `UpgradeService.upgrade$` events `{feature, requiredTier, message, url}` (paywall UI is 20.4) |
| 12.8 | `core/api/meta.service.ts` – `MetaService` signals (`datasets`, `dataAsOf`, `benchmarks`, `modelVersions`, `loaded`), `has()`, `displayName()`; loaded in `provideAppInitializer` **without awaiting**; failure ⇒ no datasets, silent; refresh at `next_refresh_after` (≥ 60 s) or every 15 min when null |
| 12.9 | `core/api/symbol-capabilities.ts` – per-symbol `GET /api/chart/{symbol}/meta` cached signal, `supports()`, `hasInterval()` |
| 12.10 | `shared/gating/gating.ts` – `*appIfDataset` (global via meta, or `symbol:` via capabilities, `else`) and `*appIfFeature` (`locked:` template); both render nothing while unknown. `core/api/entitlements.service.ts` (minimal; 20.2 extends). `/diagnostics` page (`features/diagnostics`) shows datasets/features |
| 12.11 | `shared/data-info` – info button + popover (as-of per dataset, model versions, split-adjusted/EOD note, interim benchmark); in the chart toolbar and screener header; new drawn icon `datainfo` |
| 12.12 | `core/api/freshness.ts` + chip "Data as of … · end of day" and warning "Data may be out of date" after > 3 business days (never says "live") |
| 13.1 | `core/api/ohlcv-api.client.ts` – `OhlcvApiClient.get(symbol, {interval,from,to,limit,format,asOf})`, `mapOhlcv()` (v1 array **and** `format=columnar` → identical internal `OHLCV[]`); never sends `adjust` (all prices are split-adjusted). **Not wired into the chart yet** (13.2) |

Interceptor order in `app.config.ts`: `[errorInterceptor, entitlementInterceptor, retryInterceptor, etagCacheInterceptor, authInterceptor]` (first = outermost: errors are reported only after retries/refresh finished).

**Unplanned changes made on the way (all tested):**
* Default API base is now **`http://localhost:3000`** (`core/api-url.ts`; override per deployment with `<meta name="api-url" content="…">`). README has a "Connecting to your backend" section; `scripts/check-backend.cjs` (`npm run backend:check`) and `e2e/local-backend.spec.ts` verify a real server.
* `e2e/helpers.ts` now exports a `test` that installs the contract mock on every page by default (otherwise the browser logs `ERR_CONNECTION_REFUSED` console errors for the absent backend and the console-clean checks fail). Specs importing `test` from `@playwright/test` directly must call `mockApi(page)` themselves. Run with `LOCAL_BACKEND=1` to bypass the default mock.
* Fixed a latent crash: `ProfileComponent`'s success path called `authService.getCurrentUser().set(...)` (not a function); it never ran while the backend was down. Regression spec `features/profile/profile.component.spec.ts`.
* E2E hooks (like the older `window.__charts`): `window.__meta`, `__symbolCaps`, `__upgrade`, `__ohlcvApi` expose the services for Playwright. They are harmless in production.

## 4. What is NOT done — resume here

**Everything from 13.2 onward** (≈129 tasks). `TASKS/README.md` is the index (status column; 13.1 and all of Phase 12 are DONE, the rest NOT STARTED); every task file lists Depends-on, the backend dataset it needs, steps and the browser verification to run. Suggested order = the order of the index within a phase, phases 13/14/15 can run in parallel after 12; later phases follow backend datasets (see `docs/DATA-PLAN.md` §3, §8 and `docs/integration/README.md` §2 milestones M0–M11).

### Next task in detail: 13.2 – backend-first data source with static fallback
* **The seam**: `core/services/chart-data.service.ts` → `ChartDataService.getOHLCV(symbol, interval, limit)` is used by `charts/chart-viewer/chart-viewer.component.ts` (main load at ~line 1260, compare overlay `ensureCompare` at ~1358) and `core/services/watchlist.service.ts` (~line 43). Today it reads static Stooq files `public/test-data/<sym>.us.txt` and maps 404 to `[]`.
* **Plan**: add a `ChartDataSource` (or make `ChartDataService` delegate) that returns `OhlcvApiClient.get(...)` **when** `MetaService.has('prices')` (and, once capabilities have loaded, `SymbolCapabilities.supports/ hasInterval`) and otherwise — or on 404/503/network/empty-because-error — falls back to the existing file path. Both paths must yield identical `OHLCV[]`. Record which source answered (signal) and show it in the data-info popover (`shared/data-info`). Keep the `AVAILABLE_SYMBOLS` unknown-symbol behaviour of the chart error card.
* **Specs matrix** (task file): backend ok / 404 / 503 / offline / dataset off. Browser: with `mockApi` serving `/api/chart/MSFT/ohlcv` the chart renders from it (pixel check via `canvasPixels` in `e2e/helpers.ts`); with the mock's `errors`/no dataset it renders from files; console clean.
* Caution: the interceptors already retry 429/503/network twice, so "offline" fallback needs the fake-timer or `flaky` mock options; a 404 for a symbol the backend lacks must fall back silently (404 never toasts).

### Known gaps / things a newcomer must not assume
* **No real backend exists yet** for this work. The contract is a specification; the only server used was a throw-away stand-in. `GET /api/meta` absent ⇒ the app degrades silently to its demo data (by design).
* **Auth is still the demo** (`core/auth/auth.service.ts`: hard-coded admin credentials, `sessionStorage`). `TokenStore` + `authInterceptor` are ready; swapping to real endpoints and removing the demo credentials is task **20.1 / 9.1** (blocked on a backend).
* `ApiService` (legacy) still exists with its own `handleError`; services still call it. Migrating callers to typed clients happens task by task.
* `EntitlementsService` is minimal (load once, no refresh on login/402) — task 20.2. `*appIfFeature` therefore shows "locked" for everyone until `/api/user/entitlements` exists.
* Benchmark/market indices come from `/api/meta` (`benchmarks`); **TSX (S&P/TSX Composite) is the interim stand-in for the S&P 500** (owner decision; `NDQ` + `TSX` for the market engine). Nothing in the front end hard-codes an index (task 13.12 builds the `BenchmarkService`).
* Product/licensing decisions taken (documented in `docs/DATA-PLAN.md` §7, L1–L10): display-only data, no raw-data API, EOD/delayed labelling, backend-controlled display names (`SMR` → "Quality (Sales·Margins·ROE)", `CAN SLIM` → "O'Neil-style growth score", never "IBD"), anonymous demo for 10 symbols, Stripe + JWT. These are proposals the owner delegated; legal review is advised before a public launch.

## 5. Open questions still waiting on the owner / the other projects
(Also in `docs/DATA-PLAN.md` §9.) None blocks front-end work, which runs on fixtures.
1. Index table name/codes and index volume for `NDQ` and `TSX` (owner: Stooq lists volume; add as index if missing). S&P 500 not available from Stooq.
2. Whether `sec_filing` will gain `items` (8-K item numbers) / `period_end`.
3. News provider(s) and redistribution terms (recommendation in `docs/api/07-institutional-events.md` §2.2: SEC 8-K + Alpha Vantage news, GDELT discovery, Yahoo link-only; no scraping, no article bodies).
4. Terms of Yahoo / Business Quant / Alpha Vantage for displaying derived data to paying users; Stooq redistribution terms.
5. Stripe account, auth service (JWT + rotating refresh assumed), CORS origins for production.
6. Backend side: whether the data fetcher serves split-adjusted prices everywhere (owner: act as if yes) — task 14.12 asserts it per symbol via `meta.price_basis`.

## 6. Where things are (map)

```
demo-app/
  README.md                     run/test/connect instructions
  API-BACKEND-SPEC.md           v1 chart spec (superseded by docs/api for anything new)
  docs/
    HANDOFF.md                  this file
    DATA-PLAN.md                plan, audit, decisions, milestones, risks
    ARCHITECTURE.md             app architecture (+ API layer section)
    api/                        THE contract for the backend (README = conventions; 00-data-status … 10-capabilities…; fixtures/; CHANGELOG.md)
    integration/                README (3-project flow, milestones), BACKEND.md, DATA-FETCHER.md
  TASKS/                        task index + phase-NN-*/ task files (12.x–23.x are the new plan)
  scripts/                      check-backend.cjs, task-done.py (+ older verify scripts)
  e2e/                          Playwright specs, helpers.ts (default mock), mock-api.ts
  src/app/core/api/             the new API layer (see §3)
  src/app/shared/{api-toast,data-info,gating}   new UI building blocks
  src/app/features/diagnostics  /diagnostics page
```

## 7. Gotchas collected while doing this
* `ng test` compiles all specs together (see §2 commands). A committed RED spec makes the full unit run fail until the implementation lands: that is expected between the `test:` and `feat:` commits; do not push in between.
* Specs for services calling the backend must use `http://localhost:3000` (the default) — use `HttpTestingController`; use `vi.useFakeTimers({ toFake: ['Date'] })` when only the clock matters.
* Without a mock the app logs network errors to the console when nothing listens on :3000. That is expected during manual dev (open `/diagnostics` and `npm run backend:check`); e2e uses the default mock.
* Playwright: `mockApi` registers a catch-all `**/api/**` route; later `page.route` calls win. `page.unrouteAll()` then `mockApi(...)` again to switch behaviour mid-test.
* If the shell tool reports a transient "classifier gave no verdict" error, retry later; the work in the tree is not lost.
* Do not use `pkill -f "ng serve"` from the tool shell (it killed the shell once); Playwright starts and reuses its own dev server.
