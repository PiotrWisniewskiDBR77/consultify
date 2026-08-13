/// <reference types="vitest" />
import path from 'path';
import { defineConfig } from 'vitest/config';

/**
 * Acceptance harness config — REAL local-runtime E2E.
 * Runs against a LOCAL Postgres (docker) with the FULL schema loaded.
 * NOT part of the fast unit suite. Single-threaded, no global mocks.
 *
 * STREAM G1 (2026-08-13): added the `@` -> `src` alias (mirrors
 * `vitest.config.ts`'s first alias entry). Without it, ANY server module
 * reachable from a route under test that transitively imports something from
 * `src/` via the `@/...` alias (e.g. `server/src/services/tools/
 * toolOutputSnapshotService.ts` -> `src/toolOutputs/buildSwotOutput.ts` ->
 * `@/config/swot/swotTensionEngine`) crashes the WHOLE test file at
 * collection time with "Cannot find package '@/...'" — every test in that
 * file then reports as "skipped", not failed, which reads as green in a
 * quick scan. Verified this was already broken on this branch's base commit
 * (773c72d371) before any STREAM G1 change: `tests/acceptance/
 * tls04-swot-proposal-lifecycle.e2e.test.ts` collected 0 real assertions
 * (29 tests, all skipped) with this file unmodified. This one-line addition
 * only ADDS a previously-unresolvable path mapping — it cannot change how
 * any currently-resolvable relative/legacy import resolves.
 */
export default defineConfig({
  resolve: {
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
