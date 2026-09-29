# Phase 0B — Design Fixes & Separation of Concerns

## Goal
Fix the existing UI design without breaking functionality. Use a strict CSS-first approach so that theme changes are isolated to SCSS and never affect TypeScript logic.

---

## New Tasks (Phase 0B)

| # | Task Number | Path (relative to /TASKS) | Scope |
|---|-------------|---------------------------|-------|
| 1 | `PHASE-0B/01-separation-of-concerns.md` | Architectural guardrail: CSS-only design tokens, no inline styles or JS theme-switch code. |
| 2 | `PHASE-0B/02-register-page-theme-fixes.md` | Fix register page theme (Stripe purple gradients, soft shadows, rounded fields). |
| 3 | `PHASE-0B/03-login-page-theme-fixes.md` | Fix login page theme (same gradient palette, focus-ring states). |
| 4 | `PHASE-0B/04-home-page-theme-fixes.md` | Fix home page layout (tight spacing, monospaced labels for prices). |
| 5 | `PHASE-0B/05-screener-page-theme-fixes.md` | Fix screener page layout (filter chips, result card density). |
| 6 | `PHASE-0B/06-watchlist-card-theme-fixes.md` | Fix watchlist stock cards (metric chips, hover states). |

These are **six** additional markdown files. All are "design-only" tasks — no TypeScript changes required unless the current implementation uses inline styles that must be ported to a SCSS class.
