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
    include: ['tests/performance/**/*.test.js'],
    exclude: ['node_modules/**'],
    // Optimize test execution
    pool: 'forks',
    fileParallelism: true,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
