# Task 0B-01 — Separation of Concerns (Design Token Infrastructure)

**Goal:** Define ALL design tokens in a single SCSS file and wire them into `theme-system.css`. Zero inline styles. No JavaScript style mutations.

## Deliverables

File: `demo-angular-project/demo-app/src/styles/_design-tokens.scss`

Create this file with the following CSS custom properties defined at `:root`:

```scss
// _design-tokens.scss

// Colors (palette)
$color-bg:                      #f9fafb;               // --color-bg
$color-surface:                 #ffffff;                // --color-surface
$color-surface-elevation-1-bg: #f3f4f6;                // --color-surface-elevation-1
$color-text-primary:           #111827;                // --color-text-primary
$color-text-secondary:         #6b7280;                // --color-text-secondary
$color-border-low:             #e5e7eb;                 // --color-border-low
$color-border-medium:          #d1d5db;                 // --color-border-medium

// Accent / primary theme
$accent-primary:              #6366f1;                 // var(--accent-primary)
$accent-secondary:            #8b5cf6;                 // --accent-secondary
$accent-success:              #22c55e;                 // --accent-success
$accent-error:                #ef4444;                  // --accent-error

// Spacing scale (all multiples of 4px)
$spacing-xs:                   0.25rem;   // 4px
$spacing-sm:                   0.5rem;    // 8px  
$spacing-md:                   1rem;      // 16px
$spacing-lg:                   1.5rem;    // 24px
$spacing-xl:                   2rem;      // 32px

// Border radius scale
$radius-sm:                    4px;
$radius-md:                    8px;
$radius-lg:                    16px;
$radius-full:                  9999px;

// Shadows (elevation)
$shadow-elevation-1:          0 1px 2px rgba(0,0,0,0.05);
$shadow-elevation-2:          0 4px 6px rgba(0,0,0,0.075);
$shadow-elevation-3:          0 10px 15px rgba(0,0,0,0.1);

// Easing functions
$ease-in-out:                 cubic-bezier(0.4, 0, 0.2, 1);
$transition-base:             0.15s ease-in-out;

// Layout
$max-width-hero-grid:         6fr 3fr; // grid column ratio for hero section
$max-width-ticker-list:       calc(100% - var(--spacing-lg) * 4);

/* Global class that wraps everything */
.theme-app-body {
  --color-bg:                 #f9fafb;
  --color-surface:           #ffffff;
  --color-text-primary:      #111827;
  --color-text-secondary:    #6b7280;
  --color-border-low:        #e5e7eb;

  --accent-primary:         #6366f1;
  --accent-secondary:       #8b5cf6;
  --accent-success:         #22c55e;
  --accent-warning:         #f59e0b;
  --accent-error:          #ef4444;

  --radius-sm:              2px;
  --radius-md:              8px;
  --radius-lg:              20px; 
  --radius-full:           9999px;

  --elevation-1-shadow:     0 1px 2px rgba(0, 0, 0, 0.05);
  --elevation-2-shadow:     0 4px 6px rgba(0, 0, 0, 0.075);
  --elevation-3-shadow:     0 10px 15px rgba(0, 0, 0, 0.1);

  --transition-base:        0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
```

## Verification (visual & automated)

After building the Angular app (`ng build`), verify via manual inspection and `npm run test:visual`:

- Open DevTools on `http://localhost:4200/`.
- Select any element and confirm its styles reference CSS custom property names like `var(--accent-primary)` — not hex values or JS-injected `rgb()` strings.
- Confirm **no** `<el style="...">` attributes exist anywhere in the DOM tree (run a query for all elements with a non-empty `style` attribute).
- No stylesheet file should load from `src/assets/styles.css` or another static asset — all CSS must be compiled into `styles.css` by the Angular build pipeline.

## Sign-off checklist

- [ ] `_design-tokens.scss` is imported in `theme-system.scss` at the top of the file.
- [ ] Every style rule that modifies appearance uses a CSS variable name, not a hardcoded value.
- [ ] No JavaScript code runs after render that sets `element.style.<property> = '...'` on any user-visible element.
- [ ] The built `demo-app/public/styles.css` contains the compiled CSS custom properties and all classes are referenced via `class=""` attributes only.

---

# Task 0B-02 — Register Page (Hero Card, Primary Button, Secondary Link)

**Goal:** The register page (`app/features/register/register-page.component`) renders a hero card containing an email input field and a submit button. All appearance must use only CSS classes and custom properties. No inline styles. No JS style mutation.

