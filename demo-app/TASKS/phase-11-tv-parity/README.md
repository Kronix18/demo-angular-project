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
| 11.4 | Auto-scale toggle, vertical pan, log price + volume | DONE |
| 11.5 | Drawing sidebar + tools | DONE |
| 11.6 | Symbol + volume settings from the legend | DONE |
| 11.7 | Full TradingView drawing tool set (7 groups, 50+ tools) | DONE |
| — | Bug: indicator lines clipped short while panning | FIXED |
| 11.8 | Full-height sidebar column, bottom scale bar (zoom, invert, %, log, auto), cursor group + eraser | DONE |
| 11.9 | Second wave of drawing tools (90+ total) | DONE |
| 11.10 | Undo / redo, clone, Alt shortcuts, remove menu | DONE |
| 11.11 | Last price line, chart settings, context menu, keyboard navigation | DONE |
| 11.12 | Per-drawing lock / hide / z-order, anchored text, table, emoji picker, ghost feed, anchored volume profile | DONE |
| 11.13 | Demo cursor, go to date, lock scale, fit all, clock + timezone + session, bar countdown | DONE |
| 11.14 | Side panel: object tree, data window, watchlist | DONE |
| 11.15 | Price alerts, bar replay, toasts | DONE |
| 11.16 | Compare symbols | DONE |
| 11.17 | Saved layouts, indicator templates | DONE |
| 11.18 | Drawn (SVG) icons everywhere instead of emoji / symbol characters | DONE |
| 11.19 | Drag pane borders to resize price / volume / indicator panes | DONE |

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

## 11.4 results — price scale
- **Why you could not pan up/down**: the price pane was always auto-fit to the visible bars, with no way out. Now `auto` (bottom-right, like TradingView) is on by default and **switches off when you drag the chart vertically** (an 8px dead-zone stops a slightly diagonal horizontal drag from switching it off). In manual mode the price range is yours: pan freely (also below/above the data), horizontal pan/zoom and indicator changes keep it, and clicking `auto` — or double-clicking the price axis — re-fits. Dragging **on the price axis** scales the range around its centre (drag down = zoom out). A drag that started on a drawing moves the drawing, not the scale. Manual scale resets on symbol / range / interval / log / brick-style changes.
- **Logarithmic scale** (`log`, persisted in the chart state): price **and volume** go logarithmic together (zero-volume bars are dropped, the y-fits are multiplicative). Legend, crosshair labels, magnet, drawings (anchored in price) all follow. Screenshot `docs/screenshots/11.4-log-all-dark.png`: 40 years of MSFT readable on one axis.
- Maths in `charts/y-scale-math.ts` (pure, tested): `panRange` (linear shift / log ratio), `scaleRange` (centre-preserving, never collapses), `fitRangeLog`.
- Tests: y-scale-math (9), state logScale, viewer "price scale" (9: log buttons + volume, log fit, vertical pan, jitter, axis scale, manual survives x-pan and indicator toggle, resets on range, dblclick axis, drawing drag), e2e price-scale flow (mouse pan/scale/auto/log/reload/ALL in log).

