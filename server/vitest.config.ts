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
    exclude: ['node_modules', 'dist'],
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
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@services': path.resolve(__dirname, './src/services'),
      '@routes': path.resolve(__dirname, './src/routes'),
      '@middleware': path.resolve(__dirname, './src/middleware'),
      '@types': path.resolve(__dirname, './src/types'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@tests': path.resolve(__dirname, './tests'),
    },
  },
});
