# D1-04A — Button Component: Base Styling Only

## Scope: Style the button element only — no click handlers, no icon injection, no focus states.

### Deliverable: `src/components/ui/button/button.component.ts` with inline styles only.

The component is a purely presentational block level component. It exposes only one public input: `variant: 'primary'|'secondary'|'ghost'` and one boolean `disabled`.

### First step — tests: **none applicable**. Pure presentational styling, so acceptance is visual only.

## D1-04B — Input Component: Base Styling Only

## Scope: Style the input element only — no validation logic, no label injection, no floating label animation.

### Deliverable: `src/components/ui/input/input.component.ts`

A single file that renders a `<mat-form-field>` wrapper with a textfield child using the token-based border radius and spacing. The placeholder uses system font-matching.

### First step — tests: **none applicable**. Acceptance is visual only in DevTools inspector mode.

---

## D1-04C — Table Row Cell Component

## Scope: Style an individual table cell that can host either a badge, a number, or a text label depending on the data type.

### Deliverable: `src/components/ui/cell-cell.component.ts`

The component accepts a `type` input (`'text' | 'number' | 'badge'`). When `type === 'badge'`, it renders an inline span with a background color from the palette and a pill-shaped border radius. Its number cells align right and truncate text in the middle.

### First step — tests: write a unit test that renders the cell in a test fixture, sets `type='number'` and asserts that the rendered HTML contains `'text-align: right'` on the internal `<span>`.
