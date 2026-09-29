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
| 11.2 | All chart types | NOT STARTED |
| 11.3 | Type-to-search symbol dialog | NOT STARTED |
| 11.4 | Auto-scale toggle, vertical pan, log price + volume | NOT STARTED |
| 11.5 | Drawing sidebar + tools | NOT STARTED |

## 11.1 results
- Legend header is now `SYMBOL · 1D  O H L C  V  change` for the hovered bar (latest when idle); indicator rows sit under it (overlays) or in their own pane (oscillators). Each row: chip, live value, ⚙ settings, eye, ✕; double-click opens settings.
- **Indicators button** (`ƒx Indicators`) opens `IndicatorsDialogComponent`: searchable (name > category > description ranking), grouped by category, description per entry, click adds and keeps the dialog open, Enter adds the first match. The same indicator may be added repeatedly (TradingView behaviour; the old duplicate error and the header add-form `IndicatorPanel` were removed).
- **Indicator settings** (`IndicatorSettingsDialogComponent`): *Inputs* generated from the definition's parameter specs (integer/float/boolean/choice/source, validated against min/max/integer with inline errors, OK disabled until valid); *Style* per output (visible, colour, width, line style); *Visibility* per timeframe (≥1 required); Reset defaults; OK applies, Cancel/Esc/✕ discard. Settings persist in the indicator's state entry (`params`, `styles`, `intervals`, validated on rehydration). Label follows the inputs (`EMA 50`), a moving average of volume plots on the volume scale.
- Shared `ModalComponent` (role=dialog, aria-modal, Esc/backdrop/✕, focus first field).
- Tests: catalog/state specs, modal (3), picker (4), settings (7), legend (+1), viewer dialog/settings integration (5), e2e picker + settings flows. Screenshots `docs/screenshots/11.1-*.png`.
