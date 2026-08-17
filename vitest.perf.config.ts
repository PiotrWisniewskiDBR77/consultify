import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      {
        find: '@aws-sdk/client-s3',
        replacement: path.resolve(__dirname, './tests/__mocks__/aws-sdk-client-s3.js'),
      },

      // Keep specific overrides if necessary, but remove generic catch-all that breaks JS mocking
    ],
  },
  test: {
    globals: true,
    environment: 'node', // Performance tests often run in node
    env: {
      DB_TYPE: 'sqlite',
      NODE_ENV: 'test',
    },
    setupFiles: ['./tests/performance/setup.ts'],
    include: [
      'tests/performance/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Support legacy extensionless tests (to be phased out)
      'tests/performance/**/*.{test,spec}',
    ],
    exclude: [
      'node_modules/**',
      // Long-running suite is executed via `npm run test:memory-leak`
      'tests/performance/memory-leak.test.ts',
    ],
    // Optimize test execution
    pool: 'forks',
    fileParallelism: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
