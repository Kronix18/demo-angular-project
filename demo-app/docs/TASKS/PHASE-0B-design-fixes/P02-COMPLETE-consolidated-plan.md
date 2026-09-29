# PHASE 0B — DESIGN FIXES: COMPLETE CONSOLIDATED PLAN

## Executive Summary

All existing Angular components (`app/features/*`) are to be themed by CSS-only style modifications. No TypeScript logic changes, no backend changes, no JavaScript DOM mutations. The entire visual redesign is expressed purely in SCSS with CSS custom properties.

## Architecture

```
TASKS/
├── PHASE-0-REVIEW/           # → SDLC review of existing components (already done)
│   ├── 01-register-component-structure.md
│   ├── 02-register-input-labels-validation.md
│   ├── 03-register-button-state-feedback.md
│   ├── 04-auth-login-form-layout.md
│   ├── 05-auth-email-verify-success-flow.md
│   ├── 06-home-hero-section-layout.md
│   ├── 07-stock-chart-component.md
│   └── 08-screener-filter-form-layout.md
│
├── PHASE-0B-design-fixes/    # → Design fixes; all CSS-only. Read this file FIRST.
│   ├── D1-overview.md                       ← START HERE. Read the architecture guide.
│   ├── 01-separation-of-concerns.md         ← The SCSS global tokens. Required reading.
│   ├── 02-register-page-theme-fixes.md
│   ├── 03-login-page-theme-fixes.md
│   ├── 04-home-page-stock-list-theme-fixes.md
│   ├── 05-screener-page-theme-fixes.md
│   └── 06-watchlist-card-layout.md          ← new task defined inline below.
│
├── demo-angular-project/demo-app/           # ← The target Angular project
├── stockscreenerapi/                         # ← Backend. DO NOT TOUCH.
└── schemata.txt                             # ← PostgreSQL schema reference.
```

---

## Task Summary Table

| Phase | Task | File | Scope |
|-------|------|------|-------|
| 0 | **SDLC Review** — audit all 8 components for issues & missing design decisions. | `PHASE-0-REVIEW/*.md` (8 files) | Pure review; no code changes. |
| 0B | **Separation of Concerns** — create SCSS global tokens file. | `01-separation-of-concerns.md` | Pure CSS infrastructure. No other task can run until this is complete. |
| 0B | **Register page** — replace every inline style / JS mutation with CSS custom properties. | `02-register-page-theme-fixes.md` | Pure design fix. |
| 0B | **Login page** — glassmorphism card + animated gradient background. | `03-login-page-theme-fixes.md` | Pure design fix. |
| 0B | **Home page** — hero section, stock ticker grid, hover effects. | `04-home-page-stock-list-theme-fixes.md` | Pure design fix. |
| 0B | **Screener page** — filter layout, sticky headers, result card hovers. | `05-screener-page-theme-fixes.md` | Pure design fix. |
| 0B | **Watchlist page** — metric chip badges, price-change gradient bars. | `06-watchlist-card-layout.md` | Pure design fix (to be generated inline below). |

---

## Execution Order & Parallelism

- **Task 0 (SDLC review)** → read-only. No dependency on any other task.
- **Task 01 (Separation of Concerns)** → produce the global SCSS tokens file. This is the *only* task that can block others: every subsequent task must import from the same `_design-system.scss` file.
- **Tasks 0B-06** → all six design-fix tasks are **purely concurrent**. They operate on different component files and do not read or write shared mutable state. They may run in any order, and none depend on one another being completed first.

---

## Pre-Requisites Before Every Task

Each task must perform the following before writing any code:

1. Run `/graphify . --mode deep --dir graphify-out/` to regenerate the full application knowledge graph.
2. Read `PHASE-0B-design-fixes/D1-overview.md` and confirm that your current design goal is consistent with the style system defined therein.
3. Verify via `read_file` that your target component's template file does not contain the problematic pattern you intend to remove (e.g. inline styles, JS DOM queries).

If any of these checks fails, stop immediately and ask for clarification.

---

## Post-Requisiites After Every Task

1. Write a brief **Summary** section at the bottom of the completed `.md` file that says:

   > "This task produced `src/styles/_design-system.scss` [revised], which was imported into all components' host templates. No functional behavior changed; only visual rendering changed. The following CSS class names were introduced: `[your-list-heres]`."

2. Run `/graphify . --mode deep --dir graphify-out/` again to capture the new design tokens in the graph.
3. Open a manual browser session and navigate to the relevant route, confirm visually that the change is correct, then type "Verified" into your own notes.
4. Compact your context ledger: run `/memory remove <any-old-outdated-entry>` if necessary.

---

## Task 06 — Watchlist Card Layout (New Consolidated Task)

*Location:* `TASKS/PHASE-0B-design-fixes/06-watchlist-card-layout.md`

**Scope (CSS-only):**
- Replace the watchlist list with a flex-row grid of stock cards.
- Each card has a rounded corner (`border-radius: 12px`) and a soft drop-shadow that is defined as `--shadow-card-surface`.
- A "Sector" pill tag uses `border-radius: 9999px` and a background color from the palette variable `--accent-sector-colors`.
- The price-change column renders a left-to-right gradient background: green-to-transparent for positive, red-to-transparent for negative. The exact CSS is:
  
  ```scss
  .price-change-positive {
    background: linear-gradient(90deg, var(--color-success) 0%, transparent 10%);
  }

  .price-change-negative {
    background: linear-gradient(90deg, var(--color-error) 0%, transparent 10%);
  }
  ```

- No TypeScript changes. No new imports. No Angular lifecycle hooks. Only CSS is edited and added.

**Test:** Open `http://localhost:4200/#/watchlist` in DevTools. Verify that clicking on the "Sector" pill does no JavaScript (no console event log warnings). The card must hover-lift by 2px with a transform, not jump abruptly.

---

## Task 07 — Sidebar Drawer Layout (New)

**Scope (CSS-only):**
- Add a side panel to the home layout that uses a CSS drawer class: `layout-sidebar-opened`. When this class is present on `<body>`, the sidebar appears; when removed, it collapses. This is controlled by a CSS custom property on the `body` element: `--sidebar-width: 260px;` vs `--sidebar-width: 0em;`.
- The main content uses a sibling selector: `.layout-sidebar-opened main { margin-left: var(--sidebar-width); width: 100% - var(--sidebar-width); }`.
- No JavaScript is used to slide the drawer in or out. Only class toggling and CSS transitions are used.

**Test:** Open DevTools → Inspect the `<body>` tag. Confirm that when the sidebar is open, the `--sidebar-width` variable equals `260px` rather than a JS-computed pixel value.

---

## Task 08 — Navigation Top Bar (New)

**Scope (CSS-only):**
- The top bar is rendered as a flex-row with `align-items: center`, with a left group that lists links and a right group that shows the user avatar.
- Links are wrapped in a `<a>` tag of class `.nav-link` with a transition on `background-color 0.15s ease-in`. On hover, the link's background becomes `--color-surface-highlight`.
- No JavaScript click handling inside any template literal. If a link must navigate, it uses `routerLink="#/route-name"` and the Angular router handles navigation.

**Test:** Click through each nav link in DevTools and verify that the browser navigates without triggering a JS console log or DOM mutation.

---

# Final Notes

- No code change is made to any TypeScript component or service until **both** design tasks on that component are complete and approved visually.
- If you find an existing task conflicts with another (e.g., Task 07 and Task 08 share the same top bar element), resolve by writing a combined task file that defines one shared CSS block for both layout requirements.
- The backend API is never touched. No route changes on the backend are permitted.
