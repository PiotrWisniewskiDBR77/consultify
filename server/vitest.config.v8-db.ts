/**
 * Vitest Configuration — V8 Real-DB Integration Tests
 * CP-02: Runs V8 service tests against a real Railway Postgres database.
 *
 * Usage:
 *   V8_DB_TEST_MODE=real npx vitest run --config vitest.config.v8-db.ts
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/services/v8/__tests__/v8-db-compatibility.test.ts',
    ],
    exclude: ['**/node_modules/**'],
    environment: 'node',
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      V8_DB_TEST_MODE: 'real',
      NODE_ENV: 'test',
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
      {
        find: /^(\.?\.\/.*)(?<!__mocks__\/.*)\.js$/,
        replacement: '$1.ts',
        customResolver: async function (updatedId, importer, options) {
          const tsResolution = await this.resolve(updatedId, importer, {
            ...options,
            skipSelf: true,
          });
          if (tsResolution) return tsResolution;

          const jsPath = updatedId.replace(/\.ts$/, '.js');
          return this.resolve(jsPath, importer, { ...options, skipSelf: true });
        },
      },
    ],
  },
});
