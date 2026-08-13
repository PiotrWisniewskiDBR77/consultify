/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Acceptance harness config — REAL local-runtime E2E.
 * Runs against a LOCAL Postgres (docker) with the FULL schema loaded.
 * NOT part of the fast unit suite. Single-threaded, no global mocks.
 */
export default defineConfig({
  resolve: {
    // Mirrors vitest.config.ts's `@` -> src alias. Without it, any acceptance
    // test that mounts a REAL router pulling `@/config/**` (e.g. ToolController
    // -> toolOutputSnapshotService -> buildSwotOutput -> @/config/swot/...)
    // fails at import time with "Cannot find package '@/...'" — a test-infra
    // gap, not a product bug (G4 roster stream, 2026-08-13).
    alias: [{ find: '@', replacement: path.resolve(__dirname, './src') }],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/acceptance/**/*.{test,spec}.{ts,tsx,js,mjs}'],
    exclude: ['node_modules/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    // Vitest 4: single sequential fork (replaces poolOptions.forks.singleFork).
    fileParallelism: false,
    // No setup.ts here — that file installs global DB mocks for the unit suite,
    // which would defeat the whole point of a real-runtime acceptance test.
  },
});
