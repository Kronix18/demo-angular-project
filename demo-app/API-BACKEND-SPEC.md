# API Backend Specification for Charting Features

## Purpose
This document specifies the backend API endpoints required to support the Angular charting features. The backend implementation should be handled in a separate session, focusing only on providing the necessary data endpoints.

## Core Principles
1. **Data-Only Backend**: The backend should focus on providing raw financial data
2. **Client-Side Calculations**: Technical indicators, chart rendering, and interactions should happen in the Angular frontend
3. **Stateless Endpoints**: All endpoints should be stateless and cacheable where appropriate
4. **Consistent with Existing API**: Should follow the same patterns as existing endpoints in the application

## Required Endpoints

### 1. OHLCV Data Endpoint
```
GET /api/chart/ohlcv/{symbol}
Query Parameters:
  - interval: string (1m, 5m, 1h, 1d, 1w, 1M) - default: 1d
  - limit: number (default: 100, max: 1000)
  - from: timestamp (optional)
  - to: timestamp (optional)

Response:
  [
    {
      "timestamp": number (Unix milliseconds),
      "open": number,
      "high": number,
      "low": number,
      "close": number,
      "volume": number
    }
  ]
```

### 2. Symbol Search/Autocomplete Endpoint
```
GET /api/chart/symbols/search
Query Parameters:
  - q: string (search query)
  - limit: number (default: 10)

Response:
  [
    {
      "symbol": string,
      "name": string,
      "exchange": string,
      "type": string (stock, etf, crypto, etc.)
    }
  ]
```

### 3. Available Intervals Endpoint
```
GET /api/chart/intervals
Response:
  [
    { "value": "1m", "label": "1 Minute" },
    { "value": "5m", "label": "5 Minutes" },
    { "value": "1h", "label": "1 Hour" },
    { "value": "1d", "label": "1 Day" },
    { "value": "1w", "label": "1 Week" },
    { "value": "1M", "label": "1 Month" }
  ]
```

### 4. Chart Data Metadata Endpoint
```
GET /api/chart/metadata/{symbol}
Response:
  {
    "symbol": string,
    "name": string,
    "exchange": string,
    "currency": string,
    "dataAvailableFrom": timestamp (Unix milliseconds),
    "dataAvailableTo": timestamp (Unix milliseconds),
    "supportedIntervals": ["1m", "5m", "1h", "1d", "1w", "1M"]
  }
```

### 5. Multiple Symbols Data Endpoint (for watchlists)
```
POST /api/chart/ohlcv/batch
Request Body:
  {
    "symbols": ["AAPL", "MSFT", "GOOGL"],
    "interval": "1d",
    "limit": 50
  }

Response:
  {
    "AAPL": [OHLCV array],
    "MSFT": [OHLCV array],
    "GOOGL": [OHLCV array]
  }
```

## Data Format Notes
- All timestamps should be in Unix milliseconds (UTC)
- Numbers should be provided as JSON numbers (not strings)
- Empty arrays should be returned for no data, not null
- Error responses should follow existing API error format
- CORS headers should allow requests from the Angular frontend
- Rate limiting may be applied per IP/API key

## Implementation Guidelines
1. Reuse existing data fetching layers where possible
2. Implement proper caching for frequently requested symbols
3. Consider implementing WebSocket endpoints for real-time updates (future enhancement)
4. Ensure proper error handling for invalid symbols, date ranges, etc.
5. Support pagination for large dataset requests