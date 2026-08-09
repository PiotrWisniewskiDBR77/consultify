import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'ideas-navigation-matrix.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 10 * 60 * 1000,
  expect: { timeout: 15000 },
  reporter: [
    ['list'],
    [
      'json',
      {
        outputFile:
          process.env.IDEAS_NAV_RESULTS ||
          'docs/qa/ideas-navigation-2026-08-09/playwright-results.json',
      },
    ],
  ],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 10000,
  },
});
