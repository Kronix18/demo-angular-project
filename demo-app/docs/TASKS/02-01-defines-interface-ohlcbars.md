# Task 2: Define TypeScript Interface for OHLCDataPoint

## Scope: Define the data shape for a single bar in an OHLC chart.

### Deliverable: `src/app/shared/models/ohlc-bar.ts` (module only, no implementation)

The interface must match exactly what the backend FastAPI endpoint returns:

```ts
export interface OHLCBar {
  timestamp: string;       // "YYYY-MM-DD" format string from PostgreSQL
  open: number;            // opening price as a number
  high: number;           // highest price of the bar period
  low: number;            // lowest price of the bar period
  close: number;          // closing price
  volume?: number;        // optional, may be null
}
```

### First step — write tests: **SKIP NOT APPLICABLE** (pure interface definition with no runtime behavior to verify).

## Completion Criteria

The file compiles without error and subsequent test-harness tests use it successfully.
