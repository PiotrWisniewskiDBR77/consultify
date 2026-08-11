import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/initiatives-execution',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:3310',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'VITE_API_TARGET=http://127.0.0.1:3311 npx vite --port 3310 --strictPort',
    url: 'http://127.0.0.1:3310/tests/e2e/fixtures/initiatives-execution-aco.html',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