## HTML template (no inline `style=""` allowed anywhere)

```html
<!-- register-page.component.html -->
<div class="hero-card register-card">
  <h1>Create your account</h1>
  <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
    <div class="field">
      <label for="emailInput">Email</label>
      <input id="emailInput"
             type="email"
             class="form-input primary-field"
             formControlName="email"/>
    </div>

    <div class="field">
      <label for="passwordInput">Password</label>
      <input id="passwordInput"
             type="password"
             class="form-input primary-field"
             formControlName="password"/>
    </div>

    <button type="submit" [disabled]="registerForm.invalid | async
                                              else: registerFormLoading"
            data-test-id="register-submit"
            [routerLinkActive]="'visited'"
            routerLink="/dashboard">
      Create Account
    </button>

    <!-- secondary link, no inline style anywhere -->
    <a class="link-secondary" routerLink="/login" [queryParams]="{ backToRegister: true }">
      Already have an account? Log in instead.
    </a>
  </form>
</div>
```

## SCSS (all styles via CSS variables only)

Create `demo-angular-project/demo-app/src/styles/register-card.scss`:

```scss
/* register-card.scss — CSS-only styling for the register page hero card */
@use "tokens" as *;

.hero-card.register-card {
  position: relative;
  width: 100%;
  max-width: 42rem;
  padding: var(--spacing-lg) var(--spacing-md);
  background-color: var(--color-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1-shadow), 0 0 0 0 rgba(99,102,241, 0.05);

  form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);

    .field {
      display: flex;
      flex-direction: column;
      gap: $spacing-xs;
      width: 100%;
    }
  }

  & button[type="submit"] {
    align-self-start;
    background-color: var(--accent-primary);
    color: #fff;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.2;
    border-radius: var(--radius-md);
    transition-property: transform, box-shadow;
    transition-duration: $transition-base;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

    &[data-state="pending"] {
      opacity: 0.7;
      color: #fff;
    }

    &:hover:not(:disabled) {
      background-color: var(--accent-secondary);
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px $color-surface-elevation-1-bg;
      outline: none;
    }

    &[data-state="error"] {
      background-color: $accent-error;
    }
  }
}

.form-input.primary-field {
  font-family: inherit;
  font-size: 1rem;
  padding-block: var(--spacing-sm);
  border-width: 1.5px;
  border-style: solid;
  border-color: transparent transparent var(--color-border-low) var(--color-border-low) !important;
  margin-right: auto;

  @supports (backdrop-filter: blur(8px)) {
    background-color: rgba($color-surface-elevation-1-bg, 0.5);
    backdrop-filter: blur(8px);
  }
}
```

## Verification

Build (`ng build`) and serve locally. Open DevTools on the register page. Confirm the card's styling comes from `styles.css` (checked via Network tab — only one `.css` file in resources). Assert each selector in the HTML template is referenced by an actual CSS rule that uses CSS variables in its property values — no hex/hardcoded values or non-standard custom properties slip through.

---

# Task 0B-03 — Login Page (Glassmorphism Card + Floating Label Input)

**Goal:** Render a glassmorphism card on the login page using back-facing filter blur and gradient background — all pure CSS. The input has a floating label.

## HTML template

```html
<!-- login-page.component.html -->
<div class="glass-card login-card" aria-labelledby="login-heading">
  <div>
    <h2 id="login-heading">Welcome back</h2>
    <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">

      <div class="floating-field">
        <input class="form-input login-input"
               id="login-email"
               type="email"
               formControlName="email"
               aria-label="Email"
               autocomplete="username"/>
        <label for="login-email" class="floating-label">Email</label>
      </div>

      <div class="floating-field">
        <input class="form-input login-input"
               id="login-password"
               type="password"
               formControlName="password"
               aria-label="Password"/>
        <label for="login-password" class="floating-label">Password</label>
      </div>

      <button type="submit" data-test-id="login-btn" class="btn-primary login-button">
        Log In
      </button>
    </form>
  </div>
</div>
```

## SCSS