## 11.5 results — drawing sidebar and tools
- **Left sidebar** (`drawings/drawing-sidebar.component.ts`): cursor, trend line, arrow, ray, horizontal line, vertical line, parallel channel, rectangle, ellipse, fib retracement, brush, text, **measure**, **zoom**, then magnet (moved here from the header), stay-in-drawing-mode, lock all, hide all, delete all. After a drawing is committed the tool returns to the cursor unless *stay in drawing mode* is on; Esc leaves the tool; picking a tool un-hides drawings.
- **Model**: anchors are still `(timestamp, price)` so every type survives interval / log / symbol changes; new fields `pts` (brush), `text`, `style {color,width,dash}`. Geometry helpers (`distToRectBorder`, `distToEllipse`, `distToPolyline`, `distToRay`, `measureInfo`, `fibPrice`, `snapToOhlc`) are pure and unit-tested; rendering lives in the `drawings` canvas plugin (`drawings-plugin.ts`).
- **Style toolbar**: selecting a drawing shows colour / width / line style / delete (disabled while locked); the choice is stored on the drawing.
- **Text**: click places a label and opens an inline editor (Enter saves, Esc or blank discards); double-click a label to edit.
- **Measure** shows price change, %, bar count and time span, and is never stored. **Zoom** zooms x to the dragged region and sets a manual price range (auto off); `auto` restores.
- **Magnet** now also snaps new drawing anchors to the bar's open/high/low/close.
- **Lock / hide** persist (localStorage) and apply to all symbols; locked drawings cannot be selected, moved or deleted.
- Sidebar extracted into its own component to keep the viewer's stylesheet inside the 4 kB budget (budget unchanged).
- Tests: geometry / store / controller specs, viewer "drawing sidebar" block (9), e2e "TradingView sidebar" flow. Screenshot `docs/screenshots/11.5-drawing-tools.png`.

## Follow-up round (bug + 11.6 + 11.7)

### Indicator lines cut off left/right while panning
- **Cause**: Chart.js only builds/draws the "visible" points of a sorted line dataset, using pixel positions from the previous layout. While panning with the LOD window, the first/last visible points were stale, so overlay and pane indicators ended short of the bars (worse the faster you pan).
- **Fix**: the chart marks every dataset's meta as unsorted before each dataset update (`beforeDatasetUpdate`), so all loaded points are positioned and drawn. The LOD window is already ≤ ~500 points, so this costs nothing measurable (the pan perf test still passes).
- **Test**: e2e "indicator lines run edge to edge while panning" (fails without the fix).

### 11.6 — symbol and volume settings
- The legend header has an eye and a gear (on hover), and there is a **Volume** row with its own eye and gear (no remove). Eye = show/hide that series; gear opens `SymbolSettingsDialogComponent`.
- **Symbol settings**: rising / falling colour, **colour based on previous close** (direction from the previous close instead of the open — candles, hollow, bars, HLC, high-low, columns, and the volume histogram), line/border width, and for line styles (line, markers, step, area) the **source** (close, open, high, low, HL/2, HLC/3, OHLC/4) and line colour. **Volume settings**: colours and previous-close colouring.
- Stored in the chart state (`price`, `volume`; validated on rehydrate by `core/models/symbol-settings.ts`). Direction by previous close rides on each data point (`dir`); the financial plugin's colour options are scriptable and return one uniform colour so the element's own open/close test cannot override it. Bucketed bars carry `upPc` (LOD).
- Tests: model, state, price-series (9), LOD, legend, dialog (5), viewer integration (4).

### 11.7 — the TradingView drawing set
- **Seven groups with flyouts** (`›` next to each group button; the button stands for the last tool you picked): Trend lines (trend, ray, info line, extended, trend angle, horizontal line, horizontal ray, vertical, cross, arrow, parallel channel, disjoint channel, regression trend), Fib & Gann (retracement, trend-based extension, channel, time zone, speed-resistance fan, circles, Gann box, Gann fan, pitchfork), Patterns (XABCD, ABCD, triangle, head & shoulders, three drives, Elliott impulse / correction / triangle), Forecasting & measuring (long / short position with risk-reward, forecast, date range, price range, date and price range), Brushes & shapes (brush, highlighter, rectangle, rotated rectangle, circle, ellipse, triangle, polyline, path, curve), Text & notes (text, note, callout, price label), Icons (arrow up/down, check, cross, star, flag). Measure and zoom stay one click away.
- **One pipeline**: `drawing-tools.ts` (registry: id, label, group, number of anchors) → `drawing-shapes.ts` (pure: anchors → line / poly / rect / ellipse / arrow / curve / text shapes) → the canvas plugin paints the shapes and the controller hit-tests the very same shapes (distance to lines, rays, outlines, filled areas, text boxes). Every old tool moved onto it, so adding a tool is one registry line plus one builder.
- **Placing**: 1 click, 2 = drag, 3+ anchors = drag the first segment (or click) then one click per remaining anchor with a live preview, polyline/path finish with double-click or Enter, Esc abandons. Handles on every anchor; dragging the body moves all anchors; the style toolbar and text editor work for the new tools (note and callout ask for text).
- Regression trend is a least-squares fit of the closes between the anchors with ±2σ bands; position tools show profit/loss zones and risk/reward.
- Not done: Gann square, Fib spiral/arcs, Cypher/three-drives ratio checks, bars-pattern, anchored text/VWAP, table, sticker emoji packs.
- Tests: registry + shapes (18, incl. every tool renders finite geometry), controller (9 new flows), viewer (flyouts, every tool renders selected/hidden), e2e "tool groups". Screenshots `docs/screenshots/11.7-*.png`.

