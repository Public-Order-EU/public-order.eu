import { defineConfig, devices } from '@playwright/test';
import { E2E } from './tests/e2e/config.mjs';

/**
 * End-to-end tests against the built site, the real Functions and a local D1
 * database (see tests/e2e/server.mjs). Run with `pnpm test:e2e`.
 *
 * Uses Playwright's Chromium (`pnpm exec playwright install chromium`), or a
 * browser already on the system: CHROMIUM_PATH=/usr/bin/chromium pnpm test:e2e
 */
export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: the tests share one database and check the counter.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
  webServer: {
    command: 'node tests/e2e/server.mjs',
    url: `${E2E.origin}/api/count`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
