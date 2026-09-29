# Task 13: VolumeChartComponent — Render a single stock volume chart

## Scope: A single component that renders price bars + a separate volume bar chart using the chartjs financial plugin.

### Deliverable: `src/app/features/stock/price-chart-volume-chart.component.ts`

The class has an `@Output()` event named `onTick`. Any click on the bar (candlestick or volume bar) triggers that output with the OHLC data point as its event value.

```ts
export class VolumeChartComponent implements OnInit, OnChanges, OnDestroy {
  canvas: ElementRef<HTMLCanvasElement>;
  chart: Chart | null = null;
  @Input() ohlcBars: OHLCBar[] = [];
  @Output() onTick: EventEmitter<OHLCBar> = new EventEmitter();

  // In ngOnInit / ngOnChanges:
  // - If ohlcBars.length === 0, destroy the chart instance if present.
  // - Else, create a new Chart from `chart.js/auto/register()` that registers the `bar` type + OHLC plugin.
  // - Set the x axis title to "Date" with labels = [b.timestamp for b in ohlcBars].
  // - For the y axis, set `tickFont:{size:14}` on both axes.
  // - The color scale should be red if close < open, green if close ≥ open.
}
```

### First step — write tests:

Write a unit test that mocks a browser's `canvas.getContext` stub to return a fake context object that returns `(type: string) => ()` as its method. The test subscribes to the `@Input()` property via its setter, calls `onTick.emit(someBar)` by firing a mock click event on the canvas, and asserts that exactly one `OHLCBar` was emitted and that it matches the bar data from the `ohlcBars` array.
