import { defineConfig, devices } from '@playwright/test';

const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const useWebServer = process.env.E2E_USE_WEB_SERVER === 'true';
const backendPort = (() => {
  try {
    return new URL(backendUrl).port || '3001';
  } catch {
    return '3001';
  }
})();

export default defineConfig({
  testDir: './tests/e2e',
  // Some legacy/spec files under tests/e2e are written for Vitest (not Playwright).
  // Ignore them so `npm run test:e2e` stays deterministic.
  testIgnore: ['**/security-cookie-auth.spec.ts', '**/security-policies-api.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000, // 60 seconds per test
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  reporter: [['list'], ['junit', { outputFile: 'e2e-results.xml' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000, // 15 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Visual regression tests
    {
      name: 'visual-regression',
      testMatch: '**/visual-regression.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        screenshot: 'on',
      },
    },
  ],
  webServer: useWebServer
    ? [
        {
          // Start backend directly (skip migrations) for deterministic CI/E2E.
          // The server's DatabaseInitializer will bootstrap a minimal schema from TEST_SCHEMA in test mode.
          command: `cd server && PORT=${backendPort} NODE_ENV=test E2E_MODE=${process.env.E2E_MODE || 'false'} DB_TYPE=sqlite SQLITE_PATH=../data/dev/consultinity-e2e.db MOCK_DB=false npx tsx src/index.ts`,
          url: `${backendUrl.replace(/\/$/, '')}/api/health`,
          reuseExistingServer: true,
          timeout: 120000,
        },
        {
          command: `VITE_API_TARGET=${backendUrl} npm run dev:frontend`,
          url: frontendUrl,
          reuseExistingServer: true,
          timeout: 120000,
        },
      ]
    : undefined,
});
