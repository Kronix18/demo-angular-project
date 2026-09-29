# TASKS/ — One File Per Task

Replanned 2026-09-23 after full codebase + docs audit. Supersedes the task list
previously embedded in TASKS.md (which had duplicate task numbers, false
"completed" claims, and copy-paste verification blocks).

## Mandatory rules for EVERY task (non-negotiable)

1. **Graphify checkpoint** at task start: `/graphify . --mode deep --dir graphify-out/`
   (install graphifyy first — see task 0.1).
2. **TDD (strict)**: write the spec file FIRST, run it, confirm it FAILS for the
   right reason (RED), commit it, then implement (GREEN). No production code
   before a failing test exists.
3. **Verify in a real browser yourself**: `npm run build` (exit 0) then `ng serve`,
   open the route in a browser (Playwright via the browser tool), assert the DOM,
   check the console is clean, take a screenshot as evidence. Never hand this to
   the user as "please verify".
   **THOROUGHNESS RULE (Kevin, 2026-09-24 — after 2.1's data-only pass was
   rejected)**: a task passes verification only if the USER-VISIBLE outcome
   works, not a sub-layer of it. Concretely:
   - A "renders" claim requires pixel-level proof: canvas present + nonzero size
     + non-trivial drawn content (pixel count AND color variance thresholds;
     blank/filled canvas = FAIL). DOM presence alone is never enough.
   - A data/integration task behind a broken UI is NOT a pass: state plainly
     what still fails on the page ("chart area shows stuck Loading..." = fail
     of the rendering task, even if the fetch layer is green).
   - Assertions must match the task's user-facing claim, not the convenient
     subset. If the scope genuinely covers only a sub-layer, the verification
     section must say exactly that — never print a bare "N/N PASS" for a page
     that is visibly broken.
   - Every verify script must capture and REPORT console errors, stuck loading
     states, and missing elements — and must fail the run if the page's final
     state isn't the state the task promised.
4. **No inline styles / no hardcoded colors**: all styling via CSS custom
   properties defined in the theme SCSS file(s).
5. **Documentation updated in the same task** so another agent can pick up:
   update this index's status table, the phase doc, and the task file itself.
6. **One git commit per task** with a descriptive message — verification of TDD
   is done via git history (`test: ...` commit before `feat: ...` commit).

> **Note (7.2):** the per-task `scripts/verify-*.cjs` evidence scripts referenced in the task files below were folded into the Playwright suite (`e2e/`) and removed; their assertions live on in `e2e/*.spec.ts`. Earlier screenshots stay in `docs/screenshots/`.

## Status legend
- NOT STARTED / IN PROGRESS / DONE (browser-verified) / BLOCKED (by task(s))

## Index

