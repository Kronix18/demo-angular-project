# TASKS/ — One File Per Task

Replanned 2026-09-23 after full codebase + docs audit. Supersedes the task list
previously embedded in TASKS.md (which had duplicate task numbers, false
"completed" claims, and copy-paste verification blocks).

## Mandatory rules for EVERY task (non-negotiable)

1. **Graphify checkpoint** at task start: `/graphify . --mode deep --dir graphify-out/`
   (install graphifyy first — see task 0.1).
2. **TDD (strict)**: write the spec file FIRST, run it, confirm it FAILS for the
   right reason (RED), commit it, then implement (GREEN). No production code
   before a failing test exists.
3. **Verify in a real browser yourself**: `npm run build` (exit 0) then `ng serve`,
   open the route in a browser (Playwright via the browser tool), assert the DOM,
   check the console is clean, take a screenshot as evidence. Never hand this to
   the user as "please verify".
4. **No inline styles / no hardcoded colors**: all styling via CSS custom
   properties defined in the theme SCSS file(s).
5. **Documentation updated in the same task** so another agent can pick up:
   update this index's status table, the phase doc, and the task file itself.
6. **One git commit per task** with a descriptive message — verification of TDD
   is done via git history (`test: ...` commit before `feat: ...` commit).

## Status legend
- NOT STARTED / IN PROGRESS / DONE (browser-verified) / BLOCKED (by task(s))

## Index

| Task | File | Status | Notes |
|------|------|--------|-------|
| 0.1 | phase-0-audit/0.1-env-repo-hygiene.md | DONE (see task file) | graphify installed, baseline recorded, first checkpoint built |
| 0.2 | phase-0-audit/0.2-python-port-inventory.md | NOT STARTED | was "0.2" before; never actually produced a doc |
| 0.3 | phase-0-audit/0.3-api-spec-alignment.md | NOT STARTED | align spec with test-data reality |
| 1.1 | phase-1-auth-navbar/1.1-auth-service-state.md | NOT STARTED | BLOCKING user complaint (login never fires) |
| 1.2 | phase-1-auth-navbar/1.2-navbar-composition.md | NOT STARTED | BLOCKING user complaint (only Pricing shows) |
| 1.3 | phase-1-auth-navbar/1.3-guards-and-login-page.md | NOT STARTED | guard redirects to dead route |
| 2.1 | phase-2-chart-data/2.1-test-data-pipeline.md | NOT STARTED | chart data is currently unfetchable |
| 2.2 | phase-2-chart-data/2.2-chartjs-registration.md | NOT STARTED | chart cannot construct today |
| 2.3 | phase-2-chart-data/2.3-toolbar-integration-redo.md | NOT STARTED | previous "completed" claim was false |
| 3.1 | phase-3-panes-interaction/3.1-volume-pane.md | NOT STARTED | verify dual-axis actually renders |
| 3.2 | phase-3-panes-interaction/3.2-zoom-pan.md | NOT STARTED | plugin installed, never registered |
| 3.3 | phase-3-panes-interaction/3.3-crosshair-tooltip.md | NOT STARTED | |
| 4.1 | phase-4-state-toolbar/4.1-chart-state-service.md | NOT STARTED | moved BEFORE toolbar (old plan had it after) |
| 4.2 | phase-4-state-toolbar/4.2-toolbar-state-refactor.md | NOT STARTED | |
| 4.3 | phase-4-state-toolbar/4.3-time-range-presets.md | NOT STARTED | old duplicate-numbered "3.2" |
| 5.1 | phase-5-indicators/5.1-indicator-calculations.md | NOT STARTED | ports real Python calculators |
| 5.2 | phase-5-indicators/5.2-indicator-panel.md | NOT STARTED | |
| 5.3 | phase-5-indicators/5.3-indicator-management.md | NOT STARTED | |
| 6.1 | phase-6-integration/6.1-routing-navigation.md | NOT STARTED | charts route exists; navbar link missing |
| 6.2 | phase-6-integration/6.2-design-token-compliance.md | NOT STARTED | constraint currently violated |
| 6.3 | phase-6-integration/6.3-error-loading-states.md | NOT STARTED | |
| 6.4 | phase-6-integration/6.4-performance.md | NOT STARTED | MSFT has ~40y of daily bars |
| 7.1 | phase-7-testing/7.1-coverage-gate.md | NOT STARTED | |
| 7.2 | phase-7-testing/7.2-e2e-playwright.md | NOT STARTED | replaces stray gen-baselines scripts |
| 7.3 | phase-7-testing/7.3-manual-matrix.md | NOT STARTED | |
| 8.1 | phase-8-cleanup-docs/8.1-dead-file-removal.md | NOT STARTED | |
| 8.2 | phase-8-cleanup-docs/8.2-readme-architecture.md | NOT STARTED | |
| 8.3 | phase-8-cleanup-docs/8.3-production-build.md | NOT STARTED | |
| 9.1 | phase-9-final/9.1-real-backend-auth.md | NOT STARTED | last task, needs backend |

## Re-audit of previously "completed" work (old Phase 1-2 claims)

- Old 1.1 "Charts Module Creation" — ChartsModule is an EMPTY, UNUSED NgModule
  in a standalone app. Re-scoped into 2.x. File slated for removal in 8.1.
- Old 1.2 "Core Services Setup" — ChartDataService exists but its URL builder
  produces `MSFT.US.us.txt` (double suffix) against a non-existent
  `src/assets/` dir. Fixed in 2.1. IndicatorCalculationService is a TODO stub
  (Phase 5, real port).
- Old 1.3 "Basic Chart Component" — component exists but cannot construct a
  chart (missing Chart.register, no date adapter, bad timestamps). Fixed in 2.x.
- Old 3.2 "Toolbar-Chart Integration (Completed)" — integration code exists but
  was never verified in a browser; chart never rendered, so the claim is false.
  Redone properly in 2.3.
- Old 6.1 "Routing Integration" — the `/charts/:symbol` route genuinely works
  (page loads, no redirect). The only honestly-done item. Kept.
- `app.spec.ts` — stale scaffold test ("Hello, demo-app") that fails today.
  Rewritten in 1.2.

## Superseded docs
- `PHASE1_COMPLETED.md` — contains false claims; corrected with re-audit header.
- `SUMMARY.md` — superseded by this index + per-phase docs; marked as such.
- `PLANNING_SUMMARY.md` — historical only.