### Also fixed
- Characters typed while the symbol-search dialog was still opening were lost (the first key opens it, the next ones raced its render). They are now appended / forwarded to the box.

## Round 3 — layout, official-list gap analysis (11.8–11.11)

**Note on "missing" items**: measure (the ruler), log and auto already existed but were easy to miss (a tiny ⇔ icon; two text buttons over the x axis labels, and a stale dev-server build shows none of it). They now have obvious homes: 📏 *Measure (ruler)*, and a proper bottom scale bar.

### Deep search: TradingView features vs. this chart
| Area | TradingView | Here |
|---|---|---|
| Left toolbar | fixed full-height column | ✅ column beside the chart, scrolls on short windows, flyouts open beside it |
| Cursors | cross / dot / arrow / demo / eraser | ✅ cross, dot, arrow, eraser (demonstration mode not built) |
| Trend lines | trend, ray, info, extended, angle, h-line, h-ray, v-line, cross, channel, regression, flat top/bottom, disjoint | ✅ all, plus cyclic lines, sine, time cycles |
| Fib & Gann | retracement, extension, channel, time zones, fan, circles, arcs, spiral, wedge, trend-based time, Gann box / fan / square, pitchfork family, pitchfan | ✅ all listed (pitchfork, Schiff, modified Schiff, inside) |
| Patterns | XABCD, cypher, ABCD, triangle, three drives, head & shoulders, Elliott waves | ✅ all (Elliott impulse, correction, triangle, double and triple combo) |
| Forecasting / measuring | long / short position, forecast, bars pattern, ghost feed, projection, anchored VWAP, volume profiles, date / price range, measure | ✅ except ghost feed and anchored (as opposed to fixed-range) volume profile |
| Shapes | brush, highlighter, rectangle, rotated rectangle, path, circle, ellipse, polyline, triangle, arc, curve, double curve | ✅ all |
| Text & notes | text, anchored text, note, price note, pin, table, callout, comment, price label, signpost, flag | ✅ all but anchored text and table |
| Icons / emoji | sticker picker | ✅ 14 icons / emoji (no full picker) |
| Drawing management | undo / redo, clone, lock / hide all, remove drawings / indicators, style toolbar, keyboard shortcuts | ✅ (per-drawing lock/hide, object tree, templates, z-order: not built) |
| Scale controls | %, log, auto, invert, zoom in / out, reset | ✅ (lock-scale to the right of the price, scale-to-time not built) |
| Chart | last price line + label, grid / crosshair / status line settings, context menu, arrow-key / +/- / End navigation, snapshot, fullscreen | ✅ |
| Not built (backlog) | (was: compare, countdown, replay, alerts, layouts, templates, watchlist, data window / object tree, timezone + session, go-to-date — all built in round 4, see below) | ✅ |

