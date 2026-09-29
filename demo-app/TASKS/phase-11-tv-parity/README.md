# Phase 11 — TradingView parity round 2 (Kevin, 2026-09-29)

Requests (with reference screenshots of TradingView):
1. OHLCV on the chart, top-left next to the symbol
2. Indicators listed under it
3. "Indicators" button opens a panel for selecting an indicator
4. All TradingView bar types (candles, bars, HLC bars, point & figure, …)
5. Typing anywhere opens symbol search
6. Indicator settings (colour, inputs, line style, visibility, …)
7. Drawing sidebar + tools
8. Auto-scale toggle; free vertical pan (auto was forced, so you could not pan up/down)
9. Logarithmic price scale — including volume

| # | Item | Status |
|---|------|--------|
| 11.1 | OHLCV header, indicator rows, Indicators picker dialog, indicator settings (inputs/style/visibility) | DONE |
| 11.2 | All chart types | DONE (except volume candles / volume footprint / TPO — need intraday or per-bar widths) |
| 11.3 | Type-to-search symbol dialog | DONE |
| 11.4 | Auto-scale toggle, vertical pan, log price + volume | NOT STARTED |
| 11.5 | Drawing sidebar + tools | NOT STARTED |

## 11.1 results
- Legend header is now `SYMBOL · 1D  O H L C  V  change` for the hovered bar (latest when idle); indicator rows sit under it (overlays) or in their own pane (oscillators). Each row: chip, live value, ⚙ settings, eye, ✕; double-click opens settings.
- **Indicators button** (`ƒx Indicators`) opens `IndicatorsDialogComponent`: searchable (name > category > description ranking), grouped by category, description per entry, click adds and keeps the dialog open, Enter adds the first match. The same indicator may be added repeatedly (TradingView behaviour; the old duplicate error and the header add-form `IndicatorPanel` were removed).
- **Indicator settings** (`IndicatorSettingsDialogComponent`): *Inputs* generated from the definition's parameter specs (integer/float/boolean/choice/source, validated against min/max/integer with inline errors, OK disabled until valid); *Style* per output (visible, colour, width, line style); *Visibility* per timeframe (≥1 required); Reset defaults; OK applies, Cancel/Esc/✕ discard. Settings persist in the indicator's state entry (`params`, `styles`, `intervals`, validated on rehydration). Label follows the inputs (`EMA 50`), a moving average of volume plots on the volume scale.
- Shared `ModalComponent` (role=dialog, aria-modal, Esc/backdrop/✕, focus first field).
- Tests: catalog/state specs, modal (3), picker (4), settings (7), legend (+1), viewer dialog/settings integration (5), e2e picker + settings flows. Screenshots `docs/screenshots/11.1-*.png`.

## 11.2 results — chart styles
- **18 styles** in a grouped select (Bars & candles: Candles, Hollow candles, Bars, HLC bars, High-low, Columns · Lines & areas: Line, Line with markers, Step line, Area, HLC area, Baseline · Alternative: Heikin Ashi, Renko, Line break, Kagi, Point & figure, Range). Screenshot contact sheet: `docs/screenshots/11.2-chart-styles.png`.
- **Alternative charts are synthetic bars** (`chart-types/bar-transforms.ts`, pure + unit-tested): Heikin Ashi (index-aligned), Renko (2-box reversal), three-line break, Kagi, Point & Figure (X/O columns, 3-box reversal), Range bars (each spans exactly the range). Brick/box/reversal size = ATR(14) of the source bars (TradingView's default). Because the output is just OHLCV bars, LOD windowing, volume (accumulated per brick), indicators (computed on the transformed bars), legend and drawings all keep working; time on the x axis is the source bar at which a brick completed.
- **Rendering**: candles/hollow/heikin/renko/linebreak/range via the financial candlestick; **new `tvbar` element** (`chart-types/tv-bar.ts`) for Bars / HLC bars / High-low (the plugin's own OHLC element had up/down colours swapped and no HLC/high-low); columns = bar dataset; line-family = line datasets (step: `stepped:'after'`, baseline: `fill.above/below` around the framed mid-price, HLC area: high/low lines with fill); Kagi = stepped line with thick yang / thin yin segments; P&F = invisible candle envelope + `pnfGlyphs` plugin painting X and O per box.
- **Bug fixed while here**: the candlestick colours were being set with the wrong option names (`color`/`borderColor` instead of the plugin's `backgroundColors`/`borderColors`), so candles rendered in the plugin's hardcoded colours and the theme tokens never applied — the old test passed because it asserted the wrong key. Candles now use `--c-up/--c-down` (solid), and the e2e checks the real option.
- View handling: switching between index-aligned styles keeps your pan/zoom; switching to/from a brick style re-frames (bar indexes differ).
- Tests: `bar-transforms.spec` (19), viewer "EVERY chart style renders" + hlc area + view handling + long-history brick styles, e2e "all 18 styles render real pixels + persist". Not done: Volume candles / footprint / TPO / session volume (need per-bar widths from volume or intraday data), Range/Renko box-size settings UI (fixed to ATR).

## 11.3 results — type-to-search
- Pressing any letter/digit while nothing is focused opens `SymbolSearchDialogComponent` with that character already in the box (caret after it); ignored in inputs/selects/contenteditable, with Ctrl/Meta/Alt, for navigation keys, and while another dialog is open. Clicking the symbol in the legend header opens it empty.
- Live filter over the demo symbols (exact > prefix > contains, case-insensitive; `MSFT.US` style input is cleaned), ↑/↓ with wrap, Enter picks the highlighted (or the first match), click picks, Esc closes. An unknown query offers **Go to AAPL**, which opens the chart's unknown-symbol card. Enter on an empty box does nothing.
- Picking calls the existing state path (`setSymbol` → URL sync, refetch); the toolbar input + datalist still work for mouse users.
- Tests: dialog spec (7), legend (+1), viewer type-to-search (5), e2e "type-to-search".
