# Angular + Python Chart Viewer → Unified Angular Application
# **Comprehensive Merge Plan** | Author: Kevin | Repository: C:\Users\kevin\Documents\Programming\

---

## 📋 Executive Summary

You have 3 projects:
1. `stockscreenerapi/` — **Backend API** (Python/FastAPI + PostgreSQL) → **DO NOT TOUCH**
2. `screener/marketviewer-viewingapp` — Python desktop chart app → **Migrate to Angular**
3. `demo-angular-project/demo-app` — Angular frontend → **Core application shell**

The goal: migrate the Python chart functionality into Angular to create a single Angular web app that calls the backend directly via HTTP, consuming its JSON endpoints (JWT-protected). The backend must stay untouched and live as an external REST API.

---

## 🏗️ Architecture After Merge

```
┌──────────────────────────────────────────────────────────────┐
│                    Unified Angular Web App                      │
│  - Angular (Angular.json + demo-app/) → main SPA             │
│  - Chart.js + chartjs-chart-financial for financial charts    │
│  - Services layer (src/app/core/services) wraps REST calls    │
│  - Auth guard middleware for JWT                               │
├──────────────────────────────────────────────────────────────┤
│                      API Gateway / Proxy                        │
│  - @angular-builders/webpack-dev-server proxy rule:           │
│    ^/api → http://localhost:8000/api                          │
│  - Production: nginx/Apache proxy /api to backend              │
└──────────────────────────────────────────────────────────────┘

                            ↓ HTTP POST JSON / GET JSON

┌──────────────────────────────────────────────────────────────┐
│              PostgreSQL (schema defined in schema.txt)         │
│  - security_master (ticker/symbol → CIK mapping)             │
│  - fundamental_quarter_period + fundamental_quarter_metric    │
│  - corporate_actions, dividends                               │
│  └── accessed via backend API endpoints                         │
└──────────────────────────────────────────────────────────────┘
```

**Critical design decision:** The Python app's charting logic is **not** migrated to Python. Instead, it's re-implemented in Angular using `chart.js` and `chartjs-chart-financial`, communicating with the backend for data. This keeps everything in one technology stack with a single Angular CLI project.

---

## 📦 Project 2: Python App (`screener/marketviewer-viewingapp`) → Angular

### What Exists in Python

```
screener/viewingApp/
├── __init__.py
├── app.py                           # Entry point /gui
├── ViewingApp                       # PySide6 GUI application class
│   ├── MainWindow                   # Main window (QVBoxLayout)
│   │   ├── StatusWidget             # Title bar, status messages
│   │   │   └── StatusLabel
│   │   ├── HeaderBar               # Title + toolbar (+ Refresh, Export CSV)
│   │   └── ChartArea               # Main QPlotWidget (pyqtgraph charts)
│   │       ├── TopChart            # RSI / Price chart (dual y-axes)
│   │       │   ├── topAxis         # Price axis
│   │       │   │   └── OHLCView    # OHLC candlestick view, custom tooltips
│   │       │   │   └── OHLCItem    # QGraphItem subclass for candles
│   │       │   └── bottomAxis      # RSI indicator axis
│   ├── ChartDialog                 # Side dialog with selectable chart types
│   │       ├── ChartTabWidget      # Tabbed: Price vs RSI / Volume / Fundamentals
│   │       │   ├── PricevsRSITab   # Dual-axis combo chart
│   │       │   ├── VolumeChartTab   # Price + Volume dual bars
│   │       │   └── FundamentalTab  # P/E, EPS growth (column/bar charts)
│   ├── StockDialog                 # Single-stock detail dialog
│   │       ├── DetailTabWidget     # Price history, RSI technicals, fundamentals
│   │       └── ChartArea           # Embedded small chart for price/RSI
│   ├── ScreenerPanel              # Screener sidebar
│   │   └── ScreenerTable          # QTableView with filter inputs
│   │   └── ResultChartWidget      # Mini price/RSI chart for screener results
│   ├── FundamentalsPanel          # Fundamental data display panel
│   ├── WatchlistPanel            # Watchlist with add/remove stocks
│   ├── DataSettingsDialog        # API key / cache settings
│   └── config_file_handler.py    # JSON config file loader/saver
├── data/                          # Static image assets (no charts here)
├── download_daily.py             # CLI tool: downloads daily data
├── download_intraday.py          # CLI tool: fetches 5-min bars
└── viewing_app.cfg               # Settings file (API endpoints, paths)
```

