import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

import { STORAGE_STATE_PATH } from './tests/e2e/_helpers/testSupportState';

const backendUrl = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
const frontendUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';
const useWebServer = process.env.E2E_USE_WEB_SERVER === 'true';
const enableGlobalTestSupport = process.env.E2E_REQUIRE_TEST_SUPPORT === 'true' || useWebServer;
const backendRunner = process.env.E2E_BACKEND_RUNNER || 'tsx'; // 'tsx' | 'build'
const testSupportKey = process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me';
// tsx's IPC pipe is a unix socket under TMPDIR; on deep worktree paths (e.g. long
// scratchpad dirs) the default `<cwd>/.tmp/e2e` path exceeds the OS socket-path
// length limit (EINVAL). Allow overriding with a short path via E2E_TMP_DIR.
const e2eTmpDir = process.env.E2E_TMP_DIR
  ? path.resolve(process.env.E2E_TMP_DIR)
  : path.resolve(process.cwd(), '.tmp', 'e2e');
const allowLocalhostRemote = process.env.E2E_ALLOW_LOCALHOST_REMOTE === 'true';
const e2eDatabaseUrl =
  process.env.DATABASE_URL || 'postgresql://user:pass@127.0.0.1:5432/consultify';
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
  'DB_TYPE=postgres',
  'DB_MANAGED_SCHEMA=off',
  `MOCK_DB=${process.env.E2E_MOCK_DB ?? 'true'}`,
  'MOCK_REDIS=true',
  'DB_QUERY_TIMEOUT=15000',
  'DB_STATEMENT_TIMEOUT=30000',
  'ENABLE_TEST_GATEWAY=true',
  'ENABLE_TEST_SUPPORT=true',
  'POSTGRES_SKIP_INIT_IN_TEST=1',
  'DISABLE_CONNECTION_POOL=true',
  'DISABLE_SCHEDULER=true',
  'DISABLE_AI_PROVIDER_SENTINEL=true',
  'DISABLE_AI_HEALTH_MONITOR=true',
  'DISABLE_STARTUP_HEALTH_MONITOR=true',
  'SKIP_STARTUP_VALIDATOR=true',
  `ENABLE_V8_GLOBAL=${process.env.ENABLE_V8_GLOBAL === 'true' ? 'true' : 'false'}`,
  `TEST_SUPPORT_KEY=${testSupportKey}`,
  `E2E_MODE=${process.env.E2E_MODE || 'false'}`,
].join(' ');

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: enableGlobalTestSupport ? './tests/e2e/smoke/global-setup.ts' : undefined,
  globalTeardown: enableGlobalTestSupport ? './tests/e2e/smoke/global-teardown.ts' : undefined,
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
    storageState: enableGlobalTestSupport ? STORAGE_STATE_PATH : undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 15000, // 15 seconds for actions
    navigationTimeout: 30000, // 30 seconds for navigation
  },
  projects: [
    {
      name: 'chromium',
      // Large viewport so react-flow canvas tools (mind-map / process-flow / whiteboard)
      // keep their nodes inside the visible area after fitView — headless can then click
      // them for real (small 1280×720 pushes nodes off-viewport → "outside of viewport").
      use: { ...devices['Desktop Chrome'], viewport: { width: 1680, height: 1050 } },
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
              : `mkdir -p "${e2eTmpDir}" && cd server && TMPDIR="${e2eTmpDir}" ${backendEnv} tsx src/index.ts`,
          url: `${backendUrl.replace(/\/$/, '')}/api/health/ping`,
          reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
          // Cold starts on shared machines can exceed 4 minutes.
          timeout: backendRunner === 'build' ? 600000 : 420000,
        },
        {
          command: `NODE_OPTIONS=--max-old-space-size=8192 VITE_API_TARGET=${backendUrl} npm run build && VITE_API_TARGET=${backendUrl} npx vite preview --port ${frontendPort} --strictPort`,
          url: frontendUrl,
          reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
          timeout: 420000,
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
