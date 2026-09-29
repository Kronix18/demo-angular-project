# Implementation Summary / Task List

## Completed Tasks (All 13):

| # | Path | Description |
|---|------|-------------|
| 1  | `TASKS/01-01-test-harness-setup.md` | Shared test utilities, fixutures |
| 2  | `TASKS/02-01-defines-interface-ohlcbars.md` | TypeScript OHLCBar interface |
| 3  | `TASKS/03-01-defines-interface-screenerresultrow.md` | ScreenerResultRow interface |
| 4  | `TASKS/04-01-writes-auth-interceptor.md` | Auth interceptor (JWT attach/remove) |
| 5  | `TASKS/05-01-writes-http-error-interceptor.md` | Global error handling interceptor |
| 6  | `TASKS/06-01-auth-service-login-and-logout.md` | AuthService login/logout methods |
| 7  | `TASKS/07-01-authservice-getprofile.md` | GET /api/auth/profile endpoint |
| 8  | `TASKS/08-01-stockservice-getstockprices.md` | GET /api/stocks/:symbol endpoint |
| 9  | `TASKS/09-01-screener-service.md` | POST /api/screener/run endpoint |
|10  | `TASKS/10-01-company-profile-api.md` | GET /api/stocks/:symbol company profile |
|11  | `TASKS/11-01-pricesservice-view-model.md` | Stateless view model for price chart |
|12  | `TASKS/12-01-pricesservice-view-only-template.md` | HTML-only canvas template |
|13  | `TASKS/13-01-volumechart-component.md` | Volume chart component with @Output onTick |

## What comes next (sub-subtasks, each also test-first):

The same decomposition strategy applies. Each sub-component gets its own `.md` file in `/TASKS/` and is implemented exactly as written.

Example: when Task 13 is complete, split it further into:
- 13.02 — implement the `VolumeChartComponent.ts` logic
- 13.03 — add a unit-test that mocks `canvas.getContext` and fires click events
- 13.04 — integrate the component into the drawer side panel
- etc.

The rule is: every deliverable must be a single function or a single module of one responsibility, and the first step is ALWAYS to write tests.

---

Total: **13 discrete, atomic tasks**, each in its own `.md` file in `TASKS/`. No task exceeds a few lines of code. None starts with production implementation — every task requires or begins with test-first verification.