### Migrate to Angular Modules & Components

| Python | Angular Equivalent | Notes |
|---|---|---|
| `MainWindow` | `AppModule` (root `AppComponent`) | Top-level shell component |
| `HeaderBar` | `app/layout/header.component` | `@FontAwesome` icons + action buttons |
| `TopChart` (`OHLCView`) | `app/features/stock/candlestick-chart/candlestick-chart.component` | Re-implement OHLC rendering in SVG/Canvas (chart.js plugin) |
| `PricevsRSITab` | `app/features/stock/tabs/price-rsi-tab.component` | Angular ReactiveForm binds to `Chart` model; emits data change to chart |
| `VolumeChartTab` | `app/features/charting/volume-chart.component` | Dual-bar chart (price vs volume) |
| `FundamentalTab` | `app/features/fundamentals/fundamentals.component` | Table + bar charts |
| `StockDialog` → `Detail` view | `app/features/stock/detail/dialog-stock-detail.component` | Or integrate directly into main layout as a drawer/side panel |
| `ScreenerPanel` | `app/features/screener/screener-panel.component` | Grid of filter chips + results table |
| `FundamentalsPanel` | `app/features/fundamentals/fundamentals-panel.component` | Key metrics widget |
| `WatchlistPanel` | `app/features/watchlist/watchlist.component` | Drag-and-drop watchlist management |
| `DataSettingsDialog` | `app/core/settings/settings-dialog.component` | Form with API key, refresh rate inputs |

### Angular Module Structure After Migration

```
demo-app/src/app/
├── core/
│   ├── services/
│   │   ├── api.service.ts                 # HTTP client (already exists)
│   │   ├── auth.service.ts                # AuthService (already exists)
│   │   ├── stock.service.ts              # Map OHLC bar → chart.data points
│   │   ├── screener.service.ts           # Call /api/screener/run endpoint
│   │   ├── watchlist.service.ts          # Manage watchlist list
│   │   └── settings.service.ts           # Load/save config to JSON file
│   ├── auth/
│   │   └── auth.service.ts               # (already exists)
│   ├── guards/
│   │   └── auth.guard.ts                  # (already exists)
│   └── interceptors/
│       ├── auth.interceptor.ts           # Attach JWT header to all requests
│       └── error.interceptor.ts          # Global error handling
├── features/
│   ├── auth/
│   │   ├── register/register.component.ts  # (already exists + migrate Python form)
│   │   ├── login/login.component.ts         # Migrate from Python dialog
│   │   ├── verify-email/verify-email.component.ts
│   │   └── registration-success/registration-success.component.ts
│   ├── home/home.component.ts                              # Landing page
│   ├── stock/
│   │   ├── candlestick-chart/candlestick-chart.component.ts # Migrate PricevsRSITab to Angular chart
│   │   └── detail/dialog-stock-detail.component.ts          # Migrate StockDialog
│   ├── screener/screener-panel.component.ts                 # Migrate ScreenerPanel
│   └── watchlist/watchlist.component.ts                     # Migrate WatchlistPanel
├── shared/
│   ├── models/
│   │   ├── stock.model.ts
│   │   ├── ohlc-bar.model.ts
│   │   └── screener-filters.model.ts
│   └── chart-models/
│       └── chart.interface.ts   # OHLCView + dualAxis model
├── app.component.ts              # (already exists)
├── app.routes.ts                 # (already exists)
└── styles.scss                   # Global styles
```

### Specific Component Migrations

**1. Candlestick Chart (`candlestick-chart.component.ts`):**

Reimplement `OHLCView` + `OHLCItem` in Angular using `chart.js` plugin:

```ts
// Convert OHLC bar → chart.data[]

@Component({ selector: 'candlestick-chart', template: `<canvas #chart></canvas>` })
export class CandlestickChartComponent {
  @Input() ohlcBars: OHLCBar[];
  // ohlcBars is OHLC structure, convert to [date, open, high, low, close] arrays for chart.js
  
