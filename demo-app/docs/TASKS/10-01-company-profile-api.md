# Task 10: CompanyProfileAPI — GET /api/stocks/:symbol

## Scope: Fetch company profile details for a given stock symbol.

### Deliverable: `src/app/core/services/company.service.ts`

One method, one purpose:

```ts
getCompanyDetails(symbol: string): Observable<StockProfile>
```

This single method calls `/api/stocks/${symbol}` and deserializes the JSON response into a typed profile object.

### First step — write tests:

Write a unit test that verifies calling `getCompanyDetails('AAPL')` subscribes to an observable that emits a profile object matching the backend response schema. The observable should complete or error according to the mocked HTTP response's status code.
