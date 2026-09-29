# Task 0B-02 — Register / Login Forms (Hero Card + Input Fields, All CSS)

**Read `D1-overview.md` and `01-Separation-of-Concerns.md` first.**

## What this file defines

The hero cards on both the register page (`/register`) and login page (`/login`) use only CSS classes to define their visual appearance. No TypeScript component lifecycle hooks (`ngOnInit`, etc.) ever set DOM properties.

### Rules for every `<input>` field and button

- **Border-radius** comes from a SCSS variable: `--radius-lg` → `8px`.
- **Background color** is a CSS custom property: `var(--color-surface-elevation-1)`.
- **Focus ring** uses `box-shadow` with no inline attributes.
- **Placeholder text** uses the `::placeholder` pseudo-selector defined in SCSS.
- The **submit button** has a class `.btn-primary` whose gradient background is defined purely in CSS.

## How to verify your changes

1. Serve the app locally (`ng serve --port 4200`).
2. Open DevTools and locate the `<form>` element. Right-click → "Inspect".
3. In the right-hand "Computed" pane, confirm that **no** inline `style="color:..."` or `transform=""` attributes exist anywhere in the DOM tree of the cards or buttons.
4. Run Playwright tests (file: `TASKS/PHASE-0B-design-fixes/playwright.ts`) from step 10 onward.

## Sign-off Checklist

The hero forms are considered "CSS-only" once all of these conditions hold true. You can copy-paste each checklist item into your task file as-is and tick the box after verification:

- [ ] The header `<h1>` tag on both `/login` and `/register` uses no inline styles or JS-set `font-family`.
- [ ] The input fields and their focus rings use only CSS pseudo-selectors (`::placeholder`, `:focus-within`).
- [ ] Buttons use `transition: background-color 0.2s ease-in-out;` so hover effects are animated in CSS, not via JavaScript DOM manipulation.
- [ ] No inline style attributes exist anywhere on the form inputs or their wrapper cards.

---

## Task 0B-03 — Login Page (Glassmorphism Card + Gradient)

Same checklist, but with a gradient background behind the form: the `.background-gradient` element in the page head uses `background-image: linear-gradient(...)` purely in SCSS. No JavaScript is used to animate its opacity or position anywhere.

## Task 0B-04 — Home Page (Hero Title + Stock Ticker Grid)

The hero grid layout and its hover-lift effect must come from CSS alone. The `--hover-lift-transform` custom property is set in SCSS to a function or a simple value. Hovering the `.ticker-card` element triggers a class change (a CSS state toggle like "hovered" via a JavaScript-driven class binder) but no direct style mutation occurs:

```css
/* in _hero.scss */
.ticker-card { transition: transform 0.2s ease; }
.hovered > .ticker-card { transform: translateY(-2px); }
```

In the template, you use `(mouseover)="host.class = 'has-hover'"` — that is a class assignment only. The visual result is entirely driven by CSS.

## Task 0B-05 — Screener Page (Sticky Header + Scrollable Results)

The sticky header uses:

```css
.results-header {
  position: sticky; top: 4rem; background-color: var(--color-surface-elevation-2);
}
```

No inline `height` or JavaScript is used anywhere near the `.results-scroll-area`. The table rows themselves are DOM nodes rendered by Angular's template engine, but their styling comes from `_screener.scss` and not any JS style mutation.

## Task 0B-06 — Watchlist Page (Gradient Bars for Price Change)

Positive change bars render a green-to-transparent gradient; negative change bars render a red-to-transparent one. Again: no JS event handler assigns a pixel hex to the `style` attribute of any bar.

## Task 0B-07 — Sidebar Drawer (CSS Class Toggle)

The drawer slides in via a CSS class on its host container. No inline style ever mutates the drawer's transform or position.

## Task 0B-08 — Navigation Bar (Flex Layout + Hover)

The navigation bar uses flexbox. The `.nav-link[data-router-link]` pseudo-selects the currently active link and applies a different background color purely by CSS rule matching. No JavaScript ever changes `element.style.backgroundColor`.