| Task | File | Status | Notes |
|------|------|--------|-------|
| 0.1 | phase-0-audit/0.1-env-repo-hygiene.md | DONE (see task file) | graphify installed, baseline recorded, first checkpoint built |
| 0.2 | phase-0-audit/0.2-python-port-inventory.md | DONE (see task file) | inventory produced |
| 0.3 | phase-0-audit/0.3-api-spec-alignment.md | DONE (see task file) | spec aligned with demo data + 0.2 findings |
| 1.1 | phase-1-auth-navbar/1.1-auth-service-state.md | DONE (see task file) | auth state rehydrates; login subscribes |
| 1.2 | phase-1-auth-navbar/1.2-navbar-composition.md | DONE (see task file) | navbar composed for both auth states; verify-1-2.cjs ready for controller browser run |
| 1.3 | phase-1-auth-navbar/1.3-guards-and-login-page.md | DONE (see task file) | authGuard live on /screener,/profile,/stock/:symbol with returnUrl; login page links fixed; verify-1-3.cjs 13/13 |
| 2.1 | phase-2-chart-data/2.1-test-data-pipeline.md | DONE (data layer ONLY — /charts page still shows stuck Loading until 2.2) | 8 Stooq files served from public/test-data; URL+epoch-ms fixed; 26/26 specs; verify-2-1.cjs 15/15 (data assertions only) |
| 2.2 | phase-2-chart-data/2.2-chartjs-registration.md | DONE (pixel-verified: candles render on msft+qqq) | chart-setup module, canvas-in-DOM, zoneless markForCheck; 32/32 suite |
| 2.3 | phase-2-chart-data/2.3-toolbar-integration-redo.md | DONE | toolbar integration (see task file / git log) (status synced from git history 2026-09-29) |
| 3.1 | phase-3-panes-interaction/3.1-volume-pane.md | DONE | volume pane, aligned y-axes (status synced from git history 2026-09-29) |
| 3.2 | phase-3-panes-interaction/3.2-zoom-pan.md | DONE | zoom/pan (chartjs-plugin-zoom) (status synced from git history 2026-09-29) |
| 3.3 | phase-3-panes-interaction/3.3-crosshair-tooltip.md | DONE | crosshair through both panes (status synced from git history 2026-09-29) |
| 4.1 | phase-4-state-toolbar/4.1-chart-state-service.md | DONE | chart state store + sessionStorage (status synced from git history 2026-09-29) |
| 4.2 | phase-4-state-toolbar/4.2-toolbar-state-refactor.md | DONE | toolbar writes to state store (status synced from git history 2026-09-29) |
| 4.3 | phase-4-state-toolbar/4.3-time-range-presets.md | DONE | range presets, W-FRI weekly, linear index axis (status synced from git history 2026-09-29) |
| 5.1 | phase-5-indicators/5.1-indicator-calculations.md | DONE (unit-verified; golden values vs Python, 14 specs) | `core/indicators/*` + `IndicatorCalculationService`; UI render is 5.2 |
| 5.2 | phase-5-indicators/5.2-indicator-panel.md | DONE (browser-verified 12/12, `scripts/verify-5-2.cjs`) | overlay + oscillator panes, panel add/remove, state-driven |
| 5.3 | phase-5-indicators/5.3-indicator-management.md | DONE (browser-verified, `verify-5-2.cjs` 14/14) | inline validation (2..500), duplicate error, WMA/RMA, rehydration sanitising; persistence from 4.1 |
| 5.4 | phase-5-indicators/5.4-chart-layout-redesign.md | DONE (browser-verified 25/25, `scripts/verify-layout.cjs`) | one-panel chart, LOD windowing, full-viewport layout, compact navbar (Kevin, 2026-09-29) |
| 6.1 | phase-6-integration/6.1-routing-navigation.md | DONE (browser-verified, `scripts/verify-6-1-6-3.cjs`) | active-route styling, Charts link reopens last symbol, chart routes are fullscreen |
| 6.2 | phase-6-integration/6.2-design-token-compliance.md | DONE for shell + chart (browser-verified, `verify-6-2.cjs` 9/9); feature pages grandfathered by a ratchet | theme.scss, guard spec, opt-in dark theme |
| 6.3 | phase-6-integration/6.3-error-loading-states.md | DONE (browser-verified 13/13) | skeleton, error card (unknown symbol / no data / failed) + symbol picker + Retry |
| 6.4 | phase-6-integration/6.4-performance.md | DONE (measured; via LOD windowing, not LTTB) | cold ALL (10k bars, 4 indicators) 672 ms; pan ~17 ms/frame; e2e-enforced budgets |
| 7.1 | phase-7-testing/7.1-coverage-gate.md | DONE | `npm run test:coverage`: 97.8% stmts / 89.3% branches over core+charts+app.ts, gate at 80% |
| 7.2 | phase-7-testing/7.2-e2e-playwright.md | DONE | `npm run e2e`: 19 Playwright tests (auth, chart, indicators, layout x4 sizes, states, theme) |
| 7.3 | phase-7-testing/7.3-manual-matrix.md | DONE (29 PASS, 2 NOT RUN: Firefox/WebKit not installed) | [docs/MANUAL-MATRIX.md](../docs/MANUAL-MATRIX.md) |
| 8.1 | phase-8-cleanup-docs/8.1-dead-file-removal.md | DONE | 20 dead files removed; build + 14 spec files + browser scripts green |
| 8.2 | phase-8-cleanup-docs/8.2-readme-architecture.md | DONE | README rewritten, docs/ARCHITECTURE.md added, links checked, cold `npm ci && npm run build` verified |
| 8.3 | phase-8-cleanup-docs/8.3-production-build.md | DONE (browser-verified) | production build clean (no warnings), `npm run e2e:prod` smoke on the static bundle |
| 9.1 | phase-9-final/9.1-real-backend-auth.md | NOT STARTED | last task, needs backend |
| 10.1 | phase-10-tradingview/README.md#101 | DONE (browser-verified) | TradingView dark palette (#131722/#1e222d/#d1d4dc), theme toggle + OS auto-follow, zero colour literals app-wide |
| 10.2 | phase-10-tradingview/README.md#102 | DONE (browser-verified) | HTML legend per pane: OHLC of hovered bar, indicator values, eye toggle (persisted), remove |
| 10.3 | phase-10-tradingview/README.md#103 | DONE (browser-verified; own canvas plugin instead of chartjs-plugin-annotation) | trend line, horizontal ray, parallel channel: draw, select, drag, delete, per-symbol persistence |
| 10.4 | phase-10-tradingview/README.md#104 | DONE (delivered in 5.4; drag-to-resize panes deferred) | true stacked panes, per-pane y, shared x, separators |
| 10.5 | phase-10-tradingview/README.md#105 | DONE (browser-verified; symbol search dialog deferred) | chart types candles/OHLC/line/area, magnet crosshair + price label, snapshot PNG, fullscreen, dblclick reset |

