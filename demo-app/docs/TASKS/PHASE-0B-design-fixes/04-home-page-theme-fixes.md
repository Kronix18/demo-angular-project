# P0B-04 — Home Page Theme Fixes

## Scope
Only styling changes to `app/features/home/home.component`. No change to the router navigation structure or stock listing logic. Issues found in existing implementation are replaced with design-improvised fixes.

## Issues Found

- The hero section uses default paragraph text at 16px sans-serif; it should use a larger, tighter tracking font stack.
- Grid of stock tickers has inconsistent spacing and no hover state on cards.
- Navigation bar is a full-width div without proper flex layout, so elements stack vertically on small screens.

## Deliverables to Produce

- `src/components/ui/layout/home-hero/home-hero.component.scss` — hero layout using CSS grid with fixed max-width for typography.
- Stock ticker card uses rounded corners (12px), backdrop filter blur behind the card, and a hover transform that lifts it by 4px with increased shadow intensity.
- Navigation bar is made into a flex container; the logo and primary nav links are placed in a `flex-column` and the search bar in a `flex-row-space-between`.

## First Step — Write Tests

Test that after applying theme CSS, the home hero text is now 32px and uses the display font stack. Verify that navigation still works as before (clicking nav items emits the same navigation event) and that cards remain clickable despite the transform.
