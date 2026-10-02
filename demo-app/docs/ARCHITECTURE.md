# Architecture

Evidence for behavioural claims is the named test (unit: `*.spec.ts`; browser: `e2e/*.spec.ts`), or a screenshot in `docs/screenshots/`.

## Shape of the app

Standalone components only (no NgModules), zoneless change detection. `App` (`src/app/app.ts`) hosts the navbar, footer
and `<router-outlet>`; feature pages are lazy-loaded (`app.routes.ts`).

| Route | Component | Guard |
|---|---|---|
| `/`, `/home` | `pages/homepage` | – |
| `/charts/:symbol` | `charts/chart-viewer` (`data.fullscreen`) | – |
| `/screener`, `/profile`, `/stock/:symbol` | `features/*` | `authGuard` (→ `/auth/login?returnUrl=…`) |
| `/pricing` | `features/pricing` | – |
| `/auth/{login,register,registration-success,verify-email}` | `features/auth/*` | – |
| `**` | redirect to `/home` | – |

Routes with `data.fullscreen` make the shell exactly viewport-sized (compact navbar, no footer, no scroll)
— `e2e/layout.spec.ts` (4 viewport sizes).

## State + data flow (charts)

```
 Stooq .txt  ──HTTP──▶ ChartDataService ──parse/sort ASC──▶ OHLCV[]  (one fetch per symbol, full history)
                                                              │
 Toolbar / IndicatorPanel / error-card ──write──▶ ChartStateService ──state$──▶ ChartViewerComponent
        (symbol, interval, range, indicators; persisted in sessionStorage 'chart-state')      │
                                                                                                ▼
        weekly? aggregateWeeklyWFri ─▶ bars ─▶ IndicatorCalculationService (on the SAME bars)
                                                    │
                          view = range preset (index window)      ┌───────────────┴───────────────┐
                                                                  ▼                               ▼
                                  chart-lod: window + bucket ≤ ~500 points     overlays → price y-scale, panes → stacked y-scales
                                                                  └───────────────┬───────────────┘
                                                                                  ▼
                                                                    ONE Chart.js instance / canvas
```