  constructor(private http: HttpClient) {}
  
  ngOnInit() {
    this.chart = new Chart(chart.nativeElement, {
      type: 'bar',
      data: {
        labels: ohlcBars.map(b => b.timestamp),
        datasets: [{
          label: 'Price (OHLC)',
          backgroundColor: ctx => {
            const p = ctx.raw;
            return p.open < p.close ? '#26a69a' : '#e53935';
          }
        }]
      }
    });
  }
}
```

**2. Screener Panel:**

```ts
@Component({ selector: 'screener-panel', template: `...` })
export class ScreenerPanelComponent implements OnInit {
  private api = inject(ApiService);
  private readonly filters$ = this.api.get<ScreenerFiltersResponse>('/api/screener/filters').pipe(take(1));
  private readonly results$ = new Subject<Stock[]>();

  ngOnInit() {
    this.filters$.subscribe((res) => {
      // Build filter model from backend response structure
      // Render filter checkboxes/selects
    });
  }

  private buildFilterForm(filters: any): ReactiveFormsModule {
    // Map backend filter options → Angular form controls
    // e.g. filters['pe_ratio'].choices = [1,2,3] → select[multiple=true]
  }
}
```

Migrate `ScreenerTable` to an Angular data grid using a native `ngFor` table with:
- Sortable columns
- Column visibility toggle
- Sticky header with filter inputs

**3. Stock Dialog:**

Convert `StockDialog` to a sidepanel/drawer (`app/features/stock/detail/drawer-stock-detail.component`) that slides in from the right, replacing the dialog modality.

**4. Fundamentals Panel:**

The Python fundamental panels are migrated to Angular using `chart.js` for visualizations (P/E history, EPS growth charts). The schema definition in PostgreSQL defines which fields appear in the fundamentals panel.

---

## 📦 Project 3: Angular Frontend (`demo-angular-project/demo-app`) → Unified App Shell

### What Already Exists

The Angular project already has a basic structure we'll leverage:

```json
{
  "dependencies": {
    "@angular/common": "^21.0.0",
    "@angular/router": "^21.0.0",
    "chart.js": "^4.5.1",
    "chartjs-adapter-date-fns": "^3.0.0",
    "chartjs-chart-financial": "^0.2.1",
    "date-fns": "^4.1.0"
  }
}
```

### What to Add (Packages)

**Step A: HTTP client & interceptors**

Angular already has `HttpClient` built-in. No extra package needed.

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, retry, delayWhen, take } from 'rxjs/operators';
```

**Step B: Form handling (for screener filters)**

Add `reactiveFormsModule` if not already present. Check `package.json`:

- If Angular ^20+, you need to install `@angular/forms`. It's likely already there; confirm in the project's `package.json`.

**Step C: Drag-and-drop watchlist (optional, nice-to-have)**

```bash
npm install @angular/cdk dragula
# or use pure DnD without a library if simpler
```

But for a clean integration, the watchlist can be a simple table with add/remove buttons—drag-and-drop is not strictly required.

**Step D: DataTables-style table**

For screener results table, Angular uses native DOM. Render a plain `ngFor` table, but implement sort/filter functionality. If you want advanced features, consider `angular-datatables` or similar. For now, implement with pure Angular data grid (no extra dependency).

### Route Configuration

Merge the existing routes (`app/routes.ts`, etc.) into the final merged app:

- `/auth/register` → Register form
- `/auth/login` → Login form
- `/auth/verify-email` → Email verification page
- `/stock/:symbol` → Stock detail view (candlestick chart, fundamentals panel)
- `/watchlist` → Watchlist management
- `/screener` → Screener panel
- `/fundamentals` → Fundamentals data
- `/home` → Landing page

### Authentication Flow

The Angular app must respect JWT authentication from the backend.

#### AuthInterceptor (add to `demo-app/src/app/core/interceptors/auth.interceptor.ts`)

