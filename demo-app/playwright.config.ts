import { defineConfig } from '@playwright/test';

/**
 * E2E (7.2). `npm run e2e` starts `ng serve` itself (reuses one already on :4200).
 * Browser: Playwright's own chromium by default; set CHROMIUM_PATH to use a
 * pre-installed binary (e.g. CHROMIUM_PATH=/opt/pw-browsers/chromium in CI images).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4200',
    viewport: { width: 1400, height: 800 },
    trace: 'retain-on-failure',
    launchOptions: process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
  },
  webServer: {
    command: 'npx ng serve --port 4200',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