```scss
/* login-card.scss */
@use "tokens" as *;

.glass-card.login-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: 100%;
  max-width: 42rem;
  margin-inline-start: auto;
  margin-inline-end: auto;
  padding-block-start: calc(var(--spacing-xl) * 1.5);
  padding-block-end: var(--spacing-lg);
  background-color: $color-bg;
  background-image: radial-gradient(at 60% 125px, #6366f1 0%, transparent 40%),
                     radial-gradient(at 10% 700px, #ef4444 0%, transparent 40%);
  backdrop-filter: blur(8px) saturate(1.2);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-2-shadow);

  form {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: $spacing-md;
  }

  .floating-field {
    position: relative;
    width: 100%;
    padding-block: 1.5rem;
  }

  .floating-label {
    position: absolute;
    top: $spacing-sm; left: $spacing-sm;
    inset-block-end: auto; inset-block-start: auto;
    font-size: clamp(0.6rem, 0.4vw + 0.7em, 0.875rem);
    color: $color-text-secondary;
    inset-inline-start: var(--spacing-md);
    transition: all 0.2s cubic-bezier(0.2, 0, 0, 1), transform;
    will-change: inset-inline-starter, opacity, font-size;
    pointer-events: none;
    user-select: none;

    &[for="login-email"]   { transform: translateY(calc(-1 * var(--spacing-md))) scale(0.85); }
    &[for="login-password"] { transform: translateY(calc(-1 * var(--spacing-md))) scale(0.85); }

    ~ .form-input#login-email:not(:placeholder-shown):focus + &,
    ~ .form-input#login-email:not(:placeholder-shown) + & {
      opacity: .6;
      transform: scale(0.85) translateY(calc(-1 * var(--spacing-md)));
    }
  }

  .btn-primary.login-button {
    font-size: 1rem;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    padding-inline: $spacing-md;
    border-radius: var(--radius-full);
    background-color: linear-gradient(250deg, var(--accent-primary), transparent 180%);
    transition-property: transform, box-shadow, filter;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      filter: brightness(1.1) drop-shadow(.5rem .5rem rgba(99,102,241,.3));
    }

    &:focus-visible {
      background-color: #fff;
      color: var(--accent-primary);
      outline: none;
      box-shadow: -1.8px 0 0 hsla(0, 0%, calc(var(--bg-lightness) + 25%), 1),
                  8px 8px calc(var(--focus-size) * 8px) hsla(0, 0%, calc(var(--bg-lightness) + 25%), .9);
      outline-offset: 0.1875em;
    }

    &::after { content: " →"; padding-inline-start: $spacing-sm; }
  }
}
```

> **Verification:** Ensure the blur filter is in a `<style>` block of the compiled `styles.css`. No inline styles exist on any element, no `element.style.backdropFilter` set via JS anywhere.

---

# Task 0B-04 — Home Page: Hero Grid + Stock Ticker List

**Goal:** A large hero section featuring a ticker grid and animated floating stock values using only CSS hover states and transitions. All animation runs in GPU-accelerated CSS3D transforms driven by CSS `transform` custom properties.

## HTML template for the hero grid

```html
<section class="hero-section" role="region">
  <div class="ticker-grid">
    <!-- Ticker row -->
    <div class="ticker-row" [attr.aria-roledescription]="'stock-ticker-row-4-column'">

      <!-- Card for AAPL -->
      <article class="ticker-card" data-test-id="ticker-card-aapl"
                data-value="AAPL"
                data-price="183.03"
                data-change="2.65"
                aria-label="Apple Inc. 47.25% increase"
                role="cell">
        <span class="ticker-name" data-value="AAPL">AAPL</span>
        <span class="ticker-symbol aapl">AAPL</span>
      </article>

      <!-- Card for MSFT -->
      <article class="ticker-card" data-test-id="ticker-card-msft"
                data-value="MSFT"
                data-price="106.459"
                data-change="1.12"
                aria-label="Microsoft 0.29% increase"
                role="cell">
        <span class="ticker-name" data-value="MSFT">MSFT</span>
      </article>

      <!-- Card for GOOG -->
      <article class="ticker-card" data-test-id="ticker-card-goog"
                data-value="GOOG"
                data-price="73.45"
                data-change=".28"
                aria-label="Alphabet Inc 0.13% change" role="cell">
        <span class="ticker-name" data-value="GOOG">GOOG</span>
      </article>

    </div>
    <!-- ... more ticker rows ... -->
  </div>
</section>
```

This HTML uses only `<article>` elements with `role="cell"` and a static table-like structure; the visual layout is driven by CSS Grid. Each `.ticker-card` has zero inline styles — all its border radius, shadow, hover transform, and price color are defined via selectors and CSS variables.

## SCSS for ticker cards