## Data & backend integration plan (Phases 12–22) — added 2026-09-29

Plan: `docs/DATA-PLAN.md`. Contract the backend implements: `docs/api/README.md` (+ files 00–10).
Rules specific to these phases:
- **No backend code is written here.** Every task is built and browser-verified against the contract fixtures/mock (task 12.2); the real backend is a later switch, then the same task's verification is re-run against it.
- Each task states the **backend dataset** it needs; a dataset that is off in `GET /api/meta` means the feature is hidden or shows "coming soon" (never an error).
- Tasks are ordered by dependency, not by phase number: phase 12 first, then any of 13/14/15 in parallel, later phases as the backend datasets land.

### Phase 12 — API foundation (interceptors, meta, capabilities)
No backend dataset needed: everything is built and verified against contract fixtures, so it can start immediately and the real backend is a later switch.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 12.1 | phase-12-api-foundation/12.1-typed-api-models-from-the-contract.md | NOT STARTED | Typed API models from the contract — needs: none |
| 12.2 | phase-12-api-foundation/12.2-contract-fixtures-and-mock-backend-for-e2e.md | NOT STARTED | Contract fixtures and mock backend for e2e — needs: none |
| 12.3 | phase-12-api-foundation/12.3-apierror-mapping-and-errorinterceptor.md | NOT STARTED | ApiError mapping and errorInterceptor — needs: none |
| 12.4 | phase-12-api-foundation/12.4-authinterceptor-with-refresh.md | NOT STARTED | authInterceptor with refresh — needs: none (mock auth); real endpoints from 9.1 |
| 12.5 | phase-12-api-foundation/12.5-etagcacheinterceptor.md | NOT STARTED | etagCacheInterceptor — needs: none |
| 12.6 | phase-12-api-foundation/12.6-retryinterceptor.md | NOT STARTED | retryInterceptor — needs: none |
| 12.7 | phase-12-api-foundation/12.7-entitlementinterceptor-and-upgrade-event.md | NOT STARTED | entitlementInterceptor and upgrade event — needs: none (mock 402) |
| 12.8 | phase-12-api-foundation/12.8-metaservice-api-meta-with-dataset-signals.md | NOT STARTED | MetaService (`/api/meta`) with dataset signals — needs: `meta` |
| 12.9 | phase-12-api-foundation/12.9-symbolcapabilities-api-chart-symbol-meta.md | NOT STARTED | SymbolCapabilities (`/api/chart/{symbol}/meta`) — needs: `prices` |
| 12.10 | phase-12-api-foundation/12.10-appifdataset-appiffeature-structural-directives.md | NOT STARTED | `*appIfDataset` / `*appIfFeature` structural directives — needs: none |
| 12.11 | phase-12-api-foundation/12.11-data-info-popover-as-of-model-versions.md | NOT STARTED | "Data info" popover (as_of, model versions) — needs: `meta` |

