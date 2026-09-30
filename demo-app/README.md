# Stock Screener — Charts

Angular 21 (standalone components, zoneless) demo app: a stock screener plus a TradingView-style **chart viewer** —
candlesticks, volume and technical indicators in one zoomable panel — ported from a Python chart viewer.

## Quick start

```bash
npm ci
npm start                 # ng serve → http://localhost:4200
npm test                  # unit tests (Vitest via ng test), 480 specs
npm run test:coverage     # unit tests + 80% coverage gate on core/, charts/, app.ts
npm run e2e               # Playwright suite (starts ng serve itself)
npm run e2e:prod          # production build + smoke tests against the static bundle (:4300)
npm run build             # production build → dist/demo-app
```

The Playwright runner uses its own Chromium. If that isn't installed, point it at any Chromium:
`CHROMIUM_PATH=/path/to/chromium npm run e2e`.

## Demo data & login

- **Login** (client-side demo auth, no backend): `admin@demo.angular-project.local` / `changeme`.
- **Chart symbols** — Stooq daily files served from `public/test-data/`: `ia`, `msft`, `mu`, `nvda`, `pltr`, `qqew`, `qqq`, `qqqe`.
  Anything else (e.g. `/charts/aapl`) shows an error card listing these.
- Screener / stock / profile pages talk to a backend that does not ship with this repo (see `API-BACKEND-SPEC.md`).

## Connecting to your backend (localhost:3000)

The app calls `http://localhost:3000` by default (`src/app/core/api-url.ts`); to use another URL add
`<meta name="api-url" content="https://api.example.com">` to `src/index.html` (per deployment, no rebuild logic needed).

1. Start your backend on port 3000, then `npm start` (Angular on http://localhost:4200).
2. `npm run backend:check` (or `npm run backend:check -- http://host:port`) verifies reachability, **CORS for the Angular origin**
   (it must allow the request headers `Authorization`, `If-None-Match`, `Content-Type` and expose `ETag`, `Retry-After`) and the `/api/meta` shape.
3. Open http://localhost:4200/diagnostics: it lists which datasets the backend has switched on (from `GET /api/meta`) and what the plan unlocks.
   Anything the backend doesn't serve yet degrades silently to the built-in demo data; no endpoint is required to exist.
4. Optional end-to-end check against your real server: `LOCAL_BACKEND=1 npx playwright test e2e/local-backend.spec.ts`.

The contract the backend should serve is in `docs/api/`; the plan is `docs/DATA-PLAN.md`.

## Chart viewer at a glance

- `/charts/:symbol` fills the whole viewport (compact navbar, no footer, no page scroll).
- Price, volume and indicator panes are **one Chart.js chart** with stacked y-scales: one x-axis, grid, zoom and crosshair.
- Wheel/pinch zoom, drag pan, double-click to reset, range presets (1M…ALL), daily/weekly bars.
- Chart types (candles, OHLC bars, line, area), crosshair with axis price label + magnet mode, PNG snapshot, fullscreen.
- TradingView-style legend per pane (hovered-bar OHLC, indicator values, eye toggle, remove) and drawing tools
  (trend line, horizontal ray, parallel channel — select/drag/delete, kept per symbol).
- Indicators (SMA, EMA, WMA, RMA overlays; RSI, ATR, Webby RSI, Bob Marley in their own panes) — golden-value
  tested against the Python calculators.
- Smooth on 10k+ bars: only a window around the visible range is handed to Chart.js, aggregated into ≤ ~500 candles.
- Light and dark themes (TradingView-style dark palette): navbar toggle cycles system → light → dark; `system` follows the OS.
  Every colour lives in `src/styles/theme.scss`; a guard spec fails on any hardcoded colour anywhere in `src/app`.

## Project layout

```
demo-app/
├─ src/app/
│  ├─ charts/            chart-viewer, chart-toolbar, indicator-panel, chart-lod.ts, chart-theme.ts, chart-setup.ts
│  ├─ core/
│  │  ├─ auth/           AuthService (demo)      ├─ guards/  authGuard, subscription guards
│  │  ├─ indicators/     calculators, math kernels, definitions, catalog (+ golden fixtures)
│  │  ├─ services/       chart-data, chart-state, indicator-calculation, data-aggregation, api, screener, stock, user
│  │  └─ subscriptions/  tiers + service (pricing page)
│  ├─ features/          auth pages, home, pricing, profile, screener, stock (legacy pages)
│  └─ pages/homepage
├─ src/styles/theme.scss all colour/shape tokens (single source; enforced by src/styles.spec.ts)
├─ public/test-data/     Stooq demo data
├─ e2e/  e2e-prod/       Playwright suites (dev server / production bundle)
├─ scripts/              gen_indicator_fixtures.py (golden values from the Python code), check-coverage.cjs, serve-dist.cjs
├─ docs/                 ARCHITECTURE.md, PORT-INVENTORY.md, screenshots/
└─ TASKS/                one file per task + the status index (TASKS/README.md)
```

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — components, routing, state/data flow, Chart.js integration.
- [`TASKS/README.md`](TASKS/README.md) — authoritative task index and per-task verification evidence.
- [`docs/PORT-INVENTORY.md`](docs/PORT-INVENTORY.md) — what was ported from the Python viewer and what was not.
- `SUMMARY.md`, `PHASE1_COMPLETED.md`, `PLANNING_SUMMARY.md`, `TASKS.md` are **historical** (contain false claims; see their headers).

## Troubleshooting

- Port 4200 busy: `ng serve --port 4300`.
- Blank chart after changing data files: hard-reload; the chart state (symbol/range/indicators) is kept in `sessionStorage` under `chart-state` — clear it to reset.
- `npm run e2e` says the browser executable is missing: set `CHROMIUM_PATH` (see above).
