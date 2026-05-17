import { defineConfig } from '@playwright/test';

import base from './playwright.config';
import { STORAGE_STATE_PATH } from './tests/e2e/_helpers/testSupportState';

export default defineConfig({
  ...(base as any),
  testDir: './tests/e2e/smoke',
  captureGitInfo: { commit: false, diff: false },
  // Smoke should be fast and deterministic.
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/smoke/global-setup.ts',
  globalTeardown: './tests/e2e/smoke/global-teardown.ts',
  use: {
    ...(base as any).use,
    storageState: STORAGE_STATE_PATH,
  },
  // In busy local environments the inherited 120s frontend timeout is too aggressive,
  // which causes false negatives unrelated to product behavior.
  webServer: Array.isArray((base as any).webServer)
    ? (base as any).webServer.map((server: any) => ({
        ...server,
        // For GO gates we want deterministic fresh servers, not potentially stale listeners.
        reuseExistingServer: false,
        timeout: Math.max(Number(server?.timeout || 0), 300000),
      }))
    : (base as any).webServer,
});