### Phase 13 — Prices from the backend
Replaces the static `*.us.txt` files with `/api/chart/...` when the backend can serve them, keeping the file path as fallback.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 13.1 | phase-13-prices-from-backend/13.1-ohlcvapiclient-params-columnar-decode.md | NOT STARTED | OhlcvApiClient (params, columnar decode) — needs: `prices` |
| 13.2 | phase-13-prices-from-backend/13.2-backend-first-data-source-with-static-fallback.md | NOT STARTED | Backend-first data source with static fallback — needs: `prices` |
| 13.3 | phase-13-prices-from-backend/13.3-adjusted-price-toggle.md | NOT STARTED | Adjusted-price toggle — needs: `prices` + `adj_factor` |
| 13.4 | phase-13-prices-from-backend/13.4-server-weekly-monthly-bars.md | NOT STARTED | Server weekly/monthly bars — needs: `prices` (weekly) |
| 13.5 | phase-13-prices-from-backend/13.5-tier-truncation-notice.md | NOT STARTED | Tier truncation notice — needs: `prices` |
| 13.6 | phase-13-prices-from-backend/13.6-batch-ohlcv-for-compare-overlay.md | NOT STARTED | Batch OHLCV for compare overlay — needs: `prices` (batch) |
| 13.7 | phase-13-prices-from-backend/13.7-latest-quotes-for-header-and-watchlist.md | NOT STARTED | Latest quotes for header and watchlist — needs: `prices` (quotes) |
| 13.8 | phase-13-prices-from-backend/13.8-index-benchmark-data.md | NOT STARTED | Index benchmark data — needs: `index_prices` |
| 13.9 | phase-13-prices-from-backend/13.9-corporate-action-markers-split-dividend.md | NOT STARTED | Corporate-action markers (split/dividend) — needs: `corporate_actions` |
| 13.10 | phase-13-prices-from-backend/13.10-range-clamp-by-first-last-bar-and-delisting.md | NOT STARTED | Range clamp by first/last bar and delisting — needs: `prices` |

### Phase 14 — Server-side technicals and RS line
Uses the backend `technical_daily` series instead of calculating in the browser, without losing indicators the backend does not store.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 14.1 | phase-14-server-technicals/14.1-golden-fixture-parity-harness.md | NOT STARTED | Golden-fixture parity harness — needs: `technicals` |
| 14.2 | phase-14-server-technicals/14.2-technicalsapiclient-columnar.md | NOT STARTED | TechnicalsApiClient (columnar) — needs: `technicals` |
| 14.3 | phase-14-server-technicals/14.3-indicatorsource-abstraction-server-vs-client.md | NOT STARTED | IndicatorSource abstraction (server vs client) — needs: `technicals` |
| 14.4 | phase-14-server-technicals/14.4-use-server-sma-ema.md | NOT STARTED | Use server SMA/EMA — needs: `technicals` |
| 14.5 | phase-14-server-technicals/14.5-use-server-atr-and-volume-averages.md | NOT STARTED | Use server ATR and volume averages — needs: `technicals` |
| 14.6 | phase-14-server-technicals/14.6-price-location-overlays.md | NOT STARTED | Price-location overlays — needs: `technicals` |
| 14.7 | phase-14-server-technicals/14.7-ma-relation-badges.md | NOT STARTED | MA-relation badges — needs: `technicals` |
| 14.8 | phase-14-server-technicals/14.8-weekly-10w-40w-ma-from-server.md | NOT STARTED | Weekly 10w/40w MA from server — needs: `technicals` (weekly) |
| 14.9 | phase-14-server-technicals/14.9-rs-line-pane-from-rs-line.md | NOT STARTED | RS-line pane from `/rs-line` — needs: `relative_strength_history`, `index_prices` |
| 14.10 | phase-14-server-technicals/14.10-rs-line-new-high-marker.md | NOT STARTED | RS-line new-high marker — needs: `relative_strength_history` |
| 14.11 | phase-14-server-technicals/14.11-drop-redundant-client-compute.md | NOT STARTED | Drop redundant client compute — needs: `technicals` |

