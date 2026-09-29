# Task 8: StockDataAPI — GET /api/stocks

## Scope: A single HTTP endpoint for fetching stock data.

### Deliverable: `src/app/core/services/stock.service.ts` (or `http-client.module.ts`)

One method only:

```ts
getStockPrices(symbol: string, timeframe?: 'daily' | 'intraday'): Observable<OHLCBar[]>
```

This single method is responsible for:

- Validating the symbol argument (non-null).
- Calling `/api/stocks/prices` as a GET request.
- Mapping the HTTP response body to `OHLCBar[]`.

### First step — write tests:

Write an isolation test:

- Mock the `HttpClient.get('/api/stocks/prices')` stub.
- Call `getStockPrices('AAPL')`.
- Assert that the observable emits an array of OHLC bars matching the stubbed payload.
