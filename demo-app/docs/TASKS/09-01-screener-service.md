# Task 9: StockDataAPI — POST /api/screener/run

## Scope: A single endpoint that calls the screener backend and returns result rows.

### Deliverable: `src/app/core/services/screener.service.ts` (single file, single method)

```ts
export type Filters = {
  peRatioMin?: number;
  peRatioMax?: number;
  dividendYieldMin?: number;
  sector?: string;
  // ...etc
};

runScreener(filters: Filters): Observable<ScreenerResultRow[]>
```

### First step — write tests:

Write a unit test that stubs the POST /api/screener/run call, sends the mocked filters object, and asserts that the observable emits a ScreenerResultRow[] array.
