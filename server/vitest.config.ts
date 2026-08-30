/**
 * Vitest Configuration for Backend TypeScript Tests
 * Enterprise SaaS Architecture
 */

import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'tests/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    testTimeout: 10000,
    exclude: ['node_modules', 'dist', 'tests/performance/**'],
    env: {
      DB_TYPE: process.env.DB_TYPE || 'sqlite',
      NODE_ENV: 'test',
      // Satisfy \"optional\" config assertions in legacy tests
      GOOGLE_CLIENT_ID: 'test',
      LINKEDIN_CLIENT_ID: 'test',
      MICROSOFT_CLIENT_ID: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts', '**/*.config.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 90,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      { find: '@services', replacement: path.resolve(__dirname, './src/services') },
      { find: '@routes', replacement: path.resolve(__dirname, './src/routes') },
      { find: '@middleware', replacement: path.resolve(__dirname, './src/middleware') },
      { find: '@types', replacement: path.resolve(__dirname, './src/types') },
      { find: '@utils', replacement: path.resolve(__dirname, './src/utils') },
      { find: '@tests', replacement: path.resolve(__dirname, './tests') },

      // Keep mocks as JS
      { find: /^(\.?\.\/.*__mocks__.*)\.js$/, replacement: '$1.js' },

      // Global: map relative .js imports to .ts when available (migration support)
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