### Phase 15 — Screener v2
Schema-driven screener on top of `/api/screener/fields` and `run` v2. Fields not yet available show as "coming soon".

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 15.1 | phase-15-screener-v2/15.1-field-catalogue-client-and-types.md | NOT STARTED | Field catalogue client and types — needs: `screener` (fields) |
| 15.2 | phase-15-screener-v2/15.2-filter-tree-model-and-serializer.md | NOT STARTED | Filter tree model and serializer — needs: none |
| 15.3 | phase-15-screener-v2/15.3-filter-builder-ui-groups.md | NOT STARTED | Filter builder UI (groups) — needs: `screener` (fields) |
| 15.4 | phase-15-screener-v2/15.4-value-inputs-per-field-type.md | NOT STARTED | Value inputs per field type — needs: `screener` (fields) |
| 15.5 | phase-15-screener-v2/15.5-run-v2-with-sort-columns-cursor-paging.md | NOT STARTED | Run v2 with sort, columns, cursor paging — needs: `screener` (run v2) |
| 15.6 | phase-15-screener-v2/15.6-live-match-count.md | NOT STARTED | Live match count — needs: `screener` (count) |
| 15.7 | phase-15-screener-v2/15.7-column-chooser-persisted.md | NOT STARTED | Column chooser (persisted) — needs: `screener` (fields) |
| 15.8 | phase-15-screener-v2/15.8-presets-menu.md | NOT STARTED | Presets menu — needs: `screener` (presets) |
| 15.9 | phase-15-screener-v2/15.9-saved-screens-crud.md | NOT STARTED | Saved screens CRUD — needs: `application` (screens) |
| 15.10 | phase-15-screener-v2/15.10-export-csv-json.md | NOT STARTED | Export CSV/JSON — needs: `screener` (export) |
| 15.11 | phase-15-screener-v2/15.11-row-actions.md | NOT STARTED | Row actions — needs: none |
| 15.12 | phase-15-screener-v2/15.12-tier-gating-of-fields.md | NOT STARTED | Tier gating of fields — needs: `screener`, `entitlements` |
| 15.13 | phase-15-screener-v2/15.13-universe-selector-and-gate-explanation.md | NOT STARTED | Universe selector and gate explanation — needs: `security_master` (facets) |
| 15.14 | phase-15-screener-v2/15.14-v1-fallback-and-migration.md | NOT STARTED | v1 fallback and migration — needs: none |

### Phase 16 — Ratings and stock checkup
IBD-style ratings shown everywhere, plus the per-stock checkup page (plan §46).

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 16.1 | phase-16-ratings-checkup/16.1-ratingsapiclient-and-types.md | NOT STARTED | RatingsApiClient and types — needs: `ratings` |
| 16.2 | phase-16-ratings-checkup/16.2-rating-badge-component.md | NOT STARTED | Rating badge component — needs: none |
| 16.3 | phase-16-ratings-checkup/16.3-stock-header-ratings-strip.md | NOT STARTED | Stock header ratings strip — needs: `ratings` |
| 16.4 | phase-16-ratings-checkup/16.4-ratings-history-sparkline.md | NOT STARTED | Ratings history sparkline — needs: `ratings` (history) |
| 16.5 | phase-16-ratings-checkup/16.5-chart-legend-ratings.md | NOT STARTED | Chart legend ratings — needs: `ratings` |
| 16.6 | phase-16-ratings-checkup/16.6-screener-ratings-columns.md | NOT STARTED | Screener ratings columns — needs: `ratings` |
| 16.7 | phase-16-ratings-checkup/16.7-rating-distribution-slider-hints.md | NOT STARTED | Rating distribution slider hints — needs: `ratings` (distribution) |
| 16.8 | phase-16-ratings-checkup/16.8-leaders-widget.md | NOT STARTED | Leaders widget — needs: `ratings` (leaders) |
| 16.9 | phase-16-ratings-checkup/16.9-stock-checkup-page-skeleton.md | NOT STARTED | Stock checkup page skeleton — needs: `security_master` |
| 16.10 | phase-16-ratings-checkup/16.10-checkup-ratings-block.md | NOT STARTED | Checkup ratings block — needs: `ratings` |
| 16.11 | phase-16-ratings-checkup/16.11-checkup-technical-block.md | NOT STARTED | Checkup technical block — needs: `technicals`, `ratings` |

