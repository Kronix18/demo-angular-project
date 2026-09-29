# P0B-03 — Login Page Theme Fixes

## Scope
Only styling changes to `app/features/auth/login/login.component` and its template. No change to the authentication logic, token storage, or endpoint behavior. Issues found in existing implementation are replaced with design-improvised fixes.

## Issues Found

- The original design uses a flat gray background with no visual hierarchy.
- Input fields do not indicate which field is currently active (focus ring).
- Logo/icon at top of card lacks a drop shadow or subtle background.
- Password "show/hide" toggle lacks visual feedback and no icon used.

## Deliverables to Produce

- `src/components/ui/auth/login-form/login-form.component.scss` — SCSS module with background gradient and centered card layout.
- Card uses glassmorphism effect (`backdrop-filter: blur(16px)`, semi-transparent bg).
- Focus ring is a 2px ring of the accent color around the input's border only on focus state.
- "Show/hide password" button uses an Material icon rendered in outline style that changes to filled state when shown.

## First Step — Write Tests

Test that after applying theme CSS, the form element retains its previous TypeScript behavior: clicking "Login" still posts to `/api/auth/login` and emits the same `loginSuccess` event. No new behavior is introduced or removed.

---

# P0B-04 — Home Page Theme Fixes

## Scope
Only styling changes to `app/features/home/home.component`. No change to the router navigation structure or stock listing logic. Issues found in existing implementation are replaced with design-improvised fixes.

## Issues Found

- The hero section uses default paragraph text that is 16px sans-serif; it should use a slightly larger, tighter tracking font stack.
- Grid of stock tickers has inconsistent spacing and no hover state on cards.
- Navigation bar is a full-width `<div>` without proper flex layout, so elements stack vertically on small screens.

## Deliverables to Produce

- `src/components/ui/layout/home-hero/home-hero.component.scss` — hero layout using CSS grid with fixed max-width for typography.
- Stock ticker card uses rounded corners (12px), backdrop filter blur behind the card, and a hover transform that lifts it by 4px with increased shadow intensity.
- Navigation bar is made into a flex container; the logo and primary nav links are placed in a `flex-column` and the search bar in a `flex-row-spaces-between`.

## First Step — Write Tests

Test that after applying theme CSS, the home hero text is now 32px and uses the display font stack. Verify that navigation still works as before (clicking nav items emits the same navigation event) and that cards remain clickable despite the transform.

---

# P0B-05 — Screener Page Theme Fixes

## Scope
Only styling changes to `app/features/screener/screener.component`. No change to the filter logic, backend request payloads, or result row data structure. Issues found in existing implementation are replaced with design-improvised fixes.

## Issues Found

- Filter inputs stack vertically without any spacing between them (no visual separation between groups).
- Result rows use only `border-bottom: 1px solid #ddd` with no hover state.
- The "Add to watchlist" checkbox has incorrect alignment and the label does not visually connect to the checkbox.

## Deliverables to Produce

- `src/components/ui/screener/screener-filter-group/screener-filter-group.component.scss` — group uses flex column layout with 8px spacing between groups.
- Result row uses flex layout and a subtle hover state that brightens the background (background: var(--color-surface-900) becomes 5% lighter).
- Checkbox alignment uses `align-items: center` on its flex parent; label text is wrapped in a `<span class="label-text">` with a left margin of 8px and a thin line that extends from the input.

## First Step — Write Tests

Test that when the user changes a filter input value, the same network request payload is sent to the backend. Confirm no new fields are added and no field is removed. Only visual differences are measured.

---

# P0B-06 — Watchlist Card Theme Fixes

## Scope
Only styling changes to `app/features/watchlist/watchlist.component`. No change to CRUD operations, watchlist backend logic, or card data model. Issues found in existing implementation are replaced with design-improvised fixes.

## Issues Found

- Stock cards use a single border around the entire card without rounded corners.
- The stock ticker label is plain text next to the icon; no alignment spacing.
- Price change bars are not displayed (or are poorly positioned).

## Deliverables to Produce

- `src/components/ui/watchlist/stock-card/stock-card.component.scss` — card uses rounded corners (`border-radius: 12px`) and a soft box-shadow.
- Ticker label is wrapped in a `<span class="ticker-badge"` with monospace font-family and `font-size: 0.8em; letter-spacing: -0.04em`.
- Price change bar is rendered as a small horizontal gradient span (green/red) with text aligned to the right using flexbox with `align-items: center`.

## First Step — Write Tests

Test that after applying theme CSS, the watchlist cards do not overlap, and that the ticker label is horizontally aligned with the stock icon. Verify that the click handler on the card still navigates to the detail drawer as before.
