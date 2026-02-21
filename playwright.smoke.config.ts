import { defineConfig } from '@playwright/test';

import base from './playwright.config';

export default defineConfig({
  ...(base as any),
  testDir: './tests/e2e/smoke',
  // Smoke should be fast and deterministic.
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/smoke/global-setup.ts',
  globalTeardown: './tests/e2e/smoke/global-teardown.ts',
  use: {
    ...(base as any).use,
    storageState: 'test-results/e2e-storage-state.json',
  },
});
