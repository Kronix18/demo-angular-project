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

### 10.2 — TradingView Legend Rows (OHLC row + eye toggles)
**Files:** new `chart-legend` component (overlay top-left of chart), state service.
**Spec:** TradingView-style: first row = symbol + interval + OHLC values of the
hovered bar (live-updating on crosshair move); indicator rows (5.2) each with an
eye visibility toggle + color chip + remove ✕. Values format: O/H/L/C with 2 decimals.
**Python reference:** chart/indicator_overlay.py (PriceLegendOverlay UX contract —
row per instance, visibility eye, label template).
**Verify:** hover a bar → legend OHLC values update live (screenshot sequence);
eye toggle hides/shows the indicator series; pixel-verified.

### 10.3 — Drawing Tools (trendlines, horizontal rays, channels)
**Files:** new `chart-drawings` component + drawing store service (sessionStorage
persistence), chartjs-plugin-annotation (ADD dependency).
**Spec:** v2 scope per original inventory (drawings/*): trendline (2-point),
horizontal ray (price level), channel (parallel lines). Drag-to-place, click to
select, Del to remove; persisted per symbol in sessionStorage.
**Verify:** draw a trendline → appears + survives refresh; remove works;
annotations don't break zoom/pan (3.2) — annotation plugin scales with the chart.

### 10.4 — Multi-Pane Layout (true panes, per-pane Y)
**Files:** chart-viewer template (panes stacked), pane layout service.
**Spec:** upgrade the v1 dual-axis single canvas to TradingView's true pane model:
price pane (~70%), volume pane (~15%, own scale), indicator panes (~15% each);
shared x-axis; per-pane separators; drag pane borders to resize (stretch goal).
**Python reference:** chart/pane_manager.py (the layout model, port target).
**Verify:** panes visually proportioned (screenshot vs TradingView multi-pane);
each pane's y-axis independent; zoom/pan syncs all panes; pixel-verified.

### 10.5 — TradingView Bottom Toolbar & Interactions Polish
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
