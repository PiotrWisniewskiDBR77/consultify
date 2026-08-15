import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3110';
const evidenceDir =
  process.env.E2E_EVIDENCE_DIR || path.join('/tmp', 'consultify-local-browser-16');
const target = new URL(baseURL);

if (!['127.0.0.1', 'localhost'].includes(target.hostname)) {
  throw new Error(`LOCAL_BROWSER_16_LOCAL_TARGET_REQUIRED: ${baseURL}`);
}

export default defineConfig({
  testDir: './tests/e2e/local-browser-16',
  globalSetup: './tests/e2e/demo-acceptance/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  outputDir: path.join(evidenceDir, 'test-results'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(evidenceDir, 'playwright-results.json') }],
    ['html', { outputFolder: path.join(evidenceDir, 'html'), open: 'never' }],
  ],
  use: {
    baseURL,
    storageState: path.join(evidenceDir, 'owner-storage-state.json'),
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: 'owner-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 960 } },
    },
    { name: 'owner-mobile', use: { ...devices['iPhone 13'] } },
  ],
});