### Phase 17 — Fundamentals, filings and chart markers
Filings can ship first (already in the DB); financials follow the XBRL pipeline.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 17.1 | phase-17-fundamentals-markers/17.1-filingsapiclient.md | NOT STARTED | FilingsApiClient — needs: `sec_filing` |
| 17.2 | phase-17-fundamentals-markers/17.2-marker-layer-framework.md | NOT STARTED | Marker layer framework — needs: none |
| 17.3 | phase-17-fundamentals-markers/17.3-filing-markers.md | NOT STARTED | Filing markers — needs: `sec_filing` |
| 17.4 | phase-17-fundamentals-markers/17.4-earnings-markers.md | NOT STARTED | Earnings markers — needs: `financial_quarters` |
| 17.5 | phase-17-fundamentals-markers/17.5-quarterly-fundamentals-table.md | NOT STARTED | Quarterly fundamentals table — needs: `financial_quarters` |
| 17.6 | phase-17-fundamentals-markers/17.6-annual-table-and-cagr.md | NOT STARTED | Annual table and CAGR — needs: `financial_years` |
| 17.7 | phase-17-fundamentals-markers/17.7-earnings-mini-charts.md | NOT STARTED | Earnings mini-charts — needs: `financial_quarters` |
| 17.8 | phase-17-fundamentals-markers/17.8-fundamental-metrics-block.md | NOT STARTED | Fundamental metrics block — needs: `fundamental_metrics` |
| 17.9 | phase-17-fundamentals-markers/17.9-screener-fundamentals-filters.md | NOT STARTED | Screener fundamentals filters — needs: `fundamental_metrics` |
| 17.10 | phase-17-fundamentals-markers/17.10-restated-point-in-time-indicators.md | NOT STARTED | Restated/point-in-time indicators — needs: `financial_quarters` |

### Phase 18 — CAN SLIM, patterns and trade levels
Server-drawn overlays. The client draws what the backend computed; nothing is detected in the browser.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 18.1 | phase-18-canslim-patterns/18.1-canslim-client-and-gauge.md | NOT STARTED | CANSLIM client and gauge — needs: `canslim` |
| 18.2 | phase-18-canslim-patterns/18.2-reasons-list-pass-fail.md | NOT STARTED | Reasons list (pass/fail) — needs: `canslim` |
| 18.3 | phase-18-canslim-patterns/18.3-patternsapiclient-and-types.md | NOT STARTED | PatternsApiClient and types — needs: `patterns` |
| 18.4 | phase-18-canslim-patterns/18.4-read-only-system-overlay-layer.md | NOT STARTED | Read-only system overlay layer — needs: `patterns` |
| 18.5 | phase-18-canslim-patterns/18.5-base-box-pivot-line-buy-zone-band.md | NOT STARTED | Base box, pivot line, buy-zone band — needs: `patterns` |
| 18.6 | phase-18-canslim-patterns/18.6-cup-and-handle-path.md | NOT STARTED | Cup and handle path — needs: `patterns` |
| 18.7 | phase-18-canslim-patterns/18.7-double-bottom-and-flat-base-geometry.md | NOT STARTED | Double bottom and flat base geometry — needs: `patterns` |
| 18.8 | phase-18-canslim-patterns/18.8-breakout-failed-breakout-markers.md | NOT STARTED | Breakout / failed-breakout markers — needs: `breakouts` |
| 18.9 | phase-18-canslim-patterns/18.9-stop-zone-and-profit-zone.md | NOT STARTED | Stop zone and profit zone — needs: `patterns` |
| 18.10 | phase-18-canslim-patterns/18.10-sell-signal-markers.md | NOT STARTED | Sell-signal markers — needs: `sell_signals` |
| 18.11 | phase-18-canslim-patterns/18.11-personal-entry-price.md | NOT STARTED | Personal entry price — needs: `patterns`, `application` |
| 18.12 | phase-18-canslim-patterns/18.12-screener-pattern-and-canslim-filters.md | NOT STARTED | Screener pattern and CANSLIM filters — needs: `patterns`, `canslim` |
| 18.13 | phase-18-canslim-patterns/18.13-checkup-pattern-block.md | NOT STARTED | Checkup pattern block — needs: `patterns` |
| 18.14 | phase-18-canslim-patterns/18.14-overlay-toggle-panel.md | NOT STARTED | Overlay toggle panel — needs: none |

