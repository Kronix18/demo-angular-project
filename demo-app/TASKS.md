# TASK LIST FOR ANGULAR + PYTHON CHART VIEWER INTEGRATION

> ⚠️ **SUPERSEDED 2026-09-23.** This file is kept for history only. It contains
> duplicate task numbers (two "3.2"s, two "Phase 6"s), false "(Completed)"
> claims (see re-audit in TASKS/README.md), and copy-paste verification blocks.
> The authoritative, re-audited plan — one file per task — lives in
> **`TASKS/README.md`** and `TASKS/phase-*/NN.N-*.md`.

## Phase 0: Preparation and Setup
### 0.1 Environment Verification
- Verify Node.js, Angular CLI, and npm versions
- Confirm existing Angular project builds without errors
- Document current working directory and project structure

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 0.2 Python Chart Viewer Analysis
- Examine `/c/Users/kevin/Documents/Programming/screener/viewingApp` structure
- Identify charting core (`chart/` directory)
- Identify indicators (`indicators/` directory)
- Identify UI components (`ui/` directory)
- Identify data services (`services/` directory)
- Create inventory of files to be ported

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 0.3 Backend API Requirements Identification
- Analyze Python chart viewer's data fetching mechanisms
- Identify required API endpoints for charting functionality
- Document these in `API-BACKEND-SPEC.md`

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 1: Project Foundation
### 1.1 Charts Module Creation
- Generate Angular module for charts: `ng generate module charts --route charts --module app.module`
- Create basic routing for charts module
- Verify module loads without errors

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 1.2 Core Services Setup
- Create `ChartDataService` wrapper around existing stock service
- Create `IndicatorCalculationService` skeleton
- Verify services can be injected without errors

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 1.3 Basic Chart Component
- Generate chart viewer component: `ng generate component charts/chart-viewer --skip-tests`
- Create minimal template with chart container
- Verify component renders in Angular app

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 2: Charting Implementation
### 2.1 Chart.js Integration
- Install/verify chart.js and financial plugin
- Create basic candlestick chart with static data
- Implement tooltip functionality
- Verify chart renders correctly

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 2.2 Multi-Pane Support
- Implement volume pane below price chart
- Synchronize x-axes between panes
- Add basic volume bars
- Verify panes scale correctly

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 2.3 Interaction Implementation
- Implement zoom/pan functionality
- Add crosshair tooltip
- Implement mouse wheel zooming
- Verify smooth interaction performance

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 3: Controls and Toolbar
### 3.1 Toolbar Component
- Generate toolbar component: `ng generate component charts/chart-toolbar --skip-tests`
- Implement symbol input field
- Implement interval selector (1m,5m,1h,1d,1w)
- Implement indicator toggles
- Verify toolbar UI renders correctly

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 3.2 Toolbar-Chart Integration
- Connect symbol changes to chart updates
- Connect interval changes to data fetching
- Connect indicator toggles to chart updates
- Verify bidirectional data flow

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 3.2 Time Range Controls
- Add preset time range buttons (1M,3M,6M,YTD,1Y,ALL)
- Implement custom date range picker
- Verify chart updates correctly on range changes

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 4: Indicators System
### 4.1 Indicator Calculation Service
- Implement SMA (Simple Moving Average)
- Implement EMA (Exponential Moving Average)
- Implement Volume indicators
- Verify calculations match Python reference

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 4.2 Indicator Panel Component
- Generate indicator panel component: `ng generate component charts/indicator-panel --skip-tests`
- Implement dynamic rendering based on indicator type
- Support line, histogram, and band indicators
- Verify panels render correctly below/above price chart

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 4.3 Indicator Management
- Implement add/remove indicator functionality
- Create indicator configuration dialog
- Persist indicator selections
- Verify indicator system works end-to-end

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 5: Data Flow and State Management
### 5.1 Chart State Service
- Implement BehaviorSubject-based state management
- Create selectors for symbol, interval, indicators
- Implement state persistence (sessionStorage)
- Verify state survives page refresh

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 5.2 Data Fetching Pipeline
- Implement OHLCV data fetching service
- Implement indicator calculation pipeline
- Add loading/error states
- Verify data flows from service to chart correctly

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 5.3 Optimization Implementation
- Implement data decimation for high-frequency data
- Add caching for indicator calculations
- Implement request deduplication
- Verify performance with large datasets

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 6: Integration and Polish
### 6.1 Routing Integration
- Add chart routes to main app routing
- Implement route parameter handling (:symbol)
- Verify navigation to `/charts/AAPL` works
- Verify backward compatibility with existing routes

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 6.2 Navigation Updates
- Add "Charts" entry to sidebar navigation
- Add "Charts" entry to header toolbar (if applicable)
- Verify navigation highlights current route
- Verify responsive behavior on mobile

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 6.3 Styling and Theme Integration
- Convert hardcoded sizes to CSS variables
- Use existing Angular project's design tokens
- Ensure dark/light theme compatibility
- Verify no styling conflicts with existing components

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 6.4 Error Handling and Loading States
- Implement skeleton loaders for chart areas
- Add error display for failed data fetches
- Implement retry mechanisms for failed requests
- Verify graceful degradation

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 6: Testing and Validation
### 6.1 Unit Testing
- Write tests for indicator calculations
- Write tests for data transformation functions
- Write tests for service methods
- Achieve minimum 80% code coverage on new code

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 6.2 Manual Testing
- Test with multiple symbols (AAPL, MSFT, GOOGL, etc.)
- Test various time intervals (1m, 5m, 1h, 1d, 1w)
- Test indicator combinations
- Verify mobile responsiveness
- Verify browser compatibility (Chrome, Firefox, Safari)

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 6.3 Performance Testing
- Measure initial load time (<3s)
- Measure chart rendering FPS (>30fps)
- Test with large datasets (1000+ candles)
- Verify memory usage remains reasonable

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Phase 7: Documentation and Cleanup
### 7.1 Code Cleanup
- Remove all TODO comments
- Remove console.log statements
- Ensure consistent code formatting
- Fix all TSLint/eslint errors

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 7.2 Documentation Updates
- Update README.md with charting features
- Add JSDoc comments to all public methods
- Create architecture overview document
- Document API contract for backend team

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


