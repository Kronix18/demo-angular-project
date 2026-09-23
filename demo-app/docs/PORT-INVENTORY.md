# Python Chart Viewer → Angular Port Inventory (Task 0.2)

- **Purpose:** Module-by-module mapping of the Python (PySide6/pyqtgraph) chart viewer to the
  Angular 21 demo-app, with an explicit IN-SCOPE (v1) / OUT-OF-SCOPE (v2) / REPLACED-BY decision
  for every package and file. Feeds tasks 2.x, 3.x, 4.x and especially 5.1–5.3.
- **Date:** 2026-09-23
- **Python source (READ-ONLY):** `C:\Users\kevin\Documents\Programming\screener\viewingApp\`
  — 110 `.py` files, ~57,100 LOC across 10 packages + 4 root files.
- **Angular target:** `C:\Users\kevin\Documents\Programming\demo-angular-project\demo-app`
  (Angular 21 standalone; Chart.js + chartjs-chart-financial + chartjs-plugin-zoom +
  chartjs-adapter-date-fns; chart code under `src/app/charts/`, services under `src/app/core/services/`).
- **Decision legend:** **IN-SCOPE v1** = port the behavior; **OUT-OF-SCOPE v2** = deliberate deferral;
  **REPLACED-BY** = a library/framework replaces the custom implementation (nothing to port).
- **Method:** every file below was opened and read (at minimum imports + class/function
  definitions; full read for all IN-SCOPE files, all calculators, `intervals.py`, `registry.py`,
  `model.py`, `range_presets.py`, `range_controller.py`, `app.py`, `runtime.py`).

---

## 1. Top-level inventory

| Package/File | ~LOC or files | Purpose (1 line) | Decision | Angular target artifact | Target phase |
|---|---|---|---|---|---|
| `app.py` | 109 | Qt composition root: repository → StockService, registry → IndicatorService, SettingsService, MainWindow | REPLACED-BY (Angular bootstrap/DI; its *service wiring contract* still informs the port) | `main.ts` + `app.config.ts` providers; service wiring in state/calc services | 2.1, 4.1, 5.1 |
| `runtime.py` | 125 | Qt platform diagnostics (Wayland/X11/QPA/display Hz/DPR) printed at startup | OUT-OF-SCOPE v2 (desktop-only; browsers expose this via devtools) | — | — |
| `__main__.py` | 7 | `python -m viewingApp` shim | REPLACED-BY (`ng serve` / `npm run build`) | — | — |
| `__init__.py` | 0 | empty package marker | — (no content) | — | — |
| `cache/` | 6 files, 1,473 | Two-tier price/indicator cache: weighted LRU memory + disk, stable-JSON keys, result codec | REPLACED-BY (browser HTTP cache + service-level memoization) | HTTP caching of `public/test-data/*.txt`; memoization in `IndicatorCalculationService` | 6.4 (revisit only) |
| `chart/` | 22 files, 19,233 | pyqtgraph chart widget, plot items, axes, crosshair, range control, LOD, pane manager | SPLIT — 5 files IN-SCOPE v1, 17 REPLACED-BY Chart.js / OUT v2 (detail §2.1) | `src/app/charts/chart-viewer/*`, `chart-state.service.ts` | 2.2, 3.1, 3.3, 4.3, 5.2 |
| `data/` | 4 files, 313 | Stooq-style daily file repository (protocol + impl + CSV→DataFrame column normalization) | IN-SCOPE v1 (concept port: file naming, date format, column mapping) | `chart-data.service.ts` reading `public/test-data/*.us.txt` | 2.1 |
| `drawings/` | 10 files, 4,805 | Drawing tools (trendlines, channels, VWAP, regression), overlay widget, sidebar, store, style dialog | OUT-OF-SCOPE v2 (chartjs-plugin-annotation is the planned v2 basis) | — (v2) | — |
| `indicators/` | 10 files, 2,484 | Indicator model (definitions/instances/results), registry, source resolution, 5 calculators + core math | IN-SCOPE v1 — the heart of Phase 5 (detail §2.3, §4) | `indicator-calculation.service.ts`, `src/app/core/indicators/*`, `indicator-panel` component | 5.1, 5.2, 5.3 |
| `input/` | 3 files, 1,360 | Platform raw mouse input (Windows Raw Input / XInput2) + pointer backend manager | REPLACED-BY (chartjs-plugin-zoom wheel/drag/pinch) | zoom plugin in `chart-viewer` | 3.2 |
| `render_engine/` | 22 files, 15,389 | Custom GPU/RHI renderer prototype + raster widget fallback, scene/camera/scheduler/buffers | REPLACED-BY (Chart.js canvas rendering; nothing to port) | `chartjs-chart-financial` candlestick controller | 2.2 |
| `services/` | 9 files, 2,661 | App services: stock data + intervals, settings, indicator calc, preset store, progressive cache loaders | SPLIT — 5 files IN-SCOPE v1, 3 OUT v2 (detail §2.4) | `chart-data.service.ts`, `chart-state.service.ts`, `indicator-calculation.service.ts` | 2.1, 4.1, 4.3, 5.1 |
| `state/` | 6 files, 1,870 | AppState (symbol/interval/range/indicators), ChartSettings, AppPreferences, shortcuts, layout templates | SPLIT — 3 files IN-SCOPE v1, 2 OUT v2 (detail §2.5) | `chart-state.service.ts` (BehaviorSubject store) | 4.1, 5.3 |
| `ui/` | 14 files, 7,298 | Qt chrome: main window, top/bottom controls, indicator dialogs, quick search, design layer | SPLIT — 4 files IN-SCOPE v1, 9 OUT v2 / REPLACED-BY (detail §2.6) | `chart-toolbar`, `indicator-panel` components | 4.2, 5.3 |

---

## 2. Per-file decisions

### 2.1 `chart/` — 22 files, 19,233 LOC

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `crosshair.py` | 1,516 | `ChartCrosshair`: viewport-native 1px crosshair lines, OHLC info label, `barIndexChanged` signal, ~30 Hz hover sampling | **IN-SCOPE v1** (behavior only: vertical line + OHLCV readout; the raw-input plumbing is not ported) | custom inline Chart.js plugin in `chart-viewer` | 3.3 |
| `date_axis.py` | 84 | `DateAxis(pg.AxisItem)`: zoom-adaptive tick labels (`%Y` / `%b %Y` / `%d %b`) | **IN-SCOPE v1** (label-format rules port; tick generation itself is Chart.js time scale) | time-scale `ticks.callback` in `chart-viewer` | 2.2 |
| `pane_manager.py` | 957 | `ChartPaneManager` (QSplitter) + `IndicatorPaneWidget`: price+volume market group, indicator panes above/below, per-pane `PanelStyle` | **IN-SCOPE v1** (layout *model* only: pane stacking + per-indicator panel style; QSplitter mechanics are not ported — v1 uses single canvas dual axis per task 3.1 decision) | 3.1 decision (dual axis), oscillator pane in `indicator-panel` | 3.1, 5.2 |
| `range_controller.py` | 476 | `ChartRangeController`: applies presets, pan limits (`xMin=-0.5, xMax=count-0.5`), min 10 visible bars, auto-Y refit on X change (price ±5% padding; volume from 0; log variants) | **IN-SCOPE v1** | range/zoom-limit logic in `chart-state.service.ts` + `chart-viewer` | 4.3 (zoom limits 3.2) |
| `range_presets.py` | 134 | `RangePreset` enum (3M/6M/YTD/1Y/2Y/5Y/ALL) + `get_start_index` anchored to the **last available bar**, not today | **IN-SCOPE v1** | preset constants + `startIndexOf()` in `chart-state.service.ts` | 4.3 |
| `widget.py` | 5,296 | `StockChartWidget`: master widget composing plots, items, axes, crosshair, panes, overlay | REPLACED-BY Chart.js (composition lives in `chart-viewer` component) | `chart-viewer.component.ts` | 2.2 |
| `view_box.py` | 91 | `StockViewBox(pg.ViewBox)`: pan-mode viewbox | REPLACED-BY (zoom plugin pan) | — | 3.2 |
| `price_axis.py` | 92 | `PriceAxis`: price tick formatting | REPLACED-BY (Chart.js y scale) | — | 2.2 |
| `volume_axis.py` | 139 | `VolumeAxis`: volume tick formatting | REPLACED-BY (Chart.js y scale) | — | 3.1 |
| `price_bar_item.py` | 1,469 | `PriceBarItem`: candle/HLC/OHLC price series graphics object | REPLACED-BY (chartjs-chart-financial candlestick) | — | 2.2 |
| `volume_item.py` | 1,180 | `VolumeItem`: volume bars, up/down coloring | REPLACED-BY (Chart.js bar dataset) | — | 3.1 |
| `candlestick_item_old.py` | 382 | `CandlestickItemDeprecated`: legacy candle item | OUT-OF-SCOPE (dead legacy code even in Python) | — | — |
| `bar_color_resolver.py` | 346 | `BarColorResolver`: up/down/single coloring incl. previous-close reference mode | REPLACED-BY (dataset `backgroundColor` callback — color rules are simple enough to inline) | color callback in `chart-viewer` | 2.2, 3.1 |
| `lod.py` | 205 | `LODPyramid`: multi-level downsampling of bars | REPLACED-BY (Chart.js built-in `decimation` plugin, LTTB) | `options.plugins.decimation` | 6.4 |
| `performance_monitor.py` | 485 | `ChartPerformanceMonitor`: env-flag driven frame/draw timing | OUT-OF-SCOPE v2 (v1 uses devtools profiler; perf *targets* live in 6.4) | — | 6.4 (targets only) |
| `axis_value_overlay.py` | 690 | `AxisValueOverlay`: floating price/volume badges on axes | OUT-OF-SCOPE v2 (polish) | — | v2 |
| `indicator_line_item.py` | 712 | `IndicatorLineItem`: indicator line/histogram graphics object | REPLACED-BY (Chart.js line/bar datasets) | indicator datasets in `indicator-panel` | 5.2 |
| `indicator_layer.py` | 309 | `IndicatorLayer`: groups rendered outputs per instance | REPLACED-BY (dataset grouping in the panel service) | — | 5.2 |
| `indicator_layer_cache.py` | 801 | `CachedIndicatorLayer`: rendered-layer cache keyed by stable-JSON hash | REPLACED-BY (service memoization v1; full layer cache v2) | memoization in `IndicatorCalculationService` | 5.1 |
| `indicator_overlay.py` | 2,577 | `IndicatorOverlay` + `PriceLegendOverlay`: TradingView-like legend rows (eye toggles, per-output style chips, symbol editor) over the chart | OUT-OF-SCOPE v2 for the full Qt overlay, but its *UX contract* (row per instance, visibility eye, label template) is the reference for the panel legend | `indicator-panel` component legend | 5.2, 5.3 |
| `selection_emphasis.py` | 1,292 | `IndicatorSelectionEmphasis`: hover-highlight of indicator lines | OUT-OF-SCOPE v2 | — | v2 |
| `__init__.py` | 0 | empty | — | — | — |

### 2.2 `data/` — 4 files, 313 LOC

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `stock_repository.py` | 11 | `StockRepository` Protocol: `get_daily_ohlcv(symbol)` | **IN-SCOPE v1** (the interface contract) | `ChartDataService.getOHLCV()` | 2.1 |
| `dummy_stock_repository.py` | 264 | `DummyStockRepository`: resolves Stooq files (`^<index>.txt`, `<ticker>.<cc>.txt`), env-var roots, basename index | **IN-SCOPE v1** (file-naming + resolution conventions) | URL builder `test-data/${sym}.us.txt` in `chart-data.service.ts` | 2.1 |
| `data.py` | 38 | `convertToDf`: CSV → DataFrame with column regex-normalization (ticker→symbol, vol→volume, strips `<>` parens) | **IN-SCOPE v1** (the Stooq header/date contract: `Date,Open,High,Low,Close,Volume` + `YYYYMMDD`) | `parseStockData()` in `chart-data.service.ts` | 2.1 |
| `__init__.py` | 0 | empty | — | — | — |

### 2.3 `indicators/` — 10 files, 2,484 LOC — ALL IN-SCOPE v1 (detail §4)

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `model.py` | 632 | Definition/instance/result dataclasses + param/output/style/panel enums & persistence | **IN-SCOPE v1** | `src/app/core/indicators/model.ts` (types) | 5.1, 5.2 |
| `registry.py` | 399 | `IndicatorRegistry` + `create_default_registry()` (API in §4.1) | **IN-SCOPE v1** | registry map in `indicator-calculation.service.ts` | 5.1 |
| `sources.py` | 105 | `SOURCE_CHOICES` + `resolve_source` (open/high/low/close/hl2/hlc3/ohlc4/volume) | **IN-SCOPE v1** — required by MA & RSI | `resolveSource()` helper | 5.1 |
| `calculators/moving_average.py` | 262 | SMA/EMA/WMA/RMA with source + offset (§4.3) | **IN-SCOPE v1** | `moving-average.ts` | 5.1 |
| `calculators/rsi.py` | 297 | Wilder RSI + overbought/oversold lines (§4.3) | **IN-SCOPE v1** | `rsi.ts` | 5.1 |
| `calculators/atr.py` | 252 | True range + RMA/SMA/EMA/WMA smoothing (§4.3) | **IN-SCOPE v1** | `atr.ts` | 5.1 |
| `calculators/webby_rsi.py` | 135 | Definition + mode dispatch (Original vs 5.150) (§4.3) | **IN-SCOPE v1** | `webby-rsi.ts` | 5.1 |
| `calculators/webby_rsi_core.py` | 124 | The actual Webby RSI math: `ema`, `sma`, `wilder_atr`, `original`, `version_5150` | **IN-SCOPE v1** — webby_rsi.py is only a dispatcher; the math lives here | `webby-rsi-core.ts` | 5.1 |
| `calculators/bob_marley.py` | 278 | Off-high ATR distance, zone segmentation, reference-high lookback heuristic (§4.3) | **IN-SCOPE v1** | `bob-marley.ts` | 5.1 |
| `__init__.py` | 0 | empty | — | — | — |

### 2.4 `services/` — 9 files, 2,661 LOC

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `intervals.py` | 99 | `IntervalType`/`IntervalSpec` + the 10 supported intervals (§3) | **IN-SCOPE v1** | interval constants in `chart-state.service.ts` | 4.3 |
| `stock_service.py` | 224 | `StockService.load_ohlcv(symbol, interval)`: daily fetch, `YYYYMMDD` normalization, weekly `W-FRI` resample, month-bucket aggregation | **IN-SCOPE v1** (esp. the aggregation rules) | `chart-data.service.ts` + aggregation helper | 2.1, 4.3 |
| `settings_service.py` | 163 | `SettingsService`: versioned (v4) config.json load/save, atomic write, shortcut migration; broken config never blocks startup | **IN-SCOPE v1** (load/save/migrate/atomicity + fail-open semantics only; shortcuts themselves are v2) | sessionStorage persistence in `chart-state.service.ts` | 4.1 |
| `preset_store.py` | 94 | `NamedPresetStore`: versioned JSON store, name normalization (≤80 chars, whitespace-collapsed), atomic write, get/save/delete/rename | **IN-SCOPE v1** (semantics inform 4.1 persistence; named-preset *UI* is v2) | persistence helper / v2 localStorage store | 4.1 |
| `indicator_service.py` | 187 | `IndicatorService.calculate_all`: per-DataFrame-context cache, JSON-sorted per-parameter key, interval + enabled filtering | **IN-SCOPE v1** (cache-on-data-identity + memoization) | `IndicatorCalculationService` | 5.1 |
| `cache_adapters.py` | 260 | Signature-based adapters bridging services to the cache layer | OUT-OF-SCOPE v2 (cache REPLACED-BY browser) | — | — |
| `progressive_cache_integration.py` | 135 | Installs the progressive loader into the chart widget | OUT-OF-SCOPE v2 | — | — |
| `progressive_chart_loader.py` | 1,499 | Background thread loader that fills chart history progressively from disk cache | OUT-OF-SCOPE v2 (static test files need no progressive loading; revisit only if 6.4 struggles) | — | — |
| `__init__.py` | 0 | empty | — | — | — |

### 2.5 `state/` — 6 files, 1,870 LOC

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `app_state.py` | 135 | `AppState`: symbol (default `NDX`), interval (`1D`), chart_range (`1Y`), indicators, chart_settings, preferences; to/from_dict | **IN-SCOPE v1** (field shape; default deltas noted in §3.3) | `ChartStateService` state object | 4.1 |
| `chart_settings.py` | 626 | `ChartSettings` (bar_style candlestick/hlc/ohlc, up/down/single colors, price/volume visibility, log scales, last-price line) + `BarColorMode`/`BarStyle` enums with fuzzy alias parsing | **IN-SCOPE v1** (settings shape; v1 uses bar style + colors + visibility only) | state type in `chart-state.service.ts` | 4.1 (colors 2.2/3.1) |
| `workspace_presets.py` | 88 | `capture_layout`/`apply_layout_to_state` + indicator template capture/instantiate (strips id/intervals, re-uuids on apply) | **IN-SCOPE v1** (template capture/instantiate semantics for 5.3) | template helpers in indicator state | 5.3 (layout 4.1) |
| `app_preferences.py` | 523 | `AppPreferences`: 30+ desktop prefs (splitter widths/seam colors, raw-input, render profile, pane ratios) | OUT-OF-SCOPE v2 (desktop chrome prefs; only `market_price_ratio`/`pane_order` are interesting and both are v2) | — | v2 |
| `shortcut_definitions.py` | 498 | Keyboard shortcut registry + config migration | OUT-OF-SCOPE v2 (no keyboard shortcuts in v1) | — | v2 |
| `__init__.py` | 0 | empty | — | — | — |

### 2.6 `ui/` — 14 files, 7,298 LOC

| File | ~LOC | Purpose | Decision | Angular target | Phase |
|---|---|---|---|---|---|
| `chart_controls.py` | 598 | `ChartControls`: top toolbar — interval buttons (from `INTERVALS`), bar-style menu, range preset buttons (from `RANGE_PRESETS`), Auto-scale button (click=fit once, double-click=persistent auto), symbol load with submit semantics, indicator buttons | **IN-SCOPE v1** (toolbar *behavior*: submit-semantics symbol entry, interval + range buttons; Qt menus don't port) | `chart-toolbar` component (writes to `ChartStateService`) | 4.2 (range buttons 4.3) |
| `indicator_manager.py` | 607 | `IndicatorManagerDialog`: list of active instances, add from registry definitions (sorted by category+name), edit, delete, enable toggle | **IN-SCOPE v1** (CRUD semantics at v1 fidelity — list + add + remove + enable) | `indicator-panel` component | 5.3 |
| `indicator_editor.py` | 1,338 | `IndicatorEditorDialog`: parameter editors per `ParameterType` (int/float/bool/choice/source), per-output style editors, per-interval visibility checkboxes | **IN-SCOPE v1** as a *minimal inline editor* (params by type schema; per-output styles & interval checkboxes are v2) | inline form in `indicator-panel` | 5.3 |
| `quick_search_dialog.py` | 188 | `QuickSearchDialog`: TradingView-like palette ranking commands/symbols (fuzzy scoring, symbol regex) | **IN-SCOPE v1** (v1 takes only the symbol-entry part; full palette is v2) | symbol input in `chart-toolbar` | 4.2 (palette v2) |
| `main_window.py` | 2,233 | `MainWindow`: shell wiring every dialog, service, shortcut, chart widget | REPLACED-BY (Angular app shell + routes; wiring contracts live in 4.x/5.x tasks) | routes + `app.ts` shell | 6.1 |
| `chart_settings_dialog.py` | 479 | Dialog editing `ChartSettings` (bar style, colors, log scales) | OUT-OF-SCOPE v2 (v1 has no settings dialog; defaults from `chart_settings.py` suffice) | — | v2 |
| `preferences_dialog.py` | 1,036 | Dialog for `AppPreferences` | OUT-OF-SCOPE v2 | — | v2 |
| `shortcut_editor.py` | 316 | Dialog for shortcut bindings | OUT-OF-SCOPE v2 | — | v2 |
| `preset_dialogs.py` | 133 | Saved-layouts + indicator-templates manager dialogs (over `NamedPresetStore`) | OUT-OF-SCOPE v2 (store semantics port in 4.1; the dialogs are v2) | — | v2 |
| `design/__init__.py` | 19 | design layer re-exports | REPLACED-BY (Angular design tokens) | theme SCSS | 6.2 |
| `design/theme.py` | 103 | QSS constants: bar heights, icon sizes, colors | REPLACED-BY (CSS custom properties) | theme SCSS tokens | 6.2 |
| `design/icons.py` | 182 | Runtime-generated QIcons | REPLACED-BY (inline SVG/emoji in templates) | — | 6.2 |
| `design/shortcut_hints.py` | 66 | Shortcut display helpers | OUT-OF-SCOPE v2 (no shortcuts in v1) | — | v2 |
| `__init__.py` | 0 | empty | — | — | — |

### 2.7 Packages with uniform decisions

- **`render_engine/` — 22 files, 15,389 LOC — REPLACED-BY Chart.js.** The entire custom
  RHI/GPU renderer stack (`raster_widget.py` 11,634; `rhi_prototype.py` 684; `rhi_shaders.py`;
  `rhi_geometry.py`; `rhi_probe.py`; `backend.py`; `factory.py`; `camera.py`; `scene.py`;
  `profiles.py`; `frame_scheduler.py`; `market_buffers.py`; `pane_layout.py`; `axis_ticks.py`;
  `dirty.py`; `drag_gesture.py`; `environment.py`; `diagnostics.py`; `platform_capabilities.py`;
  `pan_preview.py`; `raster_cache.py`; `__init__.py`). Nothing here maps to Angular — Chart.js
  owns rendering. **Delta vs task file:** the audit text said "44 files"; on disk there are
  **22** `.py` files (15,389 LOC).
- **`input/` — 3 files, 1,360 LOC — REPLACED-BY chartjs-plugin-zoom** (task 3.2).
  `native_mouse.py` (1,255: Windows Raw Input / XInput2 ctypes machinery), `pointer.py` (92:
  backend probe/manager), `__init__.py` (13). Desktop raw input has no web equivalent; wheel
  zoom + drag pan come from the plugin.
- **`drawings/` — 10 files, 4,805 LOC — OUT-OF-SCOPE v2.** `model.py` (DrawingObject/Anchor/Style),
  `catalog.py` (tool registry), `controller.py`, `overlay.py`, `sidebar.py`, `store.py`,
  `analytics.py` (anchored VWAP, regression channel), `settings_schema.py`, `style_dialog.py`,
  `__init__.py` (lazy `__getattr__` loader). v2 basis: chartjs-plugin-annotation.
- **`cache/` — 6 files, 1,473 LOC — REPLACED-BY browser HTTP cache + service memoization.**
  `cache_manager.py` (516), `disk_cache.py` (581), `memory_cache.py` (132), `keys.py` (162),
  `result_codec.py` (61), `__init__.py` (21).

---

## 3. Interval model (extract from `services/intervals.py`) — feeds 4.3

### 3.1 Data shape

```python
class IntervalType(str, Enum):     # two families
    TIME = "time"                   # calendar-based aggregation of daily bars
    RANGE = "range"                # fixed tick-count range bars

@dataclass(frozen=True, slots=True)
class IntervalSpec:
    code: str                      # toolbar button label, e.g. "1D", "3M", "100R"
    label: str
    type: IntervalType
    months: int | None = None       # TIME only: months per bucket
    range_ticks: int | None = None # RANGE only: ticks per bar
```

### 3.2 All 10 supported intervals

| Code | Type | months | range_ticks | Meaning / how the app builds it |
|---|---|---|---|---|
| `1D` | TIME | — | — | raw daily bars, passthrough (no aggregation) |
| `1W` | TIME | — | — | weekly resample, anchored **W-FRI** (open=first, high=max, low=min, close=last, volume=sum) |
| `1M` | TIME | 1 | — | calendar-month buckets (1 month) |
| `3M` | TIME | 3 | — | quarterly buckets (3 calendar months) |
| `6M` | TIME | 6 | — | half-year buckets |
| `12M` | TIME | 12 | — | yearly buckets |
| `1R` | RANGE | — | 1 | 1-tick range bars |
| `10R` | RANGE | — | 10 | 10-tick range bars |
| `100R` | RANGE | — | 100 | 100-tick range bars |
| `1000R` | RANGE | — | 1000 | 1000-tick range bars |

Lookup: `INTERVAL_BY_CODE` dict; `get_interval(code)` raises `ValueError("Unsupported interval: …")` on unknown codes.

### 3.3 How intervals relate to range presets — the two-axis model

The Python app separates **interval** (how bars are built) from **chart_range** (how much
history is visible):

- `state/app_state.py` defaults: `symbol="NDX"`, `interval="1D"`, `chart_range="1Y"`.
  **Delta:** task 4.1 uses `{symbol:'msft', interval:'1d', range:'6m'}` for the Angular app —
  follow the task file; the Python defaults don't bind the demo.
- Month-bucket rule (`stock_service._to_month_bars`): bucket = `year*12 + month - 1`,
  floor-divided by `months`; bars take `date=last`, `open=first`, `high=max`, `low=min`,
  `close=last`, `volume=sum`. Only `months ∈ {1, 3, 6, 12}` accepted.
- Weekly uses `resample("W-FRI")` (week ending Friday), not ISO weeks. Task 4.3's ISO-week
  aggregation is a documented simplification — keep whichever the task spec test fixes.
- **Range bars (`1R`–`1000R`) are NOT implemented in Python** — `stock_service._load_range_bars`
  raises `NotImplementedError("Range bars are not yet implemented.")`. The Angular v1 should
  therefore ship only the TIME intervals the demo data can serve (1D/1W + month buckets per
  4.3), and treat RANGE as a non-goal. **Delta vs expected IN-SCOPE list:** `intervals.py`
  itself is fully IN-SCOPE (the spec table above ports), but only its TIME half is exercisable.

### 3.4 Range presets (extract from `chart/range_presets.py`) — also feeds 4.3

Preset enum: **3M, 6M, YTD, 1Y, 2Y, 5Y, ALL** (`RANGE_PRESETS` tuple in this order).
`get_start_index(dates, preset)` semantics to port exactly:

- Reference point is the **LAST AVAILABLE BAR's date**, not today's date.
- 3M/6M → `latest - DateOffset(months=N)`; 1Y/2Y/5Y → `latest - DateOffset(years=N)`;
  YTD → `Jan 1 of the latest bar's year`; ALL → index 0.
- Then `dates.searchsorted(target, side="left")`, clamped to `[0, len(dates)-1]`.
- Task 4.3's button set is `1M/3M/6M/YTD/1Y/ALL` — a subset plus `1M`; Python has no `1M`
  range preset (it has a `1M` *interval*). Follow the task file for buttons; port the
  last-bar-anchored computation rule verbatim.
- `chart/range_controller.py` extras worth porting: X pan limits clamp to
  `[-0.5, count-0.5]` (no panning past history), min visible bars = 10, selecting a preset
  re-enables auto-Y, price Y padding ±5%, volume Y from 0 with no top padding.

---

## 4. Indicator registry shape (extract from `indicators/registry.py` + `model.py`) — feeds 5.1–5.3

### 4.1 Registry API (`IndicatorRegistry`)

| Method | Signature | Behavior to port |
|---|---|---|
| `register` | `(definition: IndicatorDefinition, calculator) -> None` | raises `ValueError("Indicator already registered: …")` on duplicate id |
| `definitions` | `() -> tuple[IndicatorDefinition, ...]` | all definitions **sorted by (category, name)** — this ordering drives the Add-Indicator menu in 5.3 |
| `definition` | `(definition_id: str) -> IndicatorDefinition` | raises `ValueError("Unknown indicator: …")` on miss |
| `create_instance` | `(definition_id: str, interval: str) -> IndicatorInstance` | instantiates with default params, default output styles, default panel style |
| `normalize` | `(instance) -> IndicatorInstance` | fills missing params from defaults (setdefault), fills missing per-output styles from defaults — never overwrites existing values |
| `resolve_pane` | `(instance) -> IndicatorPane` | PRICE / VOLUME / OWN / SOURCE_AWARE (→ VOLUME if `parameters.source == "volume"` else PRICE) |
| `display_name` | `(instance) -> str` | `label_template.format(**parameters)` with fallback to `definition.name` on any error |
| `calculate` | `(df, instance) -> IndicatorResult` | normalize → dispatch to calculator → wraps `{instance_id, definition_id, pane, outputs}` |

`create_default_registry()` registers exactly 5 indicators (registration order):
`moving_average`, `atr`, `rsi`, `webby_rsi`, `bob_marley`.
Task 5.1 wants `supportedIndicators` + `calculate(type, params, ohlcv)` mirroring this shape.

### 4.2 Model types (`indicators/model.py`)

- `ParameterType`: `integer | float | boolean | choice | source`
- `IndicatorPane` = `PanePolicy` values: `price | volume | own | source_aware`
- `RenderType`: `line | histogram`; `LineStyle`: `solid | dash | dot | dash_dot`
- `ParameterSpec`: `{key, label, type, default, minimum?, maximum?, step?, choices?}`
  (choices = tuples of `(value, label)`)
- `OutputSpec`: `{key, label, render_type=LINE, default_color="#4c9aff", default_width=1.0, default_line_style=SOLID}`
- `IndicatorDefinition`: `{id, name, category, parameters[], outputs[], pane_policy,
  label_template?, default_panel_height=180, default_y_range?}` — `default_y_range=(0,100)`
  makes RSI fixed-range; `None` means auto (ATR, Webby, Bob Marley)
- `IndicatorInstance`: `{id (uuid), definition_id, enabled, intervals[], parameters{},
  styles{output_key→OutputStyle}, panel_style}` — **`intervals` = per-timeframe visibility**
  (an instance with `["1D"]` does not render on 1W; `calculate_all` filters on it)
- `IndicatorResult`: `{instance_id, definition_id, pane, outputs: {key → number[]}}`

### 4.3 Calculator-by-calculator contract (CRITICAL for 5.1)

All calculators are static: `calculate(df, parameters) -> dict[str, np.ndarray]` (NaN-padded
to input length). **Golden-value tests must be generated from these exact files** (task 5.1).

#### `calculators/moving_average.py` — `MOVING_AVERAGE_DEFINITION` (id `moving_average`, "Moving Average", Trend)
- Params: `method` CHOICE default `"SMA"` ∈ {SMA, EMA, WMA, RMA}; `source` SOURCE default
  `"close"`; `length` INT default 50, min 1, max 10000, step 1; `offset` INT default 0,
  min −5000, max 5000.
- Output: `ma` (LINE, `#4c9aff`). `pane_policy=SOURCE_AWARE` (volume source → volume pane).
- `label_template="{method} {length} {source}"`.
- Math (class `MovingAverageCalculator.calculate`):
  - SMA: `rolling(length, min_periods=length).mean()`
  - EMA: `ewm(span=length, adjust=False, min_periods=length).mean()`
  - **RMA/Wilder: `ewm(alpha=1/length, adjust=False, min_periods=length)`** — NOT textbook
    seed-then-recurrence; pandas ewm starts from the first value. Port this exact seed
    semantics or golden tests will diverge.
  - WMA: weights `1..length`, dot/denominator, `min_periods=length`
  - `offset != 0` → `shift(offset)` (positive = future shift)

#### `calculators/rsi.py` — `RSI_DEFINITION` (id `rsi`, "Relative Strength Index", Momentum)
- Params: `source` SOURCE default `"close"`; `length` INT default 14 (1..10000);
  `overbought` FLOAT default 70.0 (0..100, step 1); `oversold` FLOAT default 30.0.
- Outputs: `rsi` (LINE `#a78bfa`), `overbought` (DASH `#6b7280`), `oversold` (DASH `#6b7280`).
  `pane_policy=OWN`, `default_y_range=(0, 100)`, `label_template="RSI {length}"`.
- Math (class `RSICalculator.calculate`): `delta=diff`, `gain=clip(lower=0)`, `loss=-clip(upper=0)`,
  **`avg_gain`/`avg_loss` via `ewm(alpha=1/length, adjust=False, min_periods=length)`** (Wilder),
  `rsi = 100 − 100/(1+rs)`; flat input (avg_gain==0 & avg_loss==0) → 50.0; gains-no-losses
  (avg_gain>0 & avg_loss==0) → 100.0. Overbought/oversold are constant-filled arrays.

#### `calculators/atr.py` — `ATR_DEFINITION` (id `atr`, "Average True Range", Volatility)
- Params: `length` INT default 14 (1..10000); `smoothing` CHOICE default `"RMA"` ∈
  {RMA, SMA, EMA, WMA}.
- Output: `atr` (LINE `#f59e0b`). `pane_policy=OWN`, `default_y_range=None` (auto),
  `label_template="ATR {length}"`.
- Math (class `ATRCalculator.calculate`): true range = max(high−low, |high−prevClose|,
  |low−prevClose|); **first bar TR = high[0]−low[0]** (no prev close); then the same 4
  smoothing kernels as moving_average (RMA default = `ewm(alpha=1/length)`).

#### `calculators/webby_rsi.py` + `calculators/webby_rsi_core.py` — `WEBBY_RSI_DEFINITION` (id `webby_rsi`, "Webby RSI", IBD / CANSLIM)
- Params: `mode` CHOICE default `"5.150"` ∈ {5.150, Original}; `ema_length` INT default 21;
  `sma_length` INT default 10; `atr_length` INT default 50; `stretched_level` FLOAT default
  3.0 (0..100, step 0.25); `signal_length` INT default 10; `positive_only` BOOLEAN default true.
- Outputs: Original mode → `webby` (`#38bdf8`), `signal` (`#a78bfa`), `level_0/level_05/
  level_2/level_4/level_6` (dashed reference lines at 0/0.5/2/4/6); 5.150 mode → `above_21`
  (green), `below_21` (red), `sma_extension` (orange), `stretched` (dashed `#f97316`).
  `pane_policy=OWN`, `label_template="Webby RSI {mode}"`.
- Math: `webby_rsi.py` is only a **dispatcher** — mode aliases {original/classic/1.0/v1} vs
  {5.150/5150/2.0/2/v2}; the implementations live in `webby_rsi_core.py`:
  - `original(df, ema_length, signal_length, positive_only)`: `raw = (low − ema21)/close × 100`;
    `signal = sma(raw, signal_length)`; `positive_only` masks negatives to NaN; returns
    webby + signal + 5 constant level arrays.
  - `version_5150(df, ema_length, sma_length, atr_length, stretched_level)`:
    `above_21 = (low−ema21)/atr` where >0 else NaN; `below_21 = (ema21−high)/atr` where >0
    else NaN; `sma_extension = (high−sma10)/atr` where >0 else NaN; `stretched` = constant array.
  - Shared helpers: `ema(values, length)` = `ewm(span=length, adjust=False, min_periods=length)`;
    `sma` = `rolling(length, min_periods=length).mean()`; `wilder_atr(df, length)` = TR with
    first-bar special case, then `ewm(alpha=1/length, adjust=False, min_periods=length)`.
- **Note for 5.1:** `bob_marley.py` imports `wilder_atr` from `webby_rsi_core` — port it once, share it.

#### `calculators/bob_marley.py` — `BOB_MARLEY_DEFINITION` (id `bob_marley`, "Bob Marley Off-High ATR", IBD / CANSLIM)
- Params: `high_reference` CHOICE default `"52_week"` ∈ {52_week, 50_day, 18_month, all_time};
  `source` CHOICE default `"low"` ∈ {low, close}; `atr_length` INT default 21 (1..1000);
  `green_max` FLOAT default 4.0; `yellow_max` FLOAT default 8.0; `invert_axis` BOOLEAN default false.
- Outputs: `green` (0–4 ATR, `#22c55e`), `yellow` (4–8 ATR, `#eab308`), `red` (>8 ATR,
  `#ef4444`), `green_boundary`, `red_boundary` (dashed). `pane_policy=OWN`,
  `label_template="Bob Marley {high_reference}"`.
- Math (`calculate_bob_marley` + `BobMarleyCalculator.calculate`):
  `distance = (reference_high − source_price) / wilder_atr(atr_length)`, clamped ≥ 0;
  lookback heuristic `_sessions_per_bar` derives sessions-per-bar from **median date spacing**
  (≤3d→1, ≤10d→5, ≤45d→21, ≤120d→63, ≤240d→126, else 252), then `_lookback_bars` =
  round(target_sessions / sessions_per_bar) with targets {50_day: 50, 52_week: 252,
  18_month: 378}, `all_time` → `np.maximum.accumulate(high)`; output split into green/
  yellow/red segments by `green_max`/`yellow_max` thresholds (NaN elsewhere) so a generic
  line renderer colors zones without special-casing. Empty df → empty arrays.
- **Note:** `invert_axis` is a *renderer* param (Y-axis flip) — no calculator effect; matters
  for 5.2 pane rendering, not 5.1 math.

### 4.4 Source resolution (`indicators/sources.py`) — shared helper for MA/RSI

`SOURCE_CHOICES`: `open, high, low, close, hl2 (=(H+L)/2), hlc3 (=(H+L+C)/3), ohlc4
(=(O+H+L+C)/4), volume`. `resolve_source(df, source)` lowercases/strips, maps directly to
columns or computes derived OHLC averages, raises `ValueError("Unsupported indicator
source: …")` otherwise. MA and RSI both take a `source` param; ATR/Webby/BobMarley are
hard-wired to their OHLC columns.

### 4.5 Service-layer semantics (`services/indicator_service.py`) — feeds 5.1

`IndicatorService.calculate_all(df, instances, interval)`:
1. skips instances with `enabled=false`;
2. skips instances whose `intervals` list doesn't contain the current interval
   (**per-timeframe indicator visibility** — this is the Python feature the Angular v1
   indicator state should model even if the editor UI for it is v2);
3. memoizes per `(definition_id, sorted-JSON(parameters))`, invalidating when the
   DataFrame identity changes.

---

## 5. Expected-scope deltas (task file vs actual files)

The task file's expected list was verified against disk. Deltas found (all followed the
files, per the rules):

1. **`render_engine/*` file count:** audit text said "44 files"; actual = **22 `.py` files**
   (15,389 LOC). Decision unchanged (REPLACED-BY Chart.js).
2. **`indicators/calculators/*` is 5 calculators but 6 files:** the expected list
   (`moving_average, rsi, atr, webby_rsi, bob_marley`) omits **`webby_rsi_core.py`**, which
   holds the actual Webby RSI math AND the shared `wilder_atr` used by `bob_marley.py`.
   It is IN-SCOPE (all 6 files) — task 5.1 already names it.
3. **Range bars not implemented in Python:** `stock_service._load_range_bars` raises
   `NotImplementedError`, so intervals `1R/10R/100R/1000R` are spec-only. Angular v1
   should port the TIME intervals only.
4. **`ui/design/` subpackage:** the expected list didn't mention it; it's 4 files
   (370 LOC), classified REPLACED-BY Angular design tokens (theme SCSS, task 6.2).
5. **`data/data.py` is IN-SCOPE** (part of the expected `data` handling even though the
   task's IN-SCOPE list didn't name it) — its column-normalization regexes define the
   Stooq file contract that task 2.1 must parse.
6. **Root files `__main__.py` / `__init__.py`** got explicit decisions (REPLACED-BY / empty)
   even though only `app.py` + `runtime.py` were named.

## 6. Coverage check

Every top-level package + entry file has an explicit decision (10 packages + 4 root files):

| # | Item | Decision |
|---|---|---|
| 1 | `app.py` | REPLACED-BY (Angular bootstrap/DI) |
| 2 | `runtime.py` | OUT-OF-SCOPE v2 |
| 3 | `__main__.py` | REPLACED-BY |
| 4 | `__init__.py` | empty, no content |
| 5 | `cache/` (6 files) | REPLACED-BY browser cache |
| 6 | `chart/` (22 files) | SPLIT: 5 IN-SCOPE v1, 17 OUT/REPLACED (§2.1) |
| 7 | `data/` (4 files) | IN-SCOPE v1 (3 substantive) |
| 8 | `drawings/` (10 files) | OUT-OF-SCOPE v2 |
| 9 | `indicators/` (10 files) | IN-SCOPE v1 (all) |
| 10 | `input/` (3 files) | REPLACED-BY chartjs-plugin-zoom |
| 11 | `render_engine/` (22 files) | REPLACED-BY Chart.js |
| 12 | `services/` (9 files) | SPLIT: 5 IN-SCOPE v1, 3 OUT v2 (§2.4) |
| 13 | `state/` (6 files) | SPLIT: 3 IN-SCOPE v1, 2 OUT v2 (§2.5) |
| 14 | `ui/` (14 files) | SPLIT: 4 IN-SCOPE v1, 9 OUT/REPLACED (§2.6) |

**IN-SCOPE v1 totals: 29 files** across 6 packages —
chart 5, data 3, indicators 9 (incl. calculators 6), services 5, state 3, ui 4 — every one
mapped to an Angular target artifact and a phase in §2.
**OUT/REPLACED totals: 81 files** — root 4 (`app.py`, `runtime.py`, `__main__.py`,
`__init__.py`), render_engine 22, chart 17, drawings 10, ui 10, cache 6, input 3,
services 4, state 3, data 1, indicators 1 — a breakdown that includes all 12
`__init__.py` files (7 empty, 5 non-empty and covered by their package's uniform decision).
**29 + 81 = 110 files**, matching the on-disk `.py` count exactly.
**Phase-5 indicator cross-check (task 5.1):** all 6 calculator files on disk
(`moving_average.py`, `rsi.py`, `atr.py`, `webby_rsi.py`, `webby_rsi_core.py`,
`bob_marley.py`) are inventoried in §2.3/§4.3 with class names, params and math contracts —
task 5.1's file list matches disk exactly.