- **State** (`chart-state.service.ts`): single source of truth; toolbar, indicator panel and the error card only *write*;
  the viewer *derives* loads/renders. Symbol/interval change → refetch/re-aggregate; range or indicator change → re-render from
  cache (an indicator-only change keeps the user's pan/zoom). Malformed persisted entries are dropped on rehydrate.
  Tests: `chart-state.service.spec`, `chart-toolbar.component.spec`, viewer "toggling an indicator keeps the … view".
- **Data** (`chart-data.service.ts`): URL `test-data/<sym>.us.txt`; timestamps are UTC epoch ms; HTTP errors map to `[]`
  (viewer distinguishes *unknown symbol* from *no data* via `AVAILABLE_SYMBOLS`). Tests: `chart-data.service.spec`.
- **Aggregation** (`data-aggregation.ts`): W-FRI weeks, last-bar-anchored range presets (ports of the Python viewer).

## Chart.js integration (`src/app/charts`)

- `chart-setup.ts` registers controllers/scales/adapter/zoom **before** `chartjs-chart-financial` is imported (ESM/CJS dual-package hazard; documented in the file).
- **One panel:** price, volume and indicator panes are stacked y-scales (`stack:'panel'` + `stackWeight`) of one chart, so they share
  the x-axis, grid, zoom state, tooltip and crosshair. The x-scale is *linear over bar index* (category scales break under the zoom
  plugin's numeric min/max; indices also remove weekend gaps); tick labels map index → date. (`chart-viewer.component.spec` "ONE PANEL",
  `e2e/chart.spec` "renders real pixels".)
- **Level of detail** (`chart-lod.ts`): the chart holds only the visible window ± half a span, aggregated (OHLCV) into ≤ ~500 buckets aligned
  to global multiples. A plugin runs `syncView` in `beforeUpdate` (load the window) and `fitYAxes` in `beforeLayout` (fit y to visible bars)
  so each pan/zoom frame is a single render. Gotchas: Chart.js caches scale user bounds at init (`_userMin/_userMax`) and the first update
  runs inside the constructor. (`chart-lod.spec`, viewer "LOD", `e2e/layout.spec` "pan … smooth".)
- **Plugins** (module scope in `chart-viewer.component.ts`): `crosshair` (dashed line through all panes), `paneDecor` (separators + pane labels).
- **Theme:** canvas colours are read from CSS custom properties at draw time (`chart-theme.ts`); the only colour literals live in
  `src/styles/theme.scss` (light + opt-in dark). `src/styles.spec.ts` fails on new literals (legacy pages capped by a ratchet).
  (`e2e/states-and-theme.spec` light + dark.)

## Theme, legend, tools, drawings (Phase 10)

- **Theme** (`core/theme/theme.service.ts`): mode `system | light | dark`, applied as `<html data-theme>`; palette in `styles/theme.scss`
  (`:root[data-theme='dark']` = TradingView-style). A pre-paint script in `index.html` prevents a flash. `styles.spec.ts` allows NO colour
  literals in app code and requires the dark palette to cover every theme-dependent token. (`e2e/states-and-theme.spec`.)
- **Legend** (`charts/chart-legend`): HTML overlay, one group per pane; the viewer feeds hovered-bar index (`legendFeed` plugin) and pane
  tops; the eye toggle is a persisted `hidden` flag on the indicator state entry. (`chart-legend.component.spec`, `e2e/chart.spec` legend test.)
- **Chart types / tools**: `chartType` + `magnet` in the chart state; crosshair plugin draws the horizontal line, axis price label and magnet snap;
  snapshot = canvas PNG download; fullscreen; double-click resets zoom.
- **Drawings** (`charts/drawings`): anchors are (timestamp, price) so they survive interval/zoom/LOD changes; `DrawingController` is a DOM-free
  pointer/keyboard state machine; a canvas plugin renders them clipped to the price pane; pan is disabled while a drawing tool is active.
  Since 11.7 every tool is a registry entry (`drawing-tools.ts`) whose anchors become pure shapes (`drawing-shapes.ts`); the same shapes are painted and hit-tested.

## Indicators (`src/app/core/indicators`)

`indicator-math.ts` reproduces pandas semantics (ewm `adjust=False`/`min_periods`, rolling) — not textbook formulas;
`indicator-calculators.ts` ports MA/RSI/ATR/Webby RSI/Bob Marley; `indicator-definitions.ts` mirrors the Python registry
(params, outputs, pane policy); `indicator-catalog.ts` maps persisted `{type, period}` state entries to a calculator and a placement
(overlay vs own pane). `IndicatorCalculationService` is the registry-shaped facade. Correctness evidence: golden fixtures generated by the
real Python calculators (`scripts/gen_indicator_fixtures.py`), matched within 1e-6 (`indicator-calculation.service.spec`).

## Testing & quality gates

| Gate | Command | Evidence |
|---|---|---|
| Unit | `npm test` | 208 specs |
| Coverage | `npm run test:coverage` | 93.8% stmts / 84.5% branches (gate 80%) |
| Browser e2e (dev) | `npm run e2e` | 27 Playwright tests |
| Production bundle | `npm run e2e:prod` | build without warnings + smoke, `docs/screenshots/8.3-prod-*.png` |
| Token guard | part of `npm test` | `src/styles.spec.ts` |

## Known gaps

- Feature pages (screener/stock/profile/auth) still carry hardcoded colours (ratchet in `src/styles.spec.ts`) and depend on a backend that
  isn't in this repo; auth is client-side demo auth (task 9.1). `ApiService` hardcodes a LAN backend URL.
- Indicator editing beyond add/remove (recolour, reorder, per-interval visibility, parameters for Webby/Bob Marley) is v2.

## Contract fixtures and mock backend (task 12.2)
`docs/api/fixtures/*.json` are example responses of the v2 API contract (`docs/api/`). `e2e/mock-api.ts` exposes
`mockApi(page, { datasets, tier, errors, overrides, onRequest })`, which fulfils `/api/**` from them in Playwright so
front-end tasks are verified without a backend (toggle datasets, tier, inject 402/429/503). Unit checks of the fixtures'
conventions live in `src/app/core/api/fixtures.spec.ts`. The same fixtures become the backend's contract tests (task 23.2).

## API layer (Phase 12, `src/app/core/api/`)
Everything that talks to the (future) backend goes through `provideHttpClient(withInterceptors([...]))` in `app.config.ts`:
`errorInterceptor` (typed `ApiError`, single toast, `SILENT_ERRORS` for optional calls) → `entitlementInterceptor` (402 → `UpgradeService`)
→ `retryInterceptor` (GET 429/503/network) → `etagCacheInterceptor` (`ETagCache`, 304) → `authInterceptor` (Bearer, shared refresh via `TokenRefresher`/`TokenStore`).
Discovery state lives in `MetaService` (`GET /api/meta`), `SymbolCapabilities` (`GET /api/chart/{symbol}/meta`) and `EntitlementsService`;
UI gating via `*appIfDataset` / `*appIfFeature` (`shared/gating`); typed clients such as `OhlcvApiClient` sit next to them.
Types mirror `docs/api/`; fixtures in `docs/api/fixtures` feed both unit specs and the Playwright `mockApi`. Current state and next steps: `docs/HANDOFF.md`.
