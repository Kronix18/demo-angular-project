# Task 0B-01 — Separation of Concerns (CSS-only design token infrastructure)

**Read `D1-overview.md` before starting.** Do not introduce any TypeScript changes.

## Scope and Deliverables

| Output | Path | Description |
|--------|------|-------------|
| `_design-tokens.scss` | `demo-app/src/styles/_design-tokens.scss` | A global SCSS file that defines all CSS custom properties (colors, spacing, border-radii, shadows). |
| `styles.css` | `demo-app/public/styles.css` | The compiled stylesheets — entry point for the runtime. |

## Design Rules for Every Style Token

- **No inline CSS anywhere.** No `<span style="color: red;">`.
- **No JavaScript** mutations to `.style.backgroundColor`, `.style.transform`, etc.
- **All visual appearance** must be expressible as a CSS custom property declared in `_design-tokens.scss`.

## Design Decision: Where Each Token Lives

| Concept | SCSS Custom Property | Usage Example |
|---------|---------------------|---------------|
| `--spacing-xs` | `4px` | `.input-field { padding-inline-start: var(--spacing-xs); }` |
| `--color-surface-elevation-1` | `rgb(243,244,246)` | `.card { background-color: var(--color-surface-elevation-1); }` |
| `--radius-md` | `8px` | `.btn-primary { border-radius: var(--radius-md); }` |
| `--accent-primary` | `#6366f1` (indigo) | `.btn-primary { background-color: var(--accent-primary); }` |

## Verification Steps After Completion

1. Build and serve the Angular app.
2. Open **DevTools → Elements** on any page and confirm that **no inline `style=""` attributes** exist on form fields, buttons, or cards.
3. Confirm that `--accent-primary` resolves to a single hex value (`#6366f1`) in the browser's computed style.
4. Run Playwright tests (in a future file in `TASKS/PHASE-0B/visual-tests/playwright.ts`).

## Sign-off Criteria

When verified:
- All colors live in `_design-tokens.scss`.
- No `<span style="">` exists anywhere in the DOM.
- The hero card's background is a CSS variable, not an inline style.

---

## Task 0B-02 — Register / Login Forms (Hero Card + Input Fields)

**What gets added to `_design-tokens.scss` and imported by `styles.css`:**

```scss
.hero-card {
  @use "colors" as c;
  background-color: c.$color-surface-elevation-1; // not an inline style in HTML!
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg) var(--spacing-md);
}

.input-field {
  height: 3rem;
  padding-inline: var(--spacing-md);
}

.btn-primary {
  background-color: var(--accent-primary);
}
```

Then the template for a register page simply does:

```tsx
<div class="hero-card">
  <h1>Welcome to your new account</h1>
  <input class="input-field" type="email" />
  <button class="btn-primary">Create Account</button>
</div>
```

No JavaScript anywhere touches these elements after render.

## Verification Steps

1. Serve the app: `cd demo-app && ng serve`.
2. Open `http://localhost:4200/register` in the browser.
3. Right-click any element with a style and confirm **no inline style**: no `"color:red"` appearing inside the computed DOM tree.
4. Open the Network tab, find `_design-tokens.scss`, and verify it is loaded by the Angular build pipeline as part of `styles.css`.
5. Run `npx playwright test --grep "Task0B02"` (or any Playwright script that asserts no style attributes).
6. Confirm visually: the hero card looks designed, and none of the rules are injected via JS at runtime.

---

## Task 0B-03 — Login Page (Glassmorphism Card + Animated Gradient Background)

**Same pattern:** The `.login-card` is a plain HTML element that simply has classes like `.login-header`, `.login-card glassmorphism`. The gradient behind it is a `div` with class `.gradient-blob` whose background is defined by CSS and does not come from `element.style.background = ...` in any component lifecycle hook.

If the user wants to change the gradient, they edit `_design-tokens.scss`, rebuild, and deploy. No JS ever manipulates an inline style attribute for visual appearance.

## Verification Steps

1. Build and serve.
2. Open DevTools → **Styles** pane on the login card element.
3. Confirm that backdrop filter, border roundness, background gradient are all CSS values read from properties like `--glass-card-border-width` or `--gradient-anim-duration`.
4. No inline styles are applied by JavaScript anywhere on any element.
5. Run Playwright test for Task 0B-03 to ensure no JS event listener mutates style.

---

## Task 0B-04 — Home Page (Hero Title + Stock Ticker Grid)

Same pattern: the hero title is styled via inline CSS classes (like `.hero-title`) that use custom properties (`--font-size-xl`) defined in `_design-tokens.scss`. The stock ticker grid uses a flexbox layout with `gap` and wrapping. Each ticker card has a class `.ticker-card` that defines a hover lift using `transform: translateY(-2px)` when hovering its contents — no event listener in TypeScript sets this property.

## Task 0B-05 — Screener Page (Sticky Header + Scrollable Results)

The screener page uses a sticky header on top of the results table. The table rows render as DOM elements, and their styling is defined by CSS `::nth-child` selectors — not JavaScript array indexing or inline style assignments.

## Task 0B-06 — Watchlist Page (Card Grid + Gradient Price Bars)

Each card's gradient for "positive change" is a class `.positive-change` whose background comes from a CSS variable `--price-positive-gradient` that points to `var(--color-success)` or `var(--color-error)`.

## Task 0B-07 — Sidebar Drawer (Slide-in / Slide-out)

A `.sidebar-drawer` element uses a CSS class `.sidebar-open` which sets the drawer's position as fixed and sets its `left: 0; width: var(--sidebar-width)` — when open, no inline JavaScript ever mutates any property on the sidebar. Only the presence of a CSS class toggles visibility.

## Task 0B-08 — Navigation Bar (Flex Layout + Hover)

Each nav link is an `<a>` element with classes like `.nav-item .active`. Hover transitions are animated via `transition: background-color 0.15s ease` and `transform: translateY(-1px)` in CSS. No JS sets styles on any nav item. The navigation bar's responsive behavior (collapsing to a hamburger menu) uses a `@media (max-width: 640px)` rule and a separate `.nav-collapsed .nav-toggle::before` pseudo-element — all of it is pure CSS.

---

## Final Verification Procedure for the Whole Phase 0B

Once all tasks are completed, run this sequence in your terminal:

```bash
cd /c/Users/kevin/Documents/Programming/demo-angular-project/demo-app

ng serve --host 0.0.0.0 --port 4200
```

Then in a separate browser window (or headless Playwright test):

```bash
npx playwright test --grep "Task"
```

The Playwright script will assert, for the entire app:

- Zero elements have an inline `style` attribute.
- All colors come from CSS custom properties defined in `_design-tokens.scss`.
- All transitions and transforms are expressed in CSS.
- No JavaScript mutates inline styles — confirming visual fidelity is guaranteed.