### Phase 19 — Industry groups and market state
Industry list can ship on facets alone; market state needs index data and the M engine.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 19.1 | phase-19-industries-market/19.1-industries-list-page.md | NOT STARTED | Industries list page — needs: `security_master` (facets) |
| 19.2 | phase-19-industries-market/19.2-industry-heat-map.md | NOT STARTED | Industry heat-map — needs: `industry_rating_history` |
| 19.3 | phase-19-industries-market/19.3-industry-detail-page.md | NOT STARTED | Industry detail page — needs: `industries` |
| 19.4 | phase-19-industries-market/19.4-checkup-industry-block.md | NOT STARTED | Checkup industry block — needs: `industries` |
| 19.5 | phase-19-industries-market/19.5-marketapiclient-and-banner.md | NOT STARTED | MarketApiClient and banner — needs: `market_state_history` |
| 19.6 | phase-19-industries-market/19.6-regime-shading-on-chart.md | NOT STARTED | Regime shading on chart — needs: `market_state_history` |
| 19.7 | phase-19-industries-market/19.7-distribution-and-follow-through-markers.md | NOT STARTED | Distribution and follow-through markers — needs: `distribution_days`, `follow_through_days` |
| 19.8 | phase-19-industries-market/19.8-breadth-panel.md | NOT STARTED | Breadth panel — needs: `market_state_history` |
| 19.9 | phase-19-industries-market/19.9-m-gating-hint-in-screener.md | NOT STARTED | M-gating hint in screener — needs: `market_state_history` |

### Phase 20 — Accounts, tiers and pricing
Ties into task 9.1. The pricing page and paywalls come from the backend, so plans can change without a release.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 20.1 | phase-20-accounts-tiers-pricing/20.1-real-auth-on-the-interceptor-stack.md | NOT STARTED | Real auth on the interceptor stack — needs: `auth` |
| 20.2 | phase-20-accounts-tiers-pricing/20.2-entitlementsservice.md | NOT STARTED | EntitlementsService — needs: `entitlements` |
| 20.3 | phase-20-accounts-tiers-pricing/20.3-plans-from-api-and-pricing-page.md | NOT STARTED | Plans from API and pricing page — needs: `plans` |
| 20.4 | phase-20-accounts-tiers-pricing/20.4-paywall-dialog.md | NOT STARTED | Paywall dialog — needs: none |
| 20.5 | phase-20-accounts-tiers-pricing/20.5-locked-feature-ui-patterns.md | NOT STARTED | Locked-feature UI patterns — needs: none |
| 20.6 | phase-20-accounts-tiers-pricing/20.6-billing-checkout-redirect.md | NOT STARTED | Billing checkout redirect — needs: `billing` |
| 20.7 | phase-20-accounts-tiers-pricing/20.7-usage-and-quota-display.md | NOT STARTED | Usage and quota display — needs: `entitlements` |

