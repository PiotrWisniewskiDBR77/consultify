/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Dedicated vitest config for the MW-CORE-001 golden-flow real-Postgres test.
 *
 * Deliberately NOT the root vitest.config.ts: that config's `setupFiles:
 * './tests/setup.ts'` installs global DB mocks for the fast unit suite
 * (see tests/setup.ts + the comment in vitest.acceptance.config.ts) — running
 * this test under it would silently defeat MOCK_DB=false and hide the whole
 * point of exercising real Postgres. Also deliberately NOT
 * vitest.acceptance.config.ts (a repo-root file, out of this task's tests/**
 * + scripts/** scope to touch) — this file lives under tests/** instead so
 * the whole test infra stays inside the assigned scope.
 *
 * Mirrors vitest.acceptance.config.ts's real-runtime posture: node
 * environment, no jsdom, no global setup file, single sequential fork (a
 * shared scratch Postgres + fixture rows are not safe under parallel forks),
 * retry disabled by default (also passed via --retry=0 on the CLI by
 * scripts/test-mw-core-golden-flow-pg.sh, belt-and-suspenders).
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
    retry: 0,
  },
});
