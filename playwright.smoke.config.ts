import { defineConfig } from '@playwright/test';

import base from './playwright.config';

export default defineConfig({
  ...(base as any),
  testDir: './tests/e2e/smoke',
  // Smoke should be fast and deterministic.
  fullyParallel: false,
  workers: 1,
});
