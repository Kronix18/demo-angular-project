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
   **THOROUGHNESS RULE (Kevin, 2026-09-24 — after 2.1's data-only pass was
   rejected)**: a task passes verification only if the USER-VISIBLE outcome
   works, not a sub-layer of it. Concretely:
   - A "renders" claim requires pixel-level proof: canvas present + nonzero size
     + non-trivial drawn content (pixel count AND color variance thresholds;
     blank/filled canvas = FAIL). DOM presence alone is never enough.
   - A data/integration task behind a broken UI is NOT a pass: state plainly
     what still fails on the page ("chart area shows stuck Loading..." = fail
     of the rendering task, even if the fetch layer is green).
   - Assertions must match the task's user-facing claim, not the convenient
     subset. If the scope genuinely covers only a sub-layer, the verification
     section must say exactly that — never print a bare "N/N PASS" for a page
     that is visibly broken.
   - Every verify script must capture and REPORT console errors, stuck loading
     states, and missing elements — and must fail the run if the page's final
     state isn't the state the task promised.
4. **No inline styles / no hardcoded colors**: all styling via CSS custom
   properties defined in the theme SCSS file(s).
5. **Documentation updated in the same task** so another agent can pick up:
   update this index's status table, the phase doc, and the task file itself.
6. **One git commit per task** with a descriptive message — verification of TDD
   is done via git history (`test: ...` commit before `feat: ...` commit).

> **Note (7.2):** the per-task `scripts/verify-*.cjs` evidence scripts referenced in the task files below were folded into the Playwright suite (`e2e/`) and removed; their assertions live on in `e2e/*.spec.ts`. Earlier screenshots stay in `docs/screenshots/`.

## Status legend
- NOT STARTED / IN PROGRESS / DONE (browser-verified) / BLOCKED (by task(s))

## Index