### What changed
- **Layout**: the sidebar is a real column (`.chart-body` = sidebar + chart column) from under the chart navbar to the bottom; the scale controls moved out of the plot into a strip under the chart, so they no longer cover the time axis. Verified by e2e at 1400×800 and on a 420 px tall window (no page scrollbar).
- **Scale bar**: − / + zoom about the centre, invert (⇅), percentage (%: axis, crosshair label and last-price label read % change from the first visible bar; drawings stay in price), log, auto.
- **Cursors**: the sidebar's first group. Cross / dot / arrow change the crosshair (`$cursorStyle`); the eraser deletes the drawing under the pointer and stays active. After drawing, the tool falls back to the cursor mode you picked.
- **Tools 11.9**: 34 more, each a registry line + a builder in the shared shape pipeline (bars pattern, volume profile and anchored VWAP use the loaded bars).
- **11.10**: per-symbol undo/redo (100 steps; a drag is one step) with header buttons and Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z; Ctrl+D and a toolbar button clone; Alt+T / H / V / C / F pick tools; the trash has a menu (drawings / indicators / both). Right / middle mouse buttons never draw.
- **11.11**: dashed last-price line with a coloured axis label (clamped to the pane edge when off scale); chart settings (status line OHLC, last price line, vertical / horizontal grid, crosshair) persisted in the chart state; right-click menu (reset view, horizontal line at the price, remove drawings, settings); ← → pan, + − zoom, End jumps to the latest bar.
- **Bug found by the screenshot**: the last-price label briefly showed percentages on the linear scale (Chart.js fills in a default tick callback, so "has a callback" is not "percent mode"); it now uses an explicit flag.
- The viewer's loading skeleton and error card moved into `ChartStatusComponent` to keep its stylesheet inside the 4 kB budget (unchanged).

## Round 4 — everything that was on the backlog (11.12–11.17)

The whole "not built" list from round 3 is now built:

