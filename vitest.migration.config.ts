/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * Dedicated config for TypeScript-migration verification tests.
 *
 * We keep it separate so the main test suite stays fast and focused.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/migration/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    // These tests scan the repo and can be slower
    testTimeout: 120000,
  },
});