### Phase 21 — User data on the server
Move watchlists, layouts, drawings, alerts and settings from localStorage to the account.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 21.1 | phase-21-user-data-sync/21.1-storage-abstraction-local-vs-server.md | NOT STARTED | Storage abstraction (local vs server) — needs: none |
| 21.2 | phase-21-user-data-sync/21.2-watchlists-sync.md | NOT STARTED | Watchlists sync — needs: `application` |
| 21.3 | phase-21-user-data-sync/21.3-layouts-and-templates-sync.md | NOT STARTED | Layouts and templates sync — needs: `application` |
| 21.4 | phase-21-user-data-sync/21.4-drawings-sync.md | NOT STARTED | Drawings sync — needs: `application` |
| 21.5 | phase-21-user-data-sync/21.5-settings-sync.md | NOT STARTED | Settings sync — needs: `application` |
| 21.6 | phase-21-user-data-sync/21.6-server-side-alerts.md | NOT STARTED | Server-side alerts — needs: `application` (alerts) |
| 21.7 | phase-21-user-data-sync/21.7-first-login-migration-of-local-data.md | NOT STARTED | First-login migration of local data — needs: `application` |
| 21.8 | phase-21-user-data-sync/21.8-conflict-handling-409.md | NOT STARTED | Conflict handling (409) — needs: `application` |

### Phase 22 — Institutional, events and time machine
Later-stage datasets and the point-in-time features that depend on them.

| # | File | Status | Backend dataset needed / summary |
|---|---|---|---|
| 22.1 | phase-22-institutional-events-timemachine/22.1-institutional-client-and-block.md | NOT STARTED | Institutional client and block — needs: `institutional_metrics` |
| 22.2 | phase-22-institutional-events-timemachine/22.2-holders-table.md | NOT STARTED | Holders table — needs: `form13f_holdings` |
| 22.3 | phase-22-institutional-events-timemachine/22.3-events-client-and-chart-markers.md | NOT STARTED | Events client and chart markers — needs: `company_events` |
| 22.4 | phase-22-institutional-events-timemachine/22.4-catalyst-and-institutional-screener-filters.md | NOT STARTED | Catalyst and institutional screener filters — needs: `company_events`, `institutional_metrics` |
| 22.5 | phase-22-institutional-events-timemachine/22.5-asofservice-time-machine.md | NOT STARTED | AsOfService (time machine) — needs: any dated dataset |
| 22.6 | phase-22-institutional-events-timemachine/22.6-screener-as-of.md | NOT STARTED | Screener as_of — needs: `screener_snapshot` |
| 22.7 | phase-22-institutional-events-timemachine/22.7-chart-as-of-and-replay-integration.md | NOT STARTED | Chart as_of and replay integration — needs: `prices` |
| 22.8 | phase-22-institutional-events-timemachine/22.8-backtest-ui-later.md | NOT STARTED | Backtest UI (later) — needs: `backtest` |

## Re-audit of previously "completed" work (old Phase 1-2 claims)

- Old 1.1 "Charts Module Creation" — ChartsModule is an EMPTY, UNUSED NgModule
  in a standalone app. Re-scoped into 2.x. File slated for removal in 8.1.
- Old 1.2 "Core Services Setup" — ChartDataService exists but its URL builder
  produces `MSFT.US.us.txt` (double suffix) against a non-existent
  `src/assets/` dir. Fixed in 2.1. IndicatorCalculationService is a TODO stub
  (Phase 5, real port).
- Old 1.3 "Basic Chart Component" — component exists but cannot construct a
  chart (missing Chart.register, no date adapter, bad timestamps). Fixed in 2.x.
- Old 3.2 "Toolbar-Chart Integration (Completed)" — integration code exists but
  was never verified in a browser; chart never rendered, so the claim is false.
  Redone properly in 2.3.
- Old 6.1 "Routing Integration" — the `/charts/:symbol` route genuinely works
  (page loads, no redirect). The only honestly-done item. Kept.
- `app.spec.ts` — stale scaffold test ("Hello, demo-app") that fails today.
  Rewritten in 1.2.

## Superseded docs
- `PHASE1_COMPLETED.md` — contains false claims; corrected with re-audit header.
- `SUMMARY.md` — superseded by this index + per-phase docs; marked as such.
- `PLANNING_SUMMARY.md` — historical only.
