# Stock Screener & Detail App

Angular 21 app with a stock screener, stock detail pages, and interactive OHLC charts.

## Quick Start

```bash
npm install
ng serve --host 0.0.0.0 --port 4200
# open http://localhost:4200
```

If the browser cannot connect on 4200, ensure the `--host 0.0.0.0` flag is present and no other process is using the port.

## Features
- Screener: Loads all stocks once, filters locally (price, sector, volume, search)
- Detail page: Company fundamentals + price history
- Charts: Candlestick / OHLC / Bar / Line, linear or log scale
- Interactions: Time ranges (1M/3M/6M/1Y/All), mouse wheel zoom, pinch zoom, pan, reset zoom

## Scripts
- `ng serve --host 0.0.0.0 --port 4200` — dev server with HMR
- `ng build` — production build to `dist/`

## Notes
- Charts use Chart.js + chartjs-chart-financial + chartjs-plugin-zoom
- 1M/3M/6M/1Y filters use calendar math for accurate cutoffs
- If you change chart data inputs, ensure dates are valid ISO strings

## Troubleshooting
- Port in use: change `--port` or stop other dev servers
- Empty data on first load: wait for initial API response; filters are client-side thereafter
- Zoom stuck: click **Reset Zoom** in the chart controls
