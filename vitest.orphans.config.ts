/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

import base from './vitest.config';

/**
 * "Orphan suites" harness — real vitest test files that structurally could
 * never be collected by the default `vitest.config.ts` include globs:
 *
 *  - `server/tests/**` — excluded on purpose in vitest.config.ts (comment:
 *    "server/tests excluded - require full DB schema"), but never wired to
 *    a runner of its own, so it sat invisible in both CI and local dev.
 *  - `tests/simple_import.test.js` — a single file at the ROOT of `tests/`,
 *    which no `tests/<subdir>/**` include glob in vitest.config.ts can ever
 *    match (there is no `tests/*.test.js` pattern).
 *
 * Found during the 2026-08-13 test-discovery sprint (STREAM 6). Both are
 * real, passing vitest suites once actually pointed at — see
 * docs/program/METHOD_TOOLS_2026-08-13/TEST_INVENTORY.md.
 *
 * Reuses the main config's `resolve.alias` (needed: `simple_import.test.js`
 * imports `server/src/database/Database.js`, which only resolves via the
 * `.js -> .ts` legacy-path aliases defined there) and DB-related env.
 *
 * Deliberately NOT included here: `server/tests/virtual-workers-integration.test.ts`.
 * That file is not a vitest suite — it defines its own ad-hoc `test()` helper,
 * expects a live HTTP server on localhost:3001, and ends with `main().catch(() =>
 * process.exit(1))`. Under vitest it collects zero real suites ("No test suite
 * found in file"). Classified LEGACY (manual smoke script) in TEST_INVENTORY.md;
 * run it directly with `tsx server/tests/virtual-workers-integration.test.ts`
 * against a running backend, not through this config.
 */
export default defineConfig({
  plugins: [react()],
  resolve: (base as any).resolve,
  test: {
    globals: true,
    environment: 'node',
    setupFiles: (base as any).test?.setupFiles,
    env: (base as any).test?.env,
    include: [
      'server/tests/**/*.{test,spec}.{ts,js}',
      'tests/simple_import.test.js',
    ],
    exclude: [
      'node_modules/**',
      // Not a vitest suite — see module comment above.
      'server/tests/virtual-workers-integration.test.ts',
    ],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