```ts
import { HttpHandlerFn, HttpEvent, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export function jwtAuthInterceptor(handler: HttpHandlerFn): HttpHandlerFn {
  return async (req: HttpRequest<any>, next: HttpHandler) => {
    const token = localStorage.getItem('auth_token'); // stored in Angular auth flow
    if (!token) {
      // Redirect to login if unauthorized
      return next.handle(req.clone());
    }
    const authReq = req.clone({
      setHeaders: { 'Authorization': `Bearer ${token}` }
    });
    return next.handle(authReq);
  };
}
```

#### Logout handling (add to `app.component.ts` or a dedicated logout service)

When the user logs out, clear the token and localStorage, then redirect to `/auth/login`.

---

## 🔄 Development Server Setup

### Prerequisites on This Machine

- Node.js: 18.x or 20.x (check with `node --version`)
- npm: 10.x or latest (likely already installed via Node)
- Python 3.11+ is used for the backend → no need to reinstall
- PostgreSQL server running (schema defined in `schema.txt`)
- Backend API accessible at `http://localhost:8000` (or whatever port is defined)

### Step-By-Step To Spin Up Development Environment

**1. Navigate to merged project:**

```bash
cd /c/Users/kevin/Documents/Programming/demo-angular-project/demo-app
```

**2. Install dependencies:**

```bash
npm install
```

**3. Configure proxies (in `angular.json` or a `server.config.js`):**

Add a development server proxy so `/api` requests go to the backend:

```json
"server": {
  "config": {
    "proxies": [{
      "/api": {
        "target": "http://localhost:8000",
        "secure": false,
        "changeOrigin": true
      }
    }]
  }
}
```

**4. Start the Angular dev server:**

```bash
ng serve --host 0.0.0.0 --port 4200 --configuration=development
```

**5. If you need TypeScript errors resolved, ensure your backend is running:**

Start the backend in a separate terminal:

```bash
cd /c/Users/kevin/Documents/Programming/stockscreenerapi
uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

**6. Open browser to:** `http://localhost:4200` for the Angular app.

---

## 📁 Final Merged Project Directory Structure

```
/c/Users/kevin/Documents/Programming/
├── schema.txt                                          ← PostgreSQL schema reference
├── backend_api/                                        ← stockscreenerapi (untouched)
│   ├── app.py                                          ← main entry
│   ├── routes/
│   │   ├── auth.py
│   │   └── ...
│   └── requirements.txt
├── screener/                                           ← Python desktop app (deprecated, legacy artifact)
│   └── viewingApp/                                     ← keep for reference only
├── demo-app/                                           ← unified angular project
│   ├── src/
│   │   └── app/
│   │       ├── core/
│   │       │   ├── services/
│   │       │   ├── auth/
│   │       │   ├── guards/
│   │       │   └── interceptors/
│   │       └── features/
│   │           ├── auth/...
│   │           ├── stock/...
│   │           ├── screener/...
│   │           └── watchlist/...
│   ├── package.json                                    ← with all Angular deps
│   └── angular.json
└── INTEGRATION_PLAN.md                                 ← THIS FILE
```

---

## 🧩 Summary of What To Build

| Task | File Location | Notes |
|------|---------------|---|
| **HTTP client** | `src/app/core/services/api.service.ts` | Already exists |
| **Auth guard** | `src/app/core/guards/auth.guard.ts` | Already exists |
| **Candlestick chart** | `features/stock/candlestick-chart.component` | Reimplement dual-axis OHLC chart |
| **Screener panel** | `features/screener/screener-panel.component` | Filter inputs + results table |
| **Watchlist component** | `features/watchlist/watchlist.component` | Add/remove stocks from list |
| **Fundamentals panel** | `features/fundamentals/fundamentals.component` | Display key metrics + charts |
| **Settings dialog** | `core/settings/dialog-settings` | Store API keys in JSON config file |

All components call the backend via `/api/...` endpoints exposed through the Angular proxy to the running FastAPI server.

---

## 📋 Next Steps for Implementation

1. Create new Angular modules under `demo-app/src/app/features`
2. Implement each component using Angular Reactive Forms and `HttpClient`
3. Wire up the Angular proxy in `angular.json` so `/api` requests forward to the backend
4. Test the full end-to-end flow: auth → screener → chart → watchlist
5. Refine the UI/UX as needed

---

This plan covers everything needed to merge the two frontend projects into a single Angular application while leaving the backend untouched and production-ready for deployment.
