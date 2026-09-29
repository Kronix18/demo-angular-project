# Task 3: Define TypeScript Interface for ScreenerResultRow

## Scope: Define the schema for a single row in the screener results table.

### Deliverable: `src/app/shared/models/screener-result.ts`

A single-file module defining the backend response shape:

```ts
import { OHLCBar } from './ohlc-bar';

export interface ScreenerResultRow {
  symbol: string;
  name: string;
  exchange: string;
  price: number;
  changePercent: number;     // float, e.g. +2.45 = 2.45%
  volume: number | null;
  sector: string | null;
  industry: string | null;
  priceToEarnings?: number | null;
  dividendYield?: number | null;
  marketCap?: number | null; // in millions or actual units
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
}
```

### First step — write tests: **SKIP NOT APPLICABLE** (pure interface).

## Completion Criteria

Compiles without error, imports successfully from shared models.
