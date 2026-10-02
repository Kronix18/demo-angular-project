import { defineConfig } from '@playwright/test';

/** Smoke tests against the PRODUCTION bundle (8.3): `npm run e2e:prod` builds, serves dist on :4300, runs e2e-prod/. */
export default defineConfig({
  testDir: './e2e-prod',
  timeout: 45_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4300',
    viewport: { width: 1400, height: 800 },
    launchOptions: process.env['CHROMIUM_PATH'] ? { executablePath: process.env['CHROMIUM_PATH'] } : {},
  },
  webServer: {
    command: 'node scripts/serve-dist.cjs 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: true,
  },
});
