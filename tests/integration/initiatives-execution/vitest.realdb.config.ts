/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Real PostgreSQL contract harness for the Initiatives + Execution runtime.
 *
 * The test files deliberately rebuild the same isolated schema. They therefore
 * must run in one fork: parallel TRUNCATE/setup would test the harness race,
 * not the product transaction contract.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/initiatives-execution/**/*.realdb.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
