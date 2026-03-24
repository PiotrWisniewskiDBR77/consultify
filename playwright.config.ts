import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const useWebServer = process.env.E2E_USE_WEB_SERVER === 'true';
const backendRunner = process.env.E2E_BACKEND_RUNNER || 'tsx'; // 'tsx' | 'build'
const testSupportKey = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
const e2eTmpDir = path.resolve(process.cwd(), '.tmp', 'e2e');
const allowLocalhostRemote = process.env.E2E_ALLOW_LOCALHOST_REMOTE === 'true';
const e2eDatabaseUrl =
  process.env.DATABASE_URL || 'postgresql://user:pass@external-db-host:5432/consultify';
const backendPort = (() => {
  try {
    return new URL(backendUrl).port || '3001';
  } catch {
    return '3001';
  }
})();
const frontendPort = (() => {
  try {
    return new URL(frontendUrl).port || '3000';
  } catch {
    return '3000';
  }
})();

const backendEnv = [
  'NODE_ENV=test',
  `PORT=${backendPort}`,
  `DATABASE_URL=${e2eDatabaseUrl}`,
  'MOCK_DB=true',
  'MOCK_REDIS=true',
  'ENABLE_TEST_GATEWAY=true',
  'ENABLE_TEST_SUPPORT=true',
  `TEST_SUPPORT_KEY=${testSupportKey}`,
  `E2E_MODE=${process.env.E2E_MODE || 'false'}`,
].join(' ');

export default defineConfig({
  testDir: './tests/e2e',
  // Some legacy/spec files under tests/e2e are written for Vitest (not Playwright).
  // Ignore them so `npm run test:e2e` stays deterministic.
  testIgnore: [
    // iCloud/copy duplicates like "foo.spec 2.ts" must never be picked up as tests.
    '**/* [0-9].ts',
    '**/* [0-9].tsx',
    '**/* [0-9].js',
    '**/* [0-9].jsx',
    '**/security-cookie-auth.spec.ts',
    '**/security-policies-api.spec.ts',
  ],
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
          // Start backend for deterministic CI/E2E.
          //
          // Default: `tsx` (fast, runs TS sources directly).
          // Sandbox fallback: `E2E_BACKEND_RUNNER=build` (compile to dist/, then run node).
          command:
            backendRunner === 'build'
              ? `mkdir -p "${e2eTmpDir}" && cd server && npm run build && TMPDIR="${e2eTmpDir}" ${backendEnv} node dist/src/index.js`
              : `mkdir -p "${e2eTmpDir}" && cd server && TMPDIR="${e2eTmpDir}" ${backendEnv} npx tsx src/index.ts`,
          url: `${backendUrl.replace(/\/$/, '')}/api/health/ping`,
          reuseExistingServer: !process.env.CI,
          timeout: backendRunner === 'build' ? 600000 : 120000,
        },
        {
          command: `VITE_API_TARGET=${backendUrl} npx vite --port ${frontendPort} --strictPort`,
          url: frontendUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120000,
        },
      ]
    : undefined,
});

if (process.env.CI && !useWebServer) {
  const isLocalhostLike = (rawUrl: string) => {
    try {
      const { hostname } = new URL(rawUrl);
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    } catch {
      return false;
    }
  };

  if (!process.env.E2E_API_URL || !process.env.E2E_BASE_URL) {
    throw new Error(
      [
        'Remote-only L4 requires explicit E2E_API_URL and E2E_BASE_URL in CI.',
        'Set E2E_USE_WEB_SERVER=true for local mode.',
      ].join(' ')
    );
  }

  if (!allowLocalhostRemote && (isLocalhostLike(backendUrl) || isLocalhostLike(frontendUrl))) {
    throw new Error(
      [
        'Remote-only L4 is pointing to localhost.',
        'Set E2E_API_URL/E2E_BASE_URL to a real deployment.',
        'If you intentionally want localhost with E2E_USE_WEB_SERVER=false, set E2E_ALLOW_LOCALHOST_REMOTE=true.',
      ].join(' ')
    );
  }
}