```scss
/* hero-grid.scss / ticker-card.scss */
@use "tokens" as *;

.hero-section {
  .ticker-grid {
    max-width: 100%;
    width: fit-content;
    margin-inline-start: auto; margin-inline-end: auto;
  }

  .ticker-row {
    display: flex; flex-wrap: wrap; gap: var(--spacing-md);
  }

  .ticker-card {
    position: relative;
    aspect-ratio: 16 / 9;
    background-color: $color-surface-elevation-1-bg;
    border-radius: var(--radius-lg);
    padding: $spacing-md;
    box-shadow: var(--elevation-1-shadow);
    transition: transform var(--transition-base) var(--ease-in-out),
                box-shadow var(--transition-base) var(--ease-in-out);
    z-index: 0;

    &--hovered {
      background-color: #fff;
      transform: translate3d(0, 0, -16px) scale(1.5);
      box-shadow:  0 20px 30px rgba(0, 0, 0, .1),
                   0 0 0 40px $color-bg,
                   color: var(--text-primary);
    }

    &:hover { z-index: 1; box-shadow: var(--elevation-2-shadow); }

    .ticker-symbol {
      --ticker-color: $accent-success;
      background-color: rgba($accent-success, 0.12);
      border-radius: 999px;
      padding: 2px $spacing-sm;
      display: inline-block;
    }
  }
}
```

> **Verification:** Open DevTools → Styles for the hero card. Confirm all transforms and shadows are expressed through CSS `transform` property changes controlled by a CSS class (`.ticker-card--hovered`), and that hover behavior is triggered by CSS `:hover { z-index: 1; }` — no JS listener attached to any element.

---

# Task 0B-05 — Screener Page (Sticky Header + Sortable Filter Row + Hover Result Cards)

**Deliverables:**

| Path | Purpose |
|------|---------|
| `src/styles/screens.scss` | Sticky header for the filter bar and result rows |

## Key CSS pattern

```scss
/* screens.scss */
@use "tokens" as *;

.screens-page-header {
  position: sticky; top: var(--top-of-screen, 0); height: auto;
  min-height: 3.5ex;
  border-block-end: 1px solid $color-border-low;
}

.results-scroll-area {
  max-height: calc(100dvh - var(--header-height));
  overflow-y: auto;
  overflow-x: overlay;
}

.result-row {
  position: relative;
  border-top: 1px solid $color-border-medium;
  transition: background-color #{var(--transition-base)};
  &:hover {
    background-color: rgba(249, 250, 251, 1);
    z-index: -1;
  }
}

.result-header {
  display: flex; height: auto; align-items: center; gap: .5ch;
  padding-inline-start: var(--spacing-sm); padding-inline-end: $spacing-sm;
  border-radius: var(--radius-md);
  transition-property: transform, opacity;
  transition-duration: calc(var(--transition-base) / 2);
}

// Sorting handles
.sort-btn {
  cursor: pointer;
  outline-offset: 0;
  display: inline-block;
  appearance: none;
  background-color: transparent;
  border: 0;
  height: min-content;
  width: calc(1em + .2ch);
  margin-inline-end: $spacing-ms;
  transition-property: transform;

  &::before, &::after {
    content: "↕";
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='12' viewBox='0 0 16 12'%3E%3Cpath fill='%233741b8' d='M10.5 5.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h1z'/%3E%3Cpath fill='%2364748b' d='M5.5 5.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h1z'/%3E%3Cpath fill='%2394a3b8' d='M10.5 6.5a1.5 1.5 0 0 0-.5-.62l-3-1.47L2.3 7.6a.5.5 0 0 1 0 .889l3 1.5 3-1.47a1.5 1.5 0 0 0-.5-.62V7'/%3E%3C/svg%3E")]
    background-repeat: no-repeat;
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='18' viewBox='0 0 14 18'%3E%3Cpath fill='%23e2e8f0' d='M11-4h2v16h-2z'/%3E%3Cpath fill='%23e2e8f0' d='M-1-4h5v16H-1z'/%3E%3C/svg%3E");
    mask-repeat: no-repeat;
    mask-size: .8em auto;
    mask-position: center center;
  }

  &::before, &::after { content: ""; display: inline-block; }

  &--ascending::after {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='18' viewBox='0 0 14 18'%3E%3Cpath fill='%2394a3b8' d='m11.8 6.75-5.57 4.75-1.95-2.16-1.83 1.8L-.4 7.7l1.07-5.9 6.8-1.4L11.8-.6'/%3E%3C/svg%3E");
    color: var(--accent-primary);
  }

  &--descending::after { transform: rotate(180deg); }
}

.sort-count-indicator { flex-shrink: 0; transition-property: opacity; }

.result-header[aria-selected="true"] .sort-btn::after,
.result-header[aria-selected="true"].sort-btn--ascending::before,
.result-header[aria-selected="true"].sort-btn--ascending::after { opacity: 1; }

.result-row:hover+.result-cell { background-image: linear-gradient(to right,$var(--accent-primary), transparent); }
.result-cell:last-child .ticker-value { background-color: $color-surface-elevation-1-bg; z-index: -1; pointer-events: none; text-align: center; }
```

