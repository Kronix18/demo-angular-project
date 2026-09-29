# P0B-05 — Screener Page Theme Fixes (CSS-Only)

## Scope
Only styling changes to `app/features/screener/screener.component`. No change to the filter logic, backend request payloads, or result row data structure.

## Issues Found

1. Filter inputs stack vertically without any spacing between them (no visual separation between groups).
2. Result rows use only a boring border-bottom with no hover state — user has no feedback when iterating by mouse.
3. The "Add to watchlist" checkbox alignment is broken — it floats above the label text and the label doesn't visually connect.
4. The result table header is not sticky, so when scrolling 500+ rows the column headers disappear from view.

## Deliverables to Produce

- `src/components/ui/screener/screener-filter-group/screener-filter-group.component.scss` — group uses flex column layout with 8px spacing between groups, 24px space before each group header, rounded caps on each header.
- Result row uses flex layout and a subtle hover state: when moused over the entire row changes to `var(--color-surface-800)` and the price column gains a blue gradient highlight bar (1px height) extending from left edge to 2/5ths of row width.
- Checkbox alignment uses `align-items: center` on its flex parent; the label text is placed in a `<span class="checkbox-label">` with left margin of 8px and a thin 1px border that extends horizontally between checkbox and price column.
- Sticky header is achieved via CSS-only `position: sticky; top: 0; z-index: 1;` — no JS scroll handlers needed.

## First Step — Write Tests

Test that:
  - The result table headers stay visible while scrolling the body.
  - Row hover increases brightness by exactly 9% (from `224/255` to `238/255`).
  - Hover gradient bar spans exactly 40% of row width (no JS needed — CSS calc).
  - Changing a filter input value produces the same network request as before; only visual appearance of the input field changes.

## CSS-Only Reasoning

No JS is used because:
- Sticky positioning is purely declarative CSS.
- Hover states are triggered by `:hover` pseudo-class — no event binding needed.
- Flex layout spacing uses CSS Grid/flexbox tokens.

The TypeScript logic for filtering (selecting stocks whose P/E ratio <= some number) lives in the backend API endpoint. The Angular frontend merely renders HTML strings and calls `HttpClient.post` with a JSON payload. No JavaScript changes needed.
