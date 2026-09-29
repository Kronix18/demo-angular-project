# Phase 10 — TradingView-Style Renditions (Kevin-approved v2, 2026-09-24)

Goal: make the chart "almost exactly like TradingView". Added per Kevin's explicit
approval after Phase 2 (the v1 baseline renders; user rejected its plain look:
"i dont like this chart at all. No updates, no nothing... almost exactly like
TradingView charts").

These tasks build on Phase 3 (interaction), 4.x (state), 5.x (indicators) — but
10.2 (dark theme) and 10.3 (legend rows) can start as soon as tokens exist (6.2).
The PORT-INVENTORY marks drawings/* OUT-OF-SCOPE v2 via chartjs-plugin-annotation;
Kevin's approval moves those INTO scope as Phase 10 tasks.

## Rules specific to this phase
- **Reference-first**: every task starts by re-reading the corresponding Python
  viewer module (the port inventory maps them) and TradingView's actual behavior;
  visual fidelity is judged against TradingView screenshots side-by-side.
- **Pixel-standard verification** (Kevin's tightened rule) applies double here:
  every "TradingView-like" claim needs a side-by-side screenshot
  (docs/screenshots/10.x-*.png: ours vs TradingView reference).
- Visual regression baseline: capture BEFORE each task lands (the current look is
  the baseline to beat).

## Tasks

### 10.1 — TradingView Dark Theme (token-based) — DONE 2026-09-29
**Files:** theme SCSS, all chart components' CSS var consumption, chart.js runtime
colors (cssVar helper — crosshair/grid/candles/volume/tooltip colors from tokens).
**Spec:** TradingView dark palette: bg #131722, grid #2a2e39, text #d1d4dc,
up #26a69a, down #ef5350, volume up/down 40% alpha, crosshair #758696 dashed.
**Verify:** side-by-side screenshot vs TradingView dark reference; prefers-color-scheme
emulation swaps themes (tokens only — no hardcoded colors remain, enforced by 6.2's style-guard spec).

### 10.2 — TradingView Legend Rows (OHLC row + eye toggles) — DONE 2026-09-29
**Files:** new `chart-legend` component (overlay top-left of chart), state service.
**Spec:** TradingView-style: first row = symbol + interval + OHLC values of the
hovered bar (live-updating on crosshair move); indicator rows (5.2) each with an
eye visibility toggle + color chip + remove ✕. Values format: O/H/L/C with 2 decimals.
**Python reference:** chart/indicator_overlay.py (PriceLegendOverlay UX contract —
row per instance, visibility eye, label template).
**Verify:** hover a bar → legend OHLC values update live (screenshot sequence);
eye toggle hides/shows the indicator series; pixel-verified.

### 10.3 — Drawing Tools (trendlines, horizontal rays, channels) — DONE 2026-09-29
**Files:** new `chart-drawings` component + drawing store service (sessionStorage
persistence), chartjs-plugin-annotation (ADD dependency).
**Spec:** v2 scope per original inventory (drawings/*): trendline (2-point),
horizontal ray (price level), channel (parallel lines). Drag-to-place, click to
select, Del to remove; persisted per symbol in sessionStorage.
**Verify:** draw a trendline → appears + survives refresh; remove works;
annotations don't break zoom/pan (3.2) — annotation plugin scales with the chart.

### 10.4 — Multi-Pane Layout (true panes, per-pane Y) — DONE (delivered in 5.4)
**Files:** chart-viewer template (panes stacked), pane layout service.
**Spec:** upgrade the v1 dual-axis single canvas to TradingView's true pane model:
price pane (~70%), volume pane (~15%, own scale), indicator panes (~15% each);
shared x-axis; per-pane separators; drag pane borders to resize (stretch goal).
**Python reference:** chart/pane_manager.py (the layout model, port target).
**Verify:** panes visually proportioned (screenshot vs TradingView multi-pane);
each pane's y-axis independent; zoom/pan syncs all panes; pixel-verified.

### 10.5 — TradingView Bottom Toolbar & Interactions Polish — DONE 2026-09-29 (except the symbol search dialog)
**Files:** toolbar component, viewer.
**Spec:** TradingView's bottom bar: symbol quick-search (magnifier, opens search
dialog — port of ui/quick_search_dialog.py), timeframe buttons with active state,
chart-type switcher (candles/HLC/OHLC/line), fullscreen, camera (screenshot).
Crosshair magnet mode; double-click reset zoom.
**Verify:** every control works (screenshot each); chart-type switch changes the
render (pixel-verified different signature per type).


## 10.1 results (DONE)
- `src/styles/theme.scss`: light palette (original values) + `:root[data-theme='dark']` TradingView-style palette (bg `#131722`, panels `#1e222d`, text `#d1d4dc`, grid/pane borders `#2a2e39`, muted `#787b86`, up/down unchanged, crosshair `#758696`). The `prefers-color-scheme` emulation swap is handled by `ThemeService` (mode `system` | `light` | `dark`, persisted in localStorage, live OS follow, navbar toggle ◐/☀/☾, pre-paint script in index.html avoids a flash).
- ALL hardcoded colours removed from the app (10 feature stylesheets, pricing/profile/screener/stock/auth pages, legacy candlestick chart, chart runtime). Guard: `src/styles.spec.ts` (7 specs, no allowlist). Chart canvas reads tokens at draw time incl. candle colours, tooltip, axis text.
- Tests: `theme.service.spec` (5), app.spec toggle, styles.spec, e2e `states-and-theme.spec` (light/dark token checks, OS emulation incl. live change, toggle persistence across pages). Screenshots: `docs/screenshots/10.1-dark-pricing.png`, `10.1-dark-profile.png`, `6.2-dark.png`.
- Deviation: no side-by-side against a live TradingView screenshot (no access from this environment); palette values follow the spec above.
- Also fixed: pricing page rendered a literal backslash before prices (`\$0`).

## 10.2 results (DONE)
- New `charts/chart-legend/chart-legend.component.ts` (dumb, tokens only) overlaid on the chart panel, one group per pane placed at the pane's top edge: price pane header `SYMBOL · 1D  O H L C  change (%)` (coloured by bar direction) + overlay indicator rows; Volume row with the hovered bar's volume; one group per oscillator pane. Indicator rows = colour chip, live value at the hovered bar, eye toggle, remove ✕ (controls appear on row hover / focus).
- Viewer feeds it through a chart plugin (`legendFeed`: hovered bar index from `afterEvent`, pane tops from `afterLayout`) and signals; no hover ⇒ latest bar. Canvas pane labels were removed (the legend replaces them); the canvas only draws separators.
- Eye = `hidden` flag on the persisted indicator entry (`ChartStateService.toggleHidden`, rehydration keeps it): the series' datasets are hidden, the pane and row stay (dimmed, struck through). Duplicate detection ignores the flag.
- The header indicator list moved into the legend — `indicator-panel` is now only the add form (validation unchanged).
- Tests: `chart-legend.component.spec` (5), `chart-state.service.spec` (+2), viewer "legend rows" (4), e2e `legend (10.2)` (hover changes OHLC, values, row inside its pane, eye persists over reload, ✕). Screenshot `docs/screenshots/10.2-legend-dark.png`. Full e2e 23 passed.
- Deviation: no side-by-side against a TradingView reference screenshot (not available here).

## 10.5 results (DONE, one item deferred)
- **Chart types** (state `chartType`, persisted): candles, OHLC bars (`ohlc` controller), line (close), area (filled). Price series/tooltip/y-fit handle all four; view is kept on switch; volume/indicators unaffected. Select in the chart header. New tokens `--c-price-line/--c-price-area` (light + dark).
- **Crosshair**: now horizontal + vertical, with the price/volume/indicator value label on the y axis of the pane under the cursor; **Magnet** toggle (state `magnet`, persisted, no chart rebuild) snaps the horizontal line to the hovered bar's close.
- **Snapshot** button downloads `<symbol>-<interval>.png` (canvas `toBase64Image`); **Fullscreen** toggles `documentElement` fullscreen; **double-click** resets the zoom.
- Timeframe buttons with active state already existed (4.3); the interval select keeps the demo's disabled intraday options.
- Deferred: the symbol quick-search *dialog* (port of `ui/quick_search_dialog.py`) — the symbol input with datalist covers the demo's 8 symbols; a dialog only pays off with a real symbol universe (9.1).
- Tests: state spec (+2), viewer "chart types + tools" (9), e2e `tools (10.5)` (four types paint four different pixel signatures, area > line, persistence, magnet, real download event, wheel-zoom then dblclick reset, fullscreen click safe). Screenshot `docs/screenshots/10.5-area-magnet-dark.png`. e2e 24 passed; coverage gate PASS.

## 10.3 results (DONE)
- **Tools** (vertical strip on the chart's left edge, like TradingView): cursor, trend line (drag A→B), horizontal ray (click a price), parallel channel (drag the base line, then click for the offset; shaded), Clear-all. Draft previews are dashed; a bare click with a tool creates nothing; Escape cancels.
- **Cursor tool**: click selects the nearest drawing (handles appear), drag a handle moves that endpoint, drag the body moves the whole drawing, Delete/Backspace removes it (ignored while typing in an input/select). Pan is disabled while a drawing tool is active (zoom plugin option toggled + updated) and restored for the cursor; wheel zoom always works.
- **Data model**: anchors are `(timestamp, price)`, so drawings stay on their date across daily/weekly switches, zoom/pan and the LOD windowing. Stored per symbol in sessionStorage (`chart-drawings`), validated on load. Drawn on the price pane only, clipped to it.
- **Code**: `charts/drawings/` — `drawing-geometry.ts` (time↔index, hit-test distances), `drawing-store.service.ts`, `drawing-controller.ts` (pointer/keyboard state machine, DOM-free, unit-tested with a fake chart), `drawings` canvas plugin in the viewer. Tokens `--c-drawing`, `--c-drawing-fill` (light + dark).
- **Deviation:** implemented as our own canvas plugin instead of adding `chartjs-plugin-annotation`: index-based annotation coordinates fight the bar-index/LOD x-scale (they'd need re-mapping on every window change), interactive placement/dragging needs custom pointer handling anyway, and it avoids a dependency. Bug found by the e2e: the controller was attached after the chart's first render, so a rebuilt chart (interval switch) didn't show drawings until the next update — now redrawn on attach.
- Tests: geometry (5), store (4), controller (11), viewer drawing specs (5), e2e `drawings.spec` (3: trend draw/render/refresh/select/drag/delete/pan-off/zoom, ray + channel + per-symbol isolation + Clear, daily→weekly anchoring in dark mode). Screenshot `docs/screenshots/10.3-drawings-dark.png`.

## 10.4 results (DONE via 5.4)
Price / volume / indicator panes are stacked y-scales of ONE chart (`stack:'panel'`, weights 6 : 1.5 : 2 per indicator), each with its own y-axis (indicator panes auto-fit or fixed, e.g. RSI 0–100), one shared x-axis, thin separators, zoom/pan/crosshair spanning every pane; verified pixel-level in `e2e/layout.spec` (4 viewport sizes: panes contiguous, axes aligned) and `e2e/chart.spec`. Not done (stretch in the task text): dragging pane borders to resize.

## Phase 10 summary
10.1 dark theme · 10.2 legend rows · 10.3 drawings · 10.4 panes · 10.5 chart types/tools — all DONE; open items: symbol quick-search dialog (10.5), pane-border resizing (10.4), side-by-side comparison against live TradingView screenshots (no access from this environment).
