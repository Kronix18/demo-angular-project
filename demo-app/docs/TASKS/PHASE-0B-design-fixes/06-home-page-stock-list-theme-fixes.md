# P0B-06 — Home Page / Stock List Theme Fixes (CSS Only)

## Existing Code Issues Identified

- Hero section text uses paragraph element with 1rem system font at 18px (no display hierarchy).
- The hero background image has a default `background-color: white` that covers content.
- Navigation bar uses plain `<div>` and `<a>` elements without any padding, gap, or spacing.
- The "Recent Tickers" grid is a simple `ngFor` block with no CSS to give rounded cards.
- All stock-card chips (sector, price change) use `<p>` tags — should use `<span>` with chip styling.

## Deliverables to Produce

### 06A — Navigation Bar Component (CSS-only)

**Input HTML:** A raw list of links:
```html
<nav>
  <a routerLink="/">Home</a>
  <a routerLink="/screener">Screener</a>
  <a routerLink="/watchlist">Watchlist</a>
  <a routerLink="/portfolio">Portfolio</a>
  <a href="/auth/login" [routerLinkActive]="['active']">Login</a>
</nav>
```

**CSS Fix (in `src/styles/components/ui/layout/nav-bar.scss`):**
```scss
.nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--color-surface-050);

  a {
    text-decoration: none;
    color: var(--color-text-secondary);
    font-size: 13.5px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 8px;
    transition: background-color .12s ease, color .12s ease;

    &:hover {
      background-color: var(--color-surface-200);
      color: var(--color-primary);
    }

    &[aria-current="page"] {
      background-color: var(--color-primary);
      color: white;
    }
  }
}
```

**Test:** Verify the nav bar uses no inline styles (`style` attribute count = 0) and that clicking any `<a>` still triggers the router navigation event as before (no new `<button>` element or click handler added).

---

### 06B — Hero Component (CSS-only rework)

**Input HTML:** A raw hero div with paragraph text:
```html
<div class="hero">
  <p>Professional Stock Analysis — Screener, Charts & Data</p>
  <a routerLink="/auth/register" class="cta-button">Get Started Free →</a>
</div>
```

**CSS Fix (in `src/styles/components/page/home-hero.scss`):**
```scss
.hero {
  padding: 80px 24px;
  background: radial-gradient(circle at 10% -10%, var(--color-primary) 0%, transparent 50%),
              radial-gradient(circle at 90% 90%, var(--color-primary/40%) 0%, transparent 60%);
  color: white;
  text-align: center;

  font-family: 'Space Grotesk', system-ui, sans-serif;

  p {
    font-size: clamp(48px, 7vw, 72px);
    line-height: .9;
    letter-spacing: -0.03em;
    margin-bottom: 24px;

    background: linear-gradient(120deg, white 0%, white 50%, white 100%);
    background-size: 300% 300%;
    animation: gradient-shift 6s ease-in-out infinite alternate;
    -webkit-background-clip: text;
    color: transparent;

    @keyframes gradient-shift { 0% {background-position: 0% center} 100% {background-position: 150% center}}
  }

  .cta-button {
    display: inline-block;
    background-color: var(--color-primary-200);
    color: white;
    padding: 12px 24px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    text-transform: uppercase;
    letter-spacing: .06em;
    transition: transform .15s ease, box-shadow .3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px var(--color-primary-80);
    }
  }
}
```

**Test:** Open the deployed page in Chrome DevTools, scroll slowly, and confirm the gradient text animates smoothly while the hero paragraph remains centered. Confirm that clicking "Get Started Free" still navigates to `/auth/register` (no JS change needed).

---

### 06C — Stock Card Grid Component (CSS-only)

**Input HTML:**
```html
<div class="recent-tickers" *ngFor="let stock of recentStocks | async"
     (click)="navigateToDetail(stock)">
  <span class="ticker">{{ stock.symbol }}</span>
  <small>{{ stock.name }}</small>
  <div class="price">{{ stock.currentPrice?.toFixed(2) }} · {{ stock.marketCap?.formatted }}</div>
</div>
```

**CSS Fix (in `src/styles/components/page/stock-card.scss`):**
```scss
.recent-tickers {
  margin: 8px;
  padding: 10px 16px;
  background-color: var(--color-surface-950, #2b2d42);
  border-radius: 16px;
  cursor: pointer;
  transition: background-color .2s ease, transform .12s ease;
  position: relative;

  &:hover {
    background-color: var(--color-surface-800);
    transform: translateY(-3px) scale(1.015);
    box-shadow: 0 6px 16px rgba(0,0,0,.4),
                0 2px 4px rgba(99,102,241,.25);
  }

  .ticker {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 700;
    font-size: 16px;
    letter-spacing: -0.02em;
  }

  small {
    color: var(--color-text-secondary);
    display: block;
    margin-top: 2px;
    line-height: 1em;
  }

  .price {
    font-family: 'JetBrains Mono', monospace;
    font-weight: 600;
    color: var(--color-text-secondary);
    margin-top: 1px;
  }
}
```

**Test:** Click through a grid of cards in DevTools. Confirm each card lifts by 3px, background brightens by 7% from 950→800 value, and shadows appear with the exact hex `#6366ef` at 25% alpha. No JavaScript is added to handle the hover — it is entirely CSS.

---

### 06D — Dashboard Layout Component (CSS-only)

**Input HTML:**
```html
<div class="dashboard-layout">
  <aside class="sidebar">...</aside>
  <main style="padding: 1rem;">
    <h2>Welcome</h2>
    <!-- other pages -->
  </main>
</div>
```

**CSS Fix (in `src/styles/components/page/dashboard-layout.scss`):**
```scss
.dashboard-layout {
  display: grid;
  grid-template-columns: auto 1fr auto;
  /* gap automatically becomes the sum of both margins on adjacent elements */
}

.sidebar {
  width: 240px;
  border-right: none;
  padding-left: 32px;
  padding-top: 48px;
  background-color: var(--color-surface-950);
}

.main-content {
  padding: 48px 64px;
}

footer {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary/60);
}
```

**Test:** Confirm the layout is fluid at viewport width 480px (sidebars collapse into a bottom tab bar using `@media (max-width: 600px)`), and confirms no JavaScript code handles the breakpoint switching. CSS alone drives the responsive behavior.

---

# Summary of Phase 0B (CSS-only theme fixes)

| Task | File Path | Result File Created |
|------|-----------|--------------------|
| P0B-01 | Separation-of-concerns guideline | P0B-overview.md |
| P0B-02 | Register page styling | P0B/02-register-page-theme-fixes.md |
| P0B-03 | Login page styling | (skipped — login page is intentionally barebones in current repo) |
| P0B-04 | Home/hero grid component | `tasks/PHASE-0B-design-fixes/04-home-page-theme-fixes.md` |
| P0B-05 | Screener/filter layout | `tasks/PHASE-0B-design-fixes/05-screener-page-theme-fixes.md` |
| P0B-06 | Dashboard grid sidebar | (covered inline above, to be extracted in step 6) |

Total: **6 design fix tasks**, all with strict CSS-only scope. Each has a corresponding HTML snippet and a CSS file path that must be generated without any TypeScript logic changes.

**Next phase:** Once all of Phase 0B is implemented and verified, we move to Phase 1 (core functionality refactoring), but only *after* every single CSS class and selector has been confirmed as non-breaking. No TypeScript change touches a component property that is styled by a theme file — the two remain entirely separate modules.
