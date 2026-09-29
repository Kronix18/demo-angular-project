# D1-05A — Card Component: Layout and Typography Only

## Scope: Style a card layout that hosts charts or detailed data rows. The card must support both inline (inline-flex) and stacked layouts.

### Deliverable: `src/components/ui/card/card.component.ts` (single component, no click handlers, no animations)

The card renders:
- A header row with a left-aligned label and a right-aligned date/time stamp.
- A middle section that is either a chart host (canvas element) or a row of metric chips (horizontal flex).
- A footer row with a small caption.

The card uses the tight layout scale: margins are `$space-sm` on left/right, `$space-md` on top/bottom. The header and label inherit the display font, the caption uses a monospaced font for precise alignment with numbers below.

### First step — tests: **none applicable** (visual only, acceptance by inspection).

---

# D1-05B — Metric Chips Component

## Scope: A small inline row of metric pills rendered inside a card's middle section. Each chip displays a label + number pair and must respect negative-red/positive-green coloring.

### Deliverable: `src/components/ui/chip/chip.component.ts`

The component is given an input `textLabel` and a numeric `value`. It computes the background color of its border-ring based on the sign of the value (green for positive, red for negative, neutral gray for zero/blank).

### First step — tests: write a unit test that verifies the CSS rule for `color-positive` sets the `--chip-bg-color` variable to a computed hex string derived from `$color-success`. Confirm via `getComputedStyle` that the rendered chip has that value.

---

# D1-06 — Chart Title and Axis Label Components

## Scope: Two presentational components for chart axes — one for the horizontal axis and one for the vertical axis with tick labels.

### Deliverable A: `src/components/ui/chart-label/axis-label.component.ts`

This component renders a single axis label, supports a `right-aligned` attribute that shifts the label to the far right edge of its container, and supports a `mono-font` flag that overrides the default sans-serif font with a monospaced font-family.

### Deliverable B: `src/components/ui/chart-label/title.component.ts`

This component renders a chart's title above the canvas, supports an optional subtitle line below it. All headings use the tight display font stack.

---

# D1-07 — Layout Grid for Chart Dashboard

## Scope: Create a CSS grid layout that arranges multiple charts in a single view. The grid must support responsive columns (auto-fit) and allow individual children to grow across rows.

### Deliverable: `src/styles/layout-grid.scss`

The grid is laid out using CSS Grid with `grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))` and uses a named gap token `--gap-sm`. Each chart card takes up exactly one column and one row. The top-right corner has a small overflow button that toggles a drawer.

### First step — tests: **none applicable** (visual only). Acceptance is verified by inspecting the rendered HTML in DevTools with multiple charts loaded.

---

# D1-08 — Sidebar Navigation Drawer Component

## Scope: A side-drawer navigation panel that slides from the right edge. It exposes buttons to navigate between "stock detail" and "screener" views, and exposes an optional toggle button for collapsibility.

### Deliverable: `src/components/ui/drawer/sidebar.component.ts`

The drawer uses Angular Material's `mat-drawer-side` but applies custom styling: the drawer header is a pill-shaped badge using `$radius-full` border radius; icons are monochrome SVG paths that turn to accent color on hover; the drawer itself has no background when collapsed. When expanded, it has a dark background (`$color-surface-900`) with 8px top/bottom margins.

### First step — tests: use `ngDevMode` and assert that the drawer's DOM contains exactly one `mat-drawer-container`. The test also asserts that the drawer element has `display: none` when closed and `display: flex` when open.

---

# D1-09 — Toast Notification Component

## Scope: A toast component that appears at the bottom-right corner of the app. It uses a single fixed CSS class to position itself outside the main content area and supports a simple fade-in/out animation using a CSS-only transition.

### Deliverable: `src/components/ui/toast/snackbar.component.ts`

The component renders a flex-row with an icon + message + optional close button. The close button is a small chevron that uses the neutral gray palette. Clicking it triggers an Angular-triggered animation (`@angular/animations/fade` + `trigger("fade", ...)`). The toast disappears after 3s automatically if not dismissed by the user.

### First step — tests: write a unit test that verifies the close button's HTML element exists, that clicking it removes the toast from the DOM, and that the component emits a closed event. Use Angular Testing Library to simulate click events.
