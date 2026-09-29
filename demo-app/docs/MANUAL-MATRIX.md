# Manual test matrix — results

Run 2026-09-29 by `scripts/manual-matrix.cjs` against the dev server (Chromium (pre-installed build), 1400×800 unless noted). Re-run: `CHROMIUM_PATH=… node scripts/manual-matrix.cjs` with `npm start` running.

**PASS:29 · NOT RUN:2**

| Area | Item | Result | Detail | Evidence |
|---|---|---|---|---|
| Symbols | msft (1D, 6M) | PASS | 192 candles in window, 68621 px / 50 colours | [screenshot](screenshots/matrix/symbol-msft.png) |
| Symbols | qqq (1D, 6M) | PASS | 192 candles in window, 106072 px / 50 colours | [screenshot](screenshots/matrix/symbol-qqq.png) |
| Symbols | nvda (1D, 6M) | PASS | 192 candles in window, 133711 px / 50 colours | [screenshot](screenshots/matrix/symbol-nvda.png) |
| Symbols | pltr (1D, 6M) | PASS | 192 candles in window, 88543 px / 50 colours | [screenshot](screenshots/matrix/symbol-pltr.png) |
| Symbols | ia (1D, 6M) | PASS | 192 candles in window, 81127 px / 50 colours | [screenshot](screenshots/matrix/symbol-ia.png) |
| Intervals | 1d → 1w (aggregated) | PASS | view end index 10207 → 2115 | [screenshot](screenshots/matrix/interval-1w.png) |
| Intervals | 1m disabled (needs backend) | PASS |  |  |
| Intervals | 5m disabled (needs backend) | PASS |  |  |
| Intervals | 1h disabled (needs backend) | PASS |  |  |
| Ranges | msft 1M | PASS | 21 bars visible (expected 15–30) | [screenshot](screenshots/matrix/range-1M.png) |
| Ranges | msft 3M | PASS | 65 bars visible (expected 50–80) |  |
| Ranges | msft 6M | PASS | 127 bars visible (expected 100–140) |  |
| Ranges | msft YTD | PASS | 181 bars visible (expected 20–260) |  |
| Ranges | msft 1Y | PASS | 252 bars visible (expected 230–270) |  |
| Ranges | msft ALL | PASS | 10207 bars visible (expected 9000–20000) | [screenshot](screenshots/matrix/range-ALL.png) |
| Indicators | sma(20) add / persist / remove | PASS | added=true persisted=true removed=true | [screenshot](screenshots/matrix/indicator-sma.png) |
| Indicators | ema(12) add / persist / remove | PASS | added=true persisted=true removed=true | [screenshot](screenshots/matrix/indicator-ema.png) |
| Indicators | rsi(14) add / persist / remove | PASS | added=true pane px=13506 persisted=true removed=true | [screenshot](screenshots/matrix/indicator-rsi.png) |
| Indicators | atr(14) add / persist / remove | PASS | added=true pane px=8840 persisted=true removed=true | [screenshot](screenshots/matrix/indicator-atr.png) |
| Indicators | webby_rsi (defaults) add / persist / remove | PASS | added=true pane px=14966 persisted=true removed=true | [screenshot](screenshots/matrix/indicator-webby_rsi.png) |
| Indicators | bob_marley (defaults) add / persist / remove | PASS | added=true pane px=14877 persisted=true removed=true | [screenshot](screenshots/matrix/indicator-bob_marley.png) |
| Auth | logged-out navbar | PASS | Login, Register |  |
| Auth | guard: /screener → login (returnUrl) | PASS | /auth/login?returnUrl=%2Fscreener |  |
| Auth | login → logged-in navbar + returnUrl | PASS | My Account, Logout @ /screener |  |
| Auth | refresh persists login | PASS |  |  |
| Auth | logout + refresh stays logged out | PASS |  |  |
| Viewport 375px | home navbar wraps, no horizontal scroll | PASS | navbar 151px, overflow-x 0px | [screenshot](screenshots/matrix/mobile-home.png) |
| Viewport 375px | chart page: no page scroll, chart usable | PASS | navbar 99px, chart 451px tall, overflow 0/0 | [screenshot](screenshots/matrix/mobile-chart.png) |
| Browsers | Firefox | NOT RUN | browser binary not installed in this environment |  |
| Browsers | WebKit | NOT RUN | browser binary not installed in this environment |  |
| Console | no unexpected console/page errors during the whole run | PASS |  |  |