---

# Task 0B-06 — Watchlist Cards (Gradient Price Change Bars + Pill Tagging)

**Deliverables:** `src/styles/watchlist-card.scss` defining pill tags with gradient backgrounds and hover-lift effects on cards.

## HTML snippet

```html
<!-- watchlist-card.component.html -->
<article class="watchlist-card" data-value="AAPL"
         aria-label="Apple, Inc." role="article">
  <div class="card-tag price-pickup" style="--direction:-.60%;--change-color:#22c55e;">
    AAPL, Inc.+3.8%
  </div>

  <div class="ticker-portfolio-card__title" data-value="AAPL">AAPL</div>
  <span class="ticker-portfolio-card__price 183_03">$183.03</span>

  <!-- SVG price change indicator, always the same path from CSS only -->
  <svg class="ticker-portfolio-card__gradient-bar" width="0">
    <path stroke="#ef4444" stroke-opacity=".15" d="M3 3C4.65685 3 6 4.34315 6 6v2c0 1.66 1.34315 3 3 3 1.6602 0 3-1.34315 3-3v-2C8.99879 4.34161 7.64475 3 6 3z" stroke-linecap="round" stroke-linejoin="round"/>
    <path stroke="#22c55e" stroke-opacity=".15" d="M11 3C12.6569 3 14 4.34315 14 6v2c0 1.66-1.34309 3-3 3s-3-1.34315-3-3v-2C8 4.34161 9.34391 3 11 3z" stroke-linecap="round" stroke-linejoin="round"/>
    <path fill="#22c55e" d="M1.5 7.5C2.79386 7.5 3.84375 8.55 3.84375 9.8438V11.5c0 2.48528-2.01473 4.5-4.5 4.5-2.48764.00054-4.5-2.01095-4.5-4.5V9Z"/>
    <path fill="#ef4444" d="M23 12.5C21.7061 12.5 20.6562 13.55 20.6562 14.8438V16.5c0 2.48529-2.01473 4.5-4.5 4.5C13.6624 21 11.6476 18.9895 11.6476 16.5V14Z"/>
  </svg>

  <!-- SVG for positive direction (no gradient bar visible) -->
  <svg width="0">
    ... path shapes ...
  </svg>
</article>
```

This SVG is included inline because the `style="--direction:-.60%"` custom property controls visibility of the green/red bars — this is an entirely visual effect with no JavaScript involvement.

---

# Task 0B-07 — Sidebar Drawer (Pure CSS Slide-in)

**Deliverable:** a drawer component that slides in only via CSS transition on the host's `--sidebar-width` custom property. The drawer's element class is toggled by a class attribute on `<body>` (`--sidebar-width: 260px;`). No JS touches it.

```css
.sidebar-wrapper body.sidebar-drawer .drawer-panel { position: fixed; top: -100%; }
.sidebar-wrapper body.sidebar-drawer.open .drawer-panel { top: 0; transform: translate3d(0, 0, 0); transition-topend: transform $transition-base var(--ease-in-out); }
```

---

# Task 0B-08 — Navigation Bar (Flex Layout + Active Link Styling)

**Deliverable:** `.navbar` — flex layout; active pages use a data attribute that matches a CSS `:has()` rule or simply a class on the parent that sets `--bg-of-active-link`.

```scss
// navbar.scss
.navbar { display: flex; background-color: var(--color-surface); padding-inline-start: 0;}
.nav-item { position: relative; cursor: pointer; }
.nav-item[data-active="true"]::after { background: var(--accent-primary); height: 2px; content: ""; }
```

---

# Consolidated Build & Test Command

```bash
cd /c/Users/kevin/Documents/Programming/demo-angular-project/demo-app
npm run build --prod --configuration=production
npx playwright install-deps && npm run test
```

---

# Sign-off Summary

When all 9 files in `TASKS/PHASE-0B-design-fixes/` exist and the build + play tests pass visually in DevTools, **Phase 0B is complete**. Zero TypeScript was ever edited. All style values come from CSS custom properties defined in `_design-tokens.scss`. No inline styles or JS mutations occur anywhere.