### 7.3 Final Build Verification
- Verify `ng build --configuration production` succeeds
- Verify build output size is reasonable
- Verify deployed app works when served statically
- Create deployment instructions if needed

**Verification:**
- Run `ng serve` to start the development server.
- Open the application in a browser at the appropriate URL (e.g., http://localhost:4200/).
- Navigate to the feature/page modified in this task.
- Visually inspect for any anomalies (layout issues, missing elements, styling problems).
- Open the browser developer console (F12) and verify there are no errors or warnings.
- If the task involves API endpoints, use the browser's Network tab or a tool like curl to call the endpoint and verify correct responses.
- Confirm that the visual regression test (if applicable) passes or update baselines as needed.


## Ongoing Task: API Backend Specification
As we identify backend requirements during frontend development, we will append to:
`API-BACKEND-SPEC.md`

This file will serve as the specification for a future session to create the necessary API endpoints.

## FINAL TASK: Remove Hardcoded Credentials
### LAST.1 Remove Hardcoded Auth Service
- Replace hardcoded admin credentials in AuthService with proper API calls
- Remove sessionStorage-based fake authentication
- Implement real authentication flow with backend endpoints

### LAST.2 Clean Up Demo-Specific Code
- Remove all hardcoded credential hints from login component templates
- Remove demo account hints (admin@demo.angular-project.local / changeme)
- Replace with generic login/register forms

### LAST.3 Update Routing Guards
- Replace fake auth checks in AuthGuard with real authentication verification
- Ensure proper redirect logic based on actual auth state

### LAST.4 Verify Production Readiness
- Confirm no hardcoded credentials remain in the codebase
- Verify all authentication flows work with the backend API
- Test that the app functions correctly when backend authentication is implemented

## ~~Toolbar-Chart Integration (Completed)~~ — ⚠️ FALSE CLAIM, see re-audit
> The integration code was written but never worked: the chart could not render
> (missing Chart.register, no date adapter, 404'd data URL — see audit notes in
> TASKS/README.md), so "Completed" was unfounded. Redone honestly in
> `TASKS/phase-2-chart-data/2.3-toolbar-integration-redo.md`.

- [x] Integrate chart toolbar with chart viewer to enable dynamic symbol/interval changes
  - Modified src/app/app.routes.ts to add route for charts/:symbol
  - Modified src/app/charts/chart-viewer/chart-viewer.component.ts:
    * Added import for ChartToolbarComponent
    * Added ChartToolbarComponent to imports array
    * Added <app-chart-toolbar> to template above canvas, bound to (symbolChange) and (intervalChange) outputs
    * Added currentSymbol and currentInterval properties
    * Added onToolbarSymbolChange() and onToolbarIntervalChange() handler methods
    * Updated loadChartData() to accept interval parameter
  - Updated src/app/core/services/chart-data.service.ts to load test data from assets/test-data/ when backend is unavailable
  - Verification steps:
    * Run npm run build (exit code 0)
    * Run ng serve and navigate to http://localhost:4200/charts/:symbol
    * Verify toolbar appears above chart and functions correctly
    * Verify no errors in DevTools Console
    * Verify no inline styles in chart viewer (design system compliance)