| Task | File | Status | Notes |
|------|------|--------|-------|
| 0.1 | phase-0-audit/0.1-env-repo-hygiene.md | DONE (see task file) | graphify installed, baseline recorded, first checkpoint built |
| 0.2 | phase-0-audit/0.2-python-port-inventory.md | DONE (see task file) | inventory produced |
| 0.3 | phase-0-audit/0.3-api-spec-alignment.md | DONE (see task file) | spec aligned with demo data + 0.2 findings |
| 1.1 | phase-1-auth-navbar/1.1-auth-service-state.md | DONE (see task file) | auth state rehydrates; login subscribes |
| 1.2 | phase-1-auth-navbar/1.2-navbar-composition.md | DONE (see task file) | navbar composed for both auth states; verify-1-2.cjs ready for controller browser run |
| 1.3 | phase-1-auth-navbar/1.3-guards-and-login-page.md | DONE (see task file) | authGuard live on /screener,/profile,/stock/:symbol with returnUrl; login page links fixed; verify-1-3.cjs 13/13 |
| 2.1 | phase-2-chart-data/2.1-test-data-pipeline.md | DONE (data layer ONLY — /charts page still shows stuck Loading until 2.2) | 8 Stooq files served from public/test-data; URL+epoch-ms fixed; 26/26 specs; verify-2-1.cjs 15/15 (data assertions only) |
| 2.2 | phase-2-chart-data/2.2-chartjs-registration.md | DONE (pixel-verified: candles render on msft+qqq) | chart-setup module, canvas-in-DOM, zoneless markForCheck; 32/32 suite |
| 2.3 | phase-2-chart-data/2.3-toolbar-integration-redo.md | DONE | toolbar integration (see task file / git log) (status synced from git history 2026-09-29) |
| 3.1 | phase-3-panes-interaction/3.1-volume-pane.md | DONE | volume pane, aligned y-axes (status synced from git history 2026-09-29) |
| 3.2 | phase-3-panes-interaction/3.2-zoom-pan.md | DONE | zoom/pan (chartjs-plugin-zoom) (status synced from git history 2026-09-29) |
| 3.3 | phase-3-panes-interaction/3.3-crosshair-tooltip.md | DONE | crosshair through both panes (status synced from git history 2026-09-29) |
| 4.1 | phase-4-state-toolbar/4.1-chart-state-service.md | DONE | chart state store + sessionStorage (status synced from git history 2026-09-29) |
| 4.2 | phase-4-state-toolbar/4.2-toolbar-state-refactor.md | DONE | toolbar writes to state store (status synced from git history 2026-09-29) |
| 4.3 | phase-4-state-toolbar/4.3-time-range-presets.md | DONE | range presets, W-FRI weekly, linear index axis (status synced from git history 2026-09-29) |
| 5.1 | phase-5-indicators/5.1-indicator-calculations.md | DONE (unit-verified; golden values vs Python, 14 specs) | `core/indicators/*` + `IndicatorCalculationService`; UI render is 5.2 |
| 5.2 | phase-5-indicators/5.2-indicator-panel.md | DONE (browser-verified 12/12, `scripts/verify-5-2.cjs`) | overlay + oscillator panes, panel add/remove, state-driven |
| 5.3 | phase-5-indicators/5.3-indicator-management.md | DONE (browser-verified, `verify-5-2.cjs` 14/14) | inline validation (2..500), duplicate error, WMA/RMA, rehydration sanitising; persistence from 4.1 |
| 5.4 | phase-5-indicators/5.4-chart-layout-redesign.md | DONE (browser-verified 25/25, `scripts/verify-layout.cjs`) | one-panel chart, LOD windowing, full-viewport layout, compact navbar (Kevin, 2026-09-29) |
| 6.1 | phase-6-integration/6.1-routing-navigation.md | DONE (browser-verified, `scripts/verify-6-1-6-3.cjs`) | active-route styling, Charts link reopens last symbol, chart routes are fullscreen |
| 6.2 | phase-6-integration/6.2-design-token-compliance.md | DONE for shell + chart (browser-verified, `verify-6-2.cjs` 9/9); feature pages grandfathered by a ratchet | theme.scss, guard spec, opt-in dark theme |
| 6.3 | phase-6-integration/6.3-error-loading-states.md | DONE (browser-verified 13/13) | skeleton, error card (unknown symbol / no data / failed) + symbol picker + Retry |
| 6.4 | phase-6-integration/6.4-performance.md | NOT STARTED | MSFT has ~40y of daily bars |
| 7.1 | phase-7-testing/7.1-coverage-gate.md | DONE | `npm run test:coverage`: 97.8% stmts / 89.3% branches over core+charts+app.ts, gate at 80% |
| 7.2 | phase-7-testing/7.2-e2e-playwright.md | DONE | `npm run e2e`: 19 Playwright tests (auth, chart, indicators, layout x4 sizes, states, theme) |
| 7.3 | phase-7-testing/7.3-manual-matrix.md | NOT STARTED | |
| 8.1 | phase-8-cleanup-docs/8.1-dead-file-removal.md | DONE | 20 dead files removed; build + 14 spec files + browser scripts green |
| 8.2 | phase-8-cleanup-docs/8.2-readme-architecture.md | NOT STARTED | |
| 8.3 | phase-8-cleanup-docs/8.3-production-build.md | NOT STARTED | |
| 9.1 | phase-9-final/9.1-real-backend-auth.md | NOT STARTED | last task, needs backend |
| 10.1 | phase-10-tradingview/README.md#101 | NOT STARTED | TradingView dark theme (tokens) — Kevin-approved v2 |
| 10.2 | phase-10-tradingview/README.md#102 | NOT STARTED | legend rows + eye toggles |
| 10.3 | phase-10-tradingview/README.md#103 | NOT STARTED | drawing tools (chartjs-plugin-annotation) |
| 10.4 | phase-10-tradingview/README.md#104 | NOT STARTED | multi-pane layout, per-pane Y |
| 10.5 | phase-10-tradingview/README.md#105 | NOT STARTED | bottom toolbar + chart-type switcher |

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
