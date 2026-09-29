# Angular Unified Stock Screener — Implementation Plan & Tasks
## Comprehensive Guide

---

## Executive Summary

**Goal:** Build a complete web app in `demo-angular-project/demo-app` that re-implements all features of the Python chart viewer. The backend API (`stockscreenerapi`) remains untouched and serves as the sole source of truth for all data.

**Architecture:** Angular SPA → HTTP Client → FastAPI REST Backend → PostgreSQL

---

## Directory Structure

```
C:/Users/kevin/Documents/Programming/
├── stockscreenerapi/          # Backend (DO NOT MODIFY)
│   ├── app.py
│   └── routes/*.py            # Define all endpoints here
├── screener/viewingApp/       # Legacy Python desktop app (reference only)
├── demo-angular-project/
│   └── demo-app/              # NEW unified Angular application
│       ├── src/app/core/services/
│       ├── src/app/features/stock/
│       ├── src/app/features/screener/
│       ├── src/app/watchlist/
│       └── src/app/stock-fundamentals/
└── IMPLEMENTATION_PLAN.md
```

---

## Tasks List

Each line below is a single, complete task. "First step = TESTS."

1. **Define TypeScript models that exactly mirror backend JSON responses.**  
   - Create `OHLCBar.ts`, `StockProfileResponse.ts`.  
   - Create `ScreenerFilterOption.ts` + `ScreenerResultRow.ts`.  
   - Create `WatchlistItem.ts` + `FundamentalMetricRow.ts`.  

2. **Create `CandlestickChartComponent` TypeScript file.** Use `chart.js` to render price bars and an RSI line on the same canvas (dual axis). Provide input bindings `@Input() ohlcBars: OHLCBar[]; @Input() rsiValues: number[];`. Handle red/green coloring per bar based on close vs open.

3. **Create `ScreenerPanelComponent` TypeScript file.** Bind a ReactiveForm model to a set of filter inputs (e.g. dividend yield range, P/e multiple, sector). Wire a button click handler that POSTs `/api/screener/run` and subscribes to the returned `Stock[]|ScreenerResultRow[]` array for display in an Angular template `<table>`.

4. **Create `WatchlistComponent` TypeScript file.** Implement add/remove/edit functions for stock tickers. Each item must show ticker+name, last price, change percentage.

5. **Create `FundamentalsPanelComponent` TypeScript file.** Display key metrics: market cap, P/E ratio, dividend yield, beta, EPS TTM. Provide a toggle to show column-by-column breakdown of each metric vs peer average or median.

6. **Create `StockDetailDrawerComponent` TypeScript file.** Use `@angular/material/drawer` as the side panel. When docked, show full price history with interactive OHLC chart; when undocked (dragged to top-right), show a small inline mini-chart. Provide a "share image" button that calls an external graphing service with the chart URL for embedding in social posts or newsletters.

7. **Wire up `api.service.ts` proxy configuration** so that `/api/stocks/:symbol`, `/api/screener/run`, and all watchlist endpoints forward requests to FastAPI at port 8000. Add interceptor logic that attaches JWT Bearer headers from `localStorage`.

8. **Write end-to-end integration test for the candlestick chart.** Render OHLC bars, verify that the canvas emits an HTML export with correct red/green coloring per bar. Assert that the RSI line overlays correctly on the secondary y-axis.

9. **Write unit tests for `ScreenerPanelComponent` form model.** Ensure form inputs bind correctly to the backend's filter response schema. Simulate a POST request and assert that the component updates with the correct result payload (mocked).

10. **Write unit tests for `WatchlistComponent` CRUD logic.** Test adding a new stock, updating its reorder position, removing an item, and verifying that the array re-flattens correctly after removal.

11. **Write unit tests for `FundamentalsPanelComponent`.** Verify that column toggling (pe ratio, earnings growth, dividend yield) correctly hides/shows columns in a `<table>` grid.

12. **Run `ng build --configuration production`** and capture any compilation errors or type-check warnings for manual review by Kevin and the team.

13. **Perform an end-to-end integration test of the full app.** Launch the dev server, open Chrome DevTools, navigate to login → screener → detail drawer → watchlist. Verify that each step renders without runtime errors, that all API calls receive valid JWT tokens and return JSON responses, and that the chart canvas correctly renders OHLC bars before switching between price, volume, fundamental tabs.

---

## Notes & Dependencies

- The `charts` npm package is assumed to already be listed in `package.json` under devDependencies. Install it with `npm install chartjs-chart-financial chart.js date-fns`.
- Do not edit any file inside the backend repo. All logic resides in frontend-only TypeScript services, components, and directives.
- When the Angular proxy rules are in place, no changes to the backend are necessary: simply `uvicorn app:app` and let requests from the browser go through Angular's proxy.
- Keep the existing auth middleware unchanged; it is expected that the backend will emit a JWT payload with fields `exp`, `nbf`, `iat`. The Angular app stores this token in `localStorage` under key `'auth_jwt'` and reuses it on all outgoing requests.

---

## End of Document