| Backlog item | Where / how |
|---|---|
| Per-drawing lock / hide, z-order | style toolbar (lock, hide, *Order…* menu) and the object tree; a locked drawing can be selected but not moved, deleted or handle-dragged; hidden ones are neither painted nor hit-tested; `DrawingStore.move()` is undoable |
| Anchored text, table, emoji picker | tools `anchoredtext` (fixed spot of the pane, stored as fractions, moves by pixels), `table` (`a|b;c|d` cells, edited inline), `emoji` (48-glyph grid in the Icons flyout; the picked glyph is stamped on click) |
| Ghost feed, anchored volume profile | `ghostfeed` (the bars between two anchors repeated after the second, translucent), `avp` (volume-by-price from the anchor to the latest bar); the fixed-range profile and bars pattern share the same helpers |
| Cursor demonstration mode | fifth cursor: a red laser dot with a fading trail |
| Go to date | 📅 button and Alt+G: date box (clamped into the data), centres the view on the nearest bar keeping the span |
| Lock scale / fit all | 🔒 freezes the price range (auto, axis drags and vertical panning are inert), ⤢ fits every bar |
| Clock, timezone, session, countdown | bottom-left clock (exchange = New York with its UTC offset, UTC or browser local); settings pick the zone, the session (regular 16:00 / extended 20:00 close) and switch on the *countdown to bar close* under the last-price label (daily → next weekday close, weekly → Friday). `charts/market-time.ts`, DST-safe via `Intl` |
| Object tree, data window | ☰ opens the right panel: **Objects** (indicators and this symbol's drawings: select, eye, lock, delete, bring to front), **Data** (the hovered bar's date, OHLC, volume, change and every indicator value) |
| Watchlist | third tab; symbols in localStorage, quotes (last close, % change) fetched lazily only while the tab is open; click switches the chart |
| Alerts | fourth tab, the context menu (*Add alert at price*) — crossing alerts, drawn as dashed bell-labelled lines on the chart. The demo data is static, so they fire **during replay** (toast, pause, marked triggered), not in real time |
| Replay | **⏵ Replay** cuts the history at a start bar (60 bars back); step ⏮ ⏭, play / pause at 1x / 3x / 10x / 30x, position slider, exit. Indicators, drawings and volume follow; the daily file is sliced before weekly aggregation |
| Compare symbols | **＋ Compare** opens symbol search; the compared symbols are lines on the price pane, scaled to start at the price's own value at the first framed bar (so they read as relative performance); legend rows show the change and a remove ✕; up to five, persisted |
| Layouts | **▤** dialog: save the whole chart (state + all symbols' drawings) under a name, load, overwrite, delete; the current layout's name is on the button |
| Indicator templates | in the Indicators dialog: save the chart's indicators (with inputs, styles, visibility) under a name, apply (replaces), delete |

Other changes
- Header buttons for snapshot / fullscreen / reset zoom are icons now (titles + aria-labels kept) so the header fits on one row.
- The loading skeleton / error card, side panel, replay bar and toasts are their own components (viewer stylesheet still under the 4 kB budget).
- Honest limits: session only changes which close the countdown targets (the demo data has no intraday bars); alerts and replay are the only place price "moves" because the files are static; compare uses daily closes aligned by date.
- Tests: about 65 new unit specs (registry/shapes, controller, store, panel, services, dialogs, viewer) and the e2e `platform.spec.ts`. Screenshots: `docs/screenshots/11.14-side-panel.png`, `11.15-replay.png`, `11.9-more-tools.png`.

## Round 5 — drawn icons (11.18)

Every icon in the app is now a **drawing** (SVG line art on a 24×24 grid, like TradingView's toolbar), not an emoji or a symbol character.
- `shared/icons/icons.ts` is the single registry (about 190 icons, composed from small helpers for anchor dots, arrow heads, dashes, stars and the cog so they stay consistent): one per drawing tool (all 100+, so the sidebar and the flyouts show what the tool draws), the cursors, the toolbar (undo / redo, settings, camera, fullscreen, layouts, replay, compare, panel, calendar, fit, lock, invert, percent, zoom ±, play / pause / step), legend and panel controls (eye, eye-off, gear, close, bring to front), the theme toggle and the screener's sort arrows, and the pricing table's included / not included marks.
- `<app-icon name="…" [size]>` renders it (strokes follow the text colour, so hover / pressed / dark mode just work; solid icons such as the stamps are filled).
- **The canvas uses the same path data**: the icon stamps on the chart (arrow, check, star, flag, heart, thumb, fire, rocket, warning, bulb, bell, dollar) and the bell of price alerts are painted with `Path2D` (`drawIcon`), so they no longer depend on the OS emoji font and follow the drawing colour.
- The emoji picker became a **stamp picker** (28 drawn stamps in the Icons flyout); the `emoji` tool is now `stamp`.
- Guards: `icons.spec` (every tool / cursor / toolbar button has an icon, paths are plain path data, no two tools share the same drawing, every stamp exists) and `icons-guard.spec` (no emoji, arrow, dingbat or geometric-shape character anywhere in the app sources) plus an e2e check that no chart button shows a symbol character.

## Round 6 — next steps (11.19)
- **Pane resizing** (the item deferred since 10.4): hover a separator between two panes (the cursor becomes ↕), drag to move weight between the neighbours; the panes keep a minimum size, the total is conserved, the sizes survive chart rebuilds and reloads (localStorage `pane-weights`). Only with the cursor tools, so it never fights a drawing tool. Pure maths in `charts/pane-resize.ts` (`resizeWeights`, `paneBoundaryAt`).
- **Backend URL** is configurable (`<meta name="api-url">`), preparing the last task (9.1, still blocked on a backend that implements the auth endpoints; see its task file).
- The status headers of the phase 0–4 task files said NOT STARTED although the index marks them done; they now point at the index.
- Still not built: volume candles / footprint / TPO (they need intraday or per-bar-width data the demo files don't have) and the real backend (9.1).
