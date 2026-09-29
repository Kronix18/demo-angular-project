# Task 12: Price Chart View (Component Only — No Logic)

## Scope: Render a template that hosts a canvas element and binds it to a chart library.

### Deliverable: `src/app/features/stock/price-chart-view/price-chart-view.html`

A minimal HTML-only component template that:

- Has a single `<canvas>` element (`id="chart-canvas"`) sized to its container.
- Is rendered as a standalone view in the `StockDetailDrawerComponent`.
- Takes input bindings via an @Input() for width and height from Angular's view-layer.

Zero computation, zero logic — just DOM wiring and template bindings.

### First step — write tests: **None** (HTML-only template file; no unit-testable logic). Instead, perform a manual browser inspection: verify the canvas is visible on page load, has the expected CSS width/height, and that clicking it fires an `error` event for testing (since chart.js will emit an error when no data has been set yet).
