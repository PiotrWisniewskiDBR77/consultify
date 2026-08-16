import { defineConfig } from '@playwright/test';

import base from './playwright.config';
import { STORAGE_STATE_PATH } from './tests/e2e/_helpers/testSupportState';

const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const frontendPort = (() => {
  try {
    return new URL(frontendUrl).port || '3000';
  } catch {
    return '3000';
  }
})();

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
    ? (base as any).webServer.map((server: any) => {
        const url = String(server?.url || '');
        const isFrontendServer = url === frontendUrl;
        const isBackendServer = url.startsWith(`${backendUrl.replace(/\/$/, '')}/`);
        return {
          ...server,
          // Frontend production build + preview causes local flapping on slower machines.
          // Smoke uses a deterministic staging dev server instead.
          ...(isFrontendServer
            ? {
                command: `VITE_API_TARGET=${backendUrl} VITE_ENABLE_LOCAL_FEATURE_FLAG_OVERRIDES=true npx vite --mode staging --port ${frontendPort} --strictPort`,
              }
            : {}),
          // Backend must be fresh for deterministic auth + lane tests.
          // Frontend can reuse an already healthy listener to reduce local flapping.
          reuseExistingServer: isBackendServer ? false : true,
          timeout: Math.max(Number(server?.timeout || 0), 600000),
        };
      })
    : (base as any).webServer,
});
