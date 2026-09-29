# Phase 0 — SDLC Review: Existing Components

## Goal
Go through every existing component in `demo-angular-project/demo-app/src/app/features` and produce an improvement spec. No code is written yet. This is a pure review pass using the **SDLC Review** skill: read → orient → compare against design system references (popular-web-designs) → produce a corrected spec with clear acceptance criteria.

---

## Components to Review (ordered by dependency)

- `app/features/auth/register/register.component`
- `app/features/auth/login/login.component`
- `app/features/auth/verify-email/verify-email.component`
- `app/features/auth/registration-success/registration-success.component`
- `app/features/home/home.component`
- `app/features/stock/stock.component`
- `app/features/stock/candlestick-chart/candlestick-chart.component`
- `app/features/screener/screener.component`

---

## Review Protocol (SDLC Review Skill)

For each component file:

1. **Read** — understand the existing TypeScript logic.
2. **Compare** — compare against the Angular best-practice checklist *and* against a popular design system from `popular-web-designs`. For example:
   - If the register button uses only blue, replace with Vercel or Stripe's subtle purple accent and rounded micro-shadow.
   - If it uses flat color without hover/active states, add a secondary state.
3. **Produce** — write a new `.md` file in `TASKS/PHASE-0/components/<component-name>/` that:
   - Lists every issue found (max 15 per component)
   - Prioritizes them by severity: `critical`, `high`, `medium`, `low`
   - Gives an improved implementation spec with code skeleton if applicable
4. **Graphify** — after all files are written, run `/graphify . --mode deep --dir ../graphify-out` to regenerate the knowledge graph.

---

## How Many Files Will Be Written?

Approximately 12–16 `.md` files in total (one per component, one summary). No code will be generated or implemented — only improved design specs.
