# Angular Unified Charting Application — Implementation Specification

## Table of Contents

- [1. Project Overview](#1-project-overview)
- [2. Backend API Endpoints (unchanged)](#2-backend-api-endpoints-unchanged)
- [3. Migrated Components & Their Responsibilities](#3-migrated-components--their-responsibilities)
  - 3.1 `CandlestickChartComponent` — Price + RSI dual-axis chart
  - 3.2 `StockDetailDrawerComponent` — Stock detail drawer
  - 3.3 `ScreenerPanelComponent` — Screener filters + results
  - 3.4 `WatchlistComponent` — Watchlist management
  - 3.5 `FundamentalsComponent` — Fundamental data display
- [4. Data Models (TypeScript Interfaces)](#4-data-models-typescript-interfaces)
- [5. API Service Layer](#5-api-service-layer)
- [6. Chart Rendering: The Critical Migration](#6-chart-rendering-the-critical-migration)
- [7. Authentication & Routing](#7-authentication--routing)
- [8. Build & Development Workflow](#8-build--development-workflow)
- [9. Testing Strategy](#9-testing-strategy)

---

## 1. Project Overview

**Goal:** Replace the Python desktop application (`screener/viewingApp/`) with a web-based Angular application that:

- Lives as `demo-app` directory under `/c/Users/kevin/Documents/Programming/demo-angular-project/`
- Communicates with the existing backend API (`stockscreenerapi` running on port 8000)
- Re-implements all charting in the browser using `chart.js` (no Python charts)

The backend is **production code** — it remains at its current `stockscreenerapi/` location and runs via FastAPI (`uvicorn`). The Angular app merely consumes its endpoints.

---

## 2. Backend API Endpoints (unchanged)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/user/profile` | GET | Returns authenticated user profile |
| `/api/user/account/delete` | POST | Delete account with verification |
| `/api/stocks/search?query=...` | GET | Symbol/name search |
| `/api/stocks/{symbol}` | GET | Company info (profile) |
| `/api/stocks/{symbol}/prices` | GET | OHLCV price history |
| `/api/stocks/{symbol}/technicals` | GET | RSI, MACD, SMA indicators |
| `/api/screener/run` | POST | Run custom screener |
| `/api/watchlists` | GET/POST | Watchlist CRUD |
| `/api/fundamentals/summary?symbols=...` | GET | Fundamental metrics |

The Angular app makes HTTP requests to these routes. All requests are proxied through the Angular dev server (in dev mode) or directly in production.

---

## 3. Migrated Components & Their Responsibilities

### 3.1 `CandlestickChartComponent` — Price + RSI Dual-Axis Chart

**Python equivalent:** `ViewingApp/MainWindow/ChartArea/TopChart` which contained

- `OHLCView` (QGraphicsView subclass)
- `OHLCItem` (QGraphItem with `draw()` reimplemented as a vertical bar for each OHLC record)
- Dual y-axis: left axis plots price scale, right axis plots RSI 0–100
- Tooltip on hover showing OHLC values
- Zoom and pan via QtGesture events

**Angular migration:**

- Use `chart.js` with the chartjs-financial adapter (already a npm dep)
- Use an Angular `<canvas>` element as the charting surface
- The RSI axis is rendered by adding a second dataset that shares the same x-axis but has its own y-axis definition. Chart.js handles dual-axis internally via `yAxes: [{ position: 'left' }]`. This allows us to plot OHLC bars on left and a line series (RSI) on right.
- Tooltip: use chart.js's built-in `tooltip.enabled = true`. Each dataset element can be configured with its own tooltip callbacks if needed.
- Hover: chart.js updates all dataset elements with `chart.legend.getElementAtEvent(e)`, but for OHLC you typically just show a generic tooltip because the plugin already draws bars.

**Code:**

```ts
import { Component, Input, OnChanges, ElementRef } from '@angular/core';
import { OHLCBar, DualAxisChartData } from '../../../shared/models/ohlc-bar.model';
import Chart from 'chart.js/auto';

@Component({
  selector: 'candlestick-chart',
  template: `<canvas [style.width.px]="width" [style.height.px]="height"></canvas>`,
  host: { style: 'user-select: none' }
})
export class CandlestickChartComponent implements OnChanges {
  @Input() width = 860; // matches Qt widget pixel size (700)
  @Input() height = 400;
  private chartInstance: Chart | null = null;
  private canvasRef: ElementRef<HTMLCanvasElement>;

// OHLC bar is { timestamp, open, high, low, close }
  @Input() bars: OHLCBar[] = [];
  @Input() ohlcLabel: string = 'Price (OHLC)';
  @Input() rsiData: number[] = []; // RSI values for dual-axis

  chartConfig: ChartConfig | null = null;

// Build a map of timestamp → OHLC object. Chart.js labels are strings.
  private convert(ohlcBars: OHLCBar[]): DualAxisChartData {
    const result: DualAxisChartData = {
      labels: ohlcBars.map(b => b.timestamp),
      datasets: [{
        type: 'bar',
        data: ohlcBars.map(b => {
          const p = b.bar; // bar has {open, high, low, close}
          return { x: p.close, open: b.bars.open };
            // Actually, for OHLC we pass arrays or single bars. chartjs-chart-financial expects an array
        }}]
    };
  }
// Simpler: use the financial adapter directly
  private convert(ohlcBars: OHLCBar[]): { labels: string[]; data: number[] } {
    return {
      labels: ohlcBars.map(b => formatDate(b.timestamp)),
      data: ohlcBars.map(b => b.bar.close)
    };
  }
}
```

**Key details:**

- `chartjs-chart-financial` provides an OHLC chart plugin that already knows to draw vertical bars from a `{open, high, low, close}` spec per data point.
- The RSI line dataset is added by appending `yAxes: [{position:'right'}]` so it shares the same x-axis (time index) but has its own value range.
- Color the red/green of bars based on whether closing price > opening price — this matches `OHLCItem.draw()` in Python which compares `item.open vs item.close`.

### 3.2 `StockDetailDrawerComponent` — Stock Detail Drawer

**Python equivalent:** `ViewingApp/MainWindow/DetailChartWidget` → `ScreenerTable + ResultChartWidget` inside the side panel of the main window.

In the Python app, a user clicks on a stock in `ScreenerTable`, and the details are drawn inside a drawer on the right. This is implemented as:

- A layout with a left pane (watchlist / screener)
- A right pane (detail view with chart).

**Angular migration:**

- Angular's `app-layout` has a drawer (`mat-drawer-side`) component. It's built-in to the Angular Material component library.
- In `app-routing.ts`, route `/stock/:ticker` → `dialog-stock-detail.component.ts`. The drawer slides in from the right and shows the candlestick chart + fundamental summary.

**Code:**

```html
<!-- app-layout.html -->
<header>...</header>
<main>
  <section [ngClass]="{open: drawerOpen}">
    <!-- Side panel with watchlist, screener -->
  </section>
  <section>
    <!-- Main price chart -->
  </section>
</main>
<mat-drawer-container sideDrawer="stock-detail-sidebar">
  <main [style.padding]="drawerOpen ? '24px' : '8px'">
    <router-outlet></router-outlet>
  </main>
  <mat-drawer mode="side" opened>
    <stock-detail-header></stock-detail-header>
    <ng-container *ngIf="selectedStock">
      <ng-container *ngIf="chartLoaded">
        <stock-detail-chart-bar></stock-detail-chart-bar>
      </ng-container>
      <ng-container *ngIf="detailLoaded">
        <stock-detail-data-table></stock-detail-data-table>
      </ng-container>
    </ng-container>
  </mat-drawer>
</mat-drawer-container>
```

### 3.3 `ScreenerPanelComponent` — Screener Filters & Results

**Python equivalent:** `ViewingApp/ScreenerPanel/ScreenerTable`.

**Angular migration:**

- Backend exposes `/api/screener/filters` which lists available filter criteria:

  ```python
  def get_filters() -> dict[str, FilterInfo]:
      """Return filter options from the screener service."""
      return {
          "dividend_yield": {"name": "Div/Yield %", "min": 0.1, "max": 10, ...},
          "pe_ratio": {"name": "P/E Ratio", "min": None, "max": None, "choices": [...]},
          ...
      }
  ```

- Build an Angular `ngForm` or `ReactiveFormsModule` with dynamic inputs. Each field in the form maps to a backend screener parameter.
- The results table displays rows with columns: symbol, name, price, change%, P/E, market cap, dividend, volume, etc.
- The drawer can be implemented as an `ngFor` list with `mat-row` elements that are clickable to open the detail drawer.

**Code:**

```ts
@Component({ selector: 'screener-panel', template: `...` })
export class ScreenerPanelComponent implements OnInit {
  private readonly api = inject(ApiService);
  filters: Record<string, FilterField> | null = null;
  results: Stock[] | null = null;

// Define the form model. Each key is a screener input param name.
  buildFilterInputs(): {
    [key: string]: { label?: string; type: string; options?: any[]; default?: any }
  } {
    if (!this.filters) throw new Error('Filters not loaded yet.');
    return Object.fromEntries(
      Object.entries(this.filters).map(([key, info]) => [
        key,
        {
          label: info.name,
          type: ['range','select','select-mult','text'].includes(info.type) ? info.type : 'string',
          options: info.choices?.slice(0, 50),
          default: info.default
        }
      ])
    );
  }

  submitFilters(criteria: ScreenerCriteria): void {
    this.results$ = this.api.post<ScreenerRunResponse>('/api/screener/run', criteria);
    // ... subscribe to results stream, update UI
  }
}
```

### 3.4 `WatchlistComponent` — Watchlist Management

**Python equivalent:** `ViewingApp/WatchlistPanel`.

In Python, the watchlist is a sidebar on the left showing a table of ticker symbols with add/remove buttons and a reorder feature.

**Angular migration:**

- Simple CRUD: POST `/api/watchlists`, GET `/api/watchlists` (GET returns an array)
- Angular component: a table with an `ngFor` rendering the array. Clicking "Add" opens a form or quick-add input for ticker symbols. Remove button removes from the array.

**Code:**

```ts
@Component({ selector: 'watchlist', template: `...` })
export class WatchlistComponent implements OnInit {
  private readonly api = inject(ApiService);
  watchlists: Watchlist[] = [];

  ngOnInit() {
    this.api.get<Watchlist[]>('/api/watchlists').subscribe(ws => this.watchlists = ws);
  }
}
```

### 3.5 `FundamentalsComponent` — Fundamental Display

**Python equivalent:** `ViewingApp/FundamentalsPanel`.

**Angular migration:**

- The backend has a route that returns fundamental values keyed by ticker symbol: `/api/fundamentals/summary?symbols=MSFT,AAPL,...`
- In Angular, bind the fundamental value object to a table or a set of metric cards (replacing the Python `QLabel` + `QFrame` widgets).

---

## 4. Data Models (TypeScript Interfaces)

**Note:** All models live under `demo-app/src/app/shared/models/`. No extra packages are needed — pure TypeScript and Angular's built-in types suffice.

```ts
// src/app/shared/models/stock.model.ts

export interface OHLCBar {
  timestamp: string;       // YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;        // optional
}

export interface StockSymbol {
  symbol: string;         // ticker
  name: string;           // company name
  exchange: string;       // e.g. "NASDAQ"
  sector?: string;
  industry?: string;
}

// Screener filter model — matches what the backend JSON response looks like.
export interface FilterField {
  name: string;
  description?: string;
  type: 'range'|'select'|'select-mult'|'text'|'datetime';
  min?: number;
  max?: number | null;
  default?: any;
  choices?: any[];       // e.g. ["Technology","Healthcare",...]
}

export interface ScreenerCriteria {
  [key: string]: any;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  changed_pct?: number;
  market_cap?: number;
  pe_ratio?: number;
  dividend_yield?: number;
  // include all the columns the backend returns
}
// ... additional models if needed
```

---

## 5. API Service Layer

**Location:** `src/app/core/services/api.service.ts` (already exists). It must include:

- A base URL that can be configured in `app.config.ts`. The default is `'http://localhost:8000'`.
- All HTTP requests should use a custom header `Authorization: Bearer <token>`, which is attached by the interceptors below.

**Code:**

```ts
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiUrl; // env provides a configurable endpoint string

  constructor(private http: HttpClient) {}

  get<T>(endpoint: string): Observable<T> {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
    return this.http.get<T>(`${this.baseUrl}/api${endpoint}`, { headers });
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    const headers = new Headers();
    headers.append('Authorization', `Bearer ${localStorage.getItem('auth_token')}`);
    return this.http.post<T>(`${this.baseUrl}/api${endpoint}`, JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

**Interceptors:**

`src/app/core/interceptors/auth.interceptor.ts`:

```ts
// Attach JWT token to every outgoing request automatically.
export function AuthInterceptor(h: HttpHandlerFn): HttpHandlerFn {
  return (request, next) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const cloned = request.clone({ setHeaders: { 'Authorization': `Bearer ${token}` } });
      return next(handle(cloned));
    }
    return next(request);
  };
}
```

`src/app/core/interceptors/error.interceptor.ts`:

```ts
// Global error handler. Redirect to login on 401, show an error message for other codes.
export function ErrorInterceptor(h: HttpHandlerFn): HttpHandlerFn {
  return (request, next) => {
    return next(handle(request)).pipe(
      catchError(err => {
        if (err.status === 401) {
          // Redirect to login or show an "Unauthenticated" banner.
          location.href = '/auth/login';
        }
        return throwError(err);
      })
    );
  };
}
```

---

## 6. Chart Rendering: The Critical Migration

**Goal:** Recreate the dual-axis OHLC chart from Python/Qt to Angular.

### 6.1. OHLC Data Conversion (Python)

The Python backend stores price history normalized into an in-memory dictionary keyed by date string:

```python
# From screener/database.py:199 → 203
data[key] = {
    'open': bars.open,
    'high': bars.high,
    'low': bars.low,
    'close': bars.close,
}
```

The chart receives `key` as `'yyyy-mm-dd'` and looks up the price by that key to fetch OHLC.

### 6.2. Angular: OHLC Bar Representation & Conversion to Array (JavaScript)

Python stores price history by day in a dictionary, but the frontend must convert that data into an array of OHLC bars for `chartjs-chart-financial` to consume:

```ts
// Convert price history object → [OHLCBar[]]

export function ohlcFromTimeSeries(priceObj: Record<string, { open:number; high:number; low:number; close:number }>) {
  return Object.entries(priceObj)
    .map(([date, values]) => ({
      timestamp: date,        // YYYY-MM-DD; chart.js will use this in the X axis
      open: values.open,
      high: values.high,
      low: values.low,
      close: values.close
    }));
}
```

The chart plugin consumes each OHLCBar as a single unit and renders a candle/bar per record.

### 6.3. RSI Line Chart (Python)

The `RSIItem` class in Python plots an indicator line from a data series `item.data` of shape `[1, len(values), values]`. It calls `self._linePlot()` to draw the series. The RSI value range is normalized 0–100; chart.js handles this via a second y-axis set with `position: 'right'`.

### 6.4. Angular: Dual-Axis Chart Using `chartjs-chart-financial`

```ts
import { DualAxisChartData, DualAxisChartAdapter } from 'chart.js';

const ctx = canvas.getContext('2d');
const chart = new Chart(ctx, {
  type: 'candlestick',
  data: {
    labels: ohlcData.labels,   // YYYY-MM-DD strings
    datasets: [
      {
        type: 'candlestick',
        label: 'Price',
        data: ohlcData.data,                    // array of OHLCBar objects
        yAxisID: 'y',
        colorizeMode: 'auto'                    // green/red per OHLC
      },
      {
        type: 'line',
        label: 'RSI',
        data: rsiData,                          // numeric array 0–100
        yAxisID: 'y1',                          // right axis
        borderColor: 'red',
        borderWidth: 2
      }
    ]
  },
  options: {
    scales: {
      y: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: 'Price' }
      },
      y1: {
        type: 'linear',
        position: 'right',
        title: { display: true, text: 'RSI' },
        max: 100,
        min: 0
      }
    }
  },
  plugins: {
    tooltip: {
      enabled: true
    },
    title: { display: false },
    legend: { position: 'top', labels: { usePointStyle: true } }   // matches QAbstractPlotItem.legend in Qt
  }
});
```

The chart is re-rendered on every data change (new bars loaded). Re-using existing angular charting infrastructure avoids reinventing the wheel.

---

## 7. Authentication & Routing

**Existing:** `src/app/core/auth/auth.service.ts` and `src/app/core/guards/auth.guard.ts` already exist. They use a JWT stored in localStorage.

**Add** to `app.routes.ts`: all routes are wrapped behind a JWT-guard route for all user-specific paths (`/auth/*` except login/register). The API service attaches the `Authorization: Bearer <token>` header with each request. The Angular app must store the token on a successful POST to `/api/auth/register` or `/api/auth/login` response and read it out again via `http.cookieStorageManager.getCookie('auth_token')` or just `localStorage`. The exact storage mechanism is already defined in `auth.service.ts`.

---

## 8. Build & Development Workflow

### Prerequisites

- Node.js 18.x or 20.x (verify with `node --version`)
- npm 9.x or latest (should come bundled with Node, or use `nvm` if you have it)
- Python 3.11+ and pip (for the backend) — already installed on the machine.

### Step-by-step setup:

```bash
# Step 1 — Ensure the Angular dependencies are installed:
cd /c/Users/kevin/Documents/Programming/demo-angular-project/demo-app
npm install

# Step 2 — If you have a development backend running, update your environment file:
echo "ApiUrl=http://localhost:8000" >> ./.env.development
# Copy it into the app.json config or a separate configuration file.

# Step 3 — Start the Angular dev server with proxy configured:
ng serve --configuration=development

# This starts ng serve with a built-in proxy to localhost:8000
```

The `api.service.ts` is typed to use `environment.apiUrl`, which can override at dev time via an `environment.json` (provided by Angular CLI).

### Step 4 — Backend API must be running:

```bash
cd /c/Users/kevin/Documents/Programming/stockscreenerapi
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

If this is your first time running the backend, also ensure PostgreSQL data and the schema (from `schema.txt`) are initialized as described in the backend README.

---

## 9. Testing Strategy

- Manual UI testing: open http://localhost:4200 in Chrome/firefox, verify auth login, check that charts render and update when fresh price bar data arrives.
- Unit tests: write unit tests for `api.service.ts` to confirm HTTP calls return correct types from mock responses.
- End-to-end: use browser DevTools network tab to confirm the `/api/stocks/:symbol` endpoint returns JSON with expected keys, that the OHLC array is parsed correctly, and chart rendering completes without browser console errors.

---

This document serves as the complete specification to implement the new Angular application. The Python charting logic is not needed here — everything is re-mapped to Angular components with standard `chart.js` libraries. The backend API remains fully unchanged; the frontend only consumes its endpoints through HTTP calls.