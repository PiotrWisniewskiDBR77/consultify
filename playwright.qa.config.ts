import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env.E2E_BASE_URL || 'https://demo.consultify.ai';

export default defineConfig({
  testDir: './tests/e2e/smoke',
  fullyParallel: false,
  workers: 1,
  timeout: 120000,
  retries: 0,
  reporter: [['list'], ['junit', { outputFile: 'e2e-results-qa.xml' }]],
  use: {
    baseURL: frontendUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

