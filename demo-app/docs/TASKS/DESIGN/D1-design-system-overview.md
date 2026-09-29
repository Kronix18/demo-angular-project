# DESIGN TASK GROUP — Visual Identity & Design System

The angular app uses `@angular/material` + TailwindCSS-like tokens. All design tasks must be written first as written spec docs before any CSS is implemented, because the design is a system-level decision with ripple effects everywhere.

---

## D1-01 — Define the Brand Color Palette

### Scope: Four-color base palette + four surface scale steps + two semantic colors (error/brand).

### Deliverable: `src/styles/_design/colors.scss`

```scss
$color-base: #0f172a;       // navy base for dark-mode default
$color-accent: #6366f1;     // primary accent (indigo)
$color-brand: #0ea5e9;      // brand blue
$color-foreground: #f8fafc; // foreground text
$color-surface:
  0   -> #ffffff,
  100 -> #f1f5f9,
  ... // five-step scale.

$color-error: #ef4444;
$color-success: #22c55e;
```

### First step — tests: none (style files have no unit test counterpart). Verify acceptance visually.

---

## D1-02 — Establish Typography Scale + System Font Stack

### Deliverable: `src/styles/_design/typography.scss`

Define two font stacks:
- `font-stack-app` — for UI text.
- `font-stack-display` — for headings and large labels, with a tighter letter-spacing to give the app a "tighter" feel than the system default.

### D1-03 — Define Border Radius + Spacing Scale

Both are one-scale systems so that every component's size is expressible as a CSS variable. Example:

```scss
$radius-xs:   4px;
$radius-sm:   8px;
$radius-md:   12px; // matches pill-shape badges
$radius-lg:   20px;
$radius-full: 9999px;        // for pills.

$space-xs: 4px;
$space-sm: 8px;
$space-md: 16px;
$space-lg: 24px;

```

### D1-04 — Create a Component Design System (Component Library)

Define a set of reusable components in Angular component templates, each with a consistent shape language. Example:

- `button` component uses a variable-height height computed from padding variables. Its border-radius is tied to `$radius-sm`.
- Its primary variant fills the whole button, its secondary variant has a transparent background and a white border with an inset shadow. This gives the "raised" feel.
- Buttons have a hover state that brightens the base color by 8% (add a fixed delta).

### D1-05 — Style Charts & Data Visualization

Charts should use a limited accent palette of exactly three colors: brand, error, success. Axes use light gray `#94a3b8` as stroke. All tooltips and axes label text must be monospaced for alignment with numeric labels.

### D1-06 — Create a Global Theme File (`angular.json`)

Wire the SCSS color/typography variables into Angular's global CSS `styles.scss` by creating a theme object. The theme should be passed to the host component, which applies it via `ng-style`. This is a single file that lives at `src/styles/theme.scss`.

### D1-07 — Build a Design Tokens Registry

A JSON schema file that maps each design token (spacing scale, radius scale, color values) into a JSON object. This file should be machine-parseable so that downstream tooling could theoretically import it and generate CSS classes automatically. Also create an HTML demo page that renders every token visually in a grid layout — this is a manual sanity check for the next engineer.

---

## D1-08 — Set Up the Design System Folder Structure

```
demo-app/src/styles/
├── colors.scss         # palette + error/success/error colors
├── typography.scss     # fonts, headings, body copy scale
├── spacing.scss        # 4, 8, 12, 16, 24, 32, 48px steps
├── radius.scss         # radius tokens
├── theme.scss          # composes all tokens into a single CSS file.
└── _design/            # SCSS partials shared by subcomponents.

demo-app/src/components/ui/
├── button.component.ts
├── button.component.html
├── input.component.ts
├── input.component.html
├── table.component.ts
├── card.component.ts
└── badge.component.ts   // for sectors/charts/etc.
```

---

## D1-09 — Implement the "Tight" Layout System

### Deliverable: `src/styles/layout.scss`

Define a CSS class `.tight` that applies to a `<body>` or any flex parent:

- sets `gap: $space-xs` instead of `$space-md`.
- uses `letter-spacing: -0.015em` for headings.
- sets default padding on cards to `"calc($space-sm * var(--scale, 2))"`.

The class name is `.tight-layout` and it applies the tighter constraints. All design tokens are exported as CSS custom properties, so changing the scale at runtime changes the entire layout without code changes.

---

## D1-10 — Define an Iconography System + SVG Sprite

### Deliverable: `src/assets/icons/library.ts`

A module that exports a collection of inline SVGs with consistent stroke-weighting, stroke-width of 1.5px, and corner rounding rules (either round caps on all edges or sharp corners for "neutral" icons). All icons are exported as named constants so the rest of the app imports them declaratively.

### D1-11 — Write a Design Audit Utility

A small helper function that takes the component tree (e.g. via `@angular/router`'s injector) and validates that every visible surface element has an assigned design token or inherits from one. For example, it runs `style.getComputedStyle(el).color` and asserts that the value matches one of the palette tokens or its derived variant.
