# Task 11: View Model for Price Chart View

## Scope: Define the view model and view-state observable that coordinates the price-chart view.

### Deliverable: `src/app/features/stock/view-model.ts`

A single module that provides a stateless class:

```ts
export class StockChartViewModel {
  // Observable<OHLCBar[]> to subscribe to as chart data arrives from the API.
  readonly priceBars$: BehaviorSubject<OHLCBar[] | null> = new BehaviorSubject(null);

  setBars(bars: OHLCBar[]) {
    this.priceBars$.next(bars);
  }
}
```

No side effects, no HTTP calls, no DOM manipulation.

### First step — write tests:

Assert that subscribing to `priceBars$` emits the initial `null` value and then a new array after calling `setBars`. Verify that a subsequent call overwrites the previous value before the next emission.
