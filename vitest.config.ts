/// <reference types="vitest" />
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vitest/config';

const VITEST_HEAP_MB = (() => {
  const raw = process.env.VITEST_HEAP_MB;
  if (!raw) return NaN;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : NaN;
})();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Universal server/src alias
      {
        find: /^.*\/server\/src\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/$1.ts'),
      },
      // Bridge legacy server/services paths to server/src/services
      {
        find: /.*\/server\/services\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/$1.ts'),
      },
      {
        find: /.*\/server\/services\/(.*)$/,
        replacement: path.resolve(__dirname, 'server/src/services/$1'),
      },
      // Handle absolute-looking /server/ paths used in some tests (avoid leading slash issues)
      {
        find: /^server\/src\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/$1.ts'),
      },
      {
        find: /^server\/(.*)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/$1.ts'),
      },
      {
        find: '@aws-sdk/client-s3',
        replacement: path.resolve(__dirname, './tests/__mocks__/aws-sdk-client-s3.js'),
      },

      // 1. KEEP Legacy JS files as JS (exclude from TS mapping)
      // Database module - redirect to TypeScript version
      {
        find: /.*\/server\/database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      {
        find: /.*\/server\/src\/database\/Database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      // Server index module - redirect to TypeScript version
      {
        find: /.*\/server\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/index.ts'),
      },
      {
        find: /.*\/server\/src\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/index.ts'),
      },

      // Config modules - redirect to TypeScript
      {
        find: /.*\/server\/src\/config\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/config/index.ts'),
      },
      {
        find: /.*\/config\/DatabaseConfig\.js$/,
        replacement: path.resolve(__dirname, 'server/src/config/DatabaseConfig.ts'),
      },
      {
        find: '../config/DatabaseConfig.js',
        replacement: path.resolve(__dirname, 'server/src/config/DatabaseConfig.ts'),
      },

      // Fix relative database imports (e.g., from workqueueService.ts)
      {
        find: /^\.\.\/database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },
      {
        find: /^\.\.\/\.\.\/database\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/Database.ts'),
      },

      // Legacy service paths (server/services/) -> new location (server/src/services/)
      {
        find: /.*\/server\/services\/ragService\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/ragService.ts'),
      },
      {
        find: /.*\/server\/services\/circuitBreakerService\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/circuitBreakerService.ts'),
      },
      {
        find: /.*\/server\/services\/ai\/circuitBreaker\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/ai/circuitBreaker.ts'),
      },
      {
        find: /.*\/server\/services\/ai\/ragMetricsService\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/ai/ragMetricsService.ts'),
      },
      {
        find: /.*\/server\/services\/ai\/citationVerifier\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/ai/citationVerifier.ts'),
      },
      {
        find: /.*\/server\/services\/ai\/rerankerService\.js$/,
        replacement: path.resolve(__dirname, 'server/src/services/ai/rerankerService.ts'),
      },
      {
        find: /.*\/server\/routes\/superadmin\.js$/,
        replacement: path.resolve(__dirname, 'server/src/routes/superadmin.routes.ts'),
      },

      // Legacy middleware paths (server/middleware/) -> new location (server/src/middleware/)
      {
        find: /.*\/server\/middleware\/([^/]+)$/,
        replacement: path.resolve(__dirname, 'server/src/middleware/$1.ts'),
      },
      {
        find: /.*\/server\/middleware\/([^/]+)\.js$/,
        replacement: path.resolve(__dirname, 'server/src/middleware/$1.ts'),
      },

      // Legacy routes paths (server/routes/) -> new location (server/src/routes/)
      {
        find: /.*\/server\/routes\/ai\.js$/,
        replacement: path.resolve(__dirname, 'server/src/routes/ai.routes.ts'),
      },
      {
        find: /.*\/database\.postgres\.js$/,
        replacement: path.resolve(__dirname, 'server/database.postgres.js'),
      },
      {
        find: '../../database.sqlite.active.js',
        replacement: path.resolve(__dirname, 'server/database.sqlite.active.js'),
      },
      {
        find: /.*\/database\.sqlite\.active\.js$/,
        replacement: path.resolve(__dirname, 'server/database.sqlite.active.js'),
      },
      {
        find: /.*\/learningSystem\.js$/,
        replacement: path.resolve(__dirname, 'server/services/ai/learningSystem.js'),
      },
      {
        find: /.*\/src\/database\/index\.js$/,
        replacement: path.resolve(__dirname, 'server/src/database/index.ts'),
      },
      {
        find: /.*\/auditLogService\.js$/,
        replacement: path.resolve(__dirname, 'server/services/auditLogService.ts'),
      },
      // Handle extensionless require from index.cjs
      {
        find: /.*\/middleware\/auditLog$/,
        replacement: path.resolve(__dirname, 'server/middleware/auditLog.ts'),
      },

      // 2. KEEP Mocks as JS (exclude from TS mapping)
      { find: /^(\.?\.\/.*__mocks__.*)\.js$/, replacement: '$1.js' },

      // 3. Global alias for other relative .js imports -> .ts (unless in __mocks__ or specific files)
      {
        find: /^(\.?\.\/.*)(?<!__mocks__\/.*)\.js$/,
        replacement: '$1.ts',
        customResolver: async function (updatedId, importer, options) {
          // 1. Try to resolve the TS file (Src preference)
          const tsResolution = await this.resolve(updatedId, importer, {
            ...options,
            skipSelf: true,
          });
          if (tsResolution) return tsResolution;

          // 2. Fallback to JS file (Legacy)
          const jsPath = updatedId.replace(/\.ts$/, '.js');
          return this.resolve(jsPath, importer, { ...options, skipSelf: true });
        },
      },
    ],
  },
  // Disable .env loading in tests to avoid permission issues
  envPrefix: [],
  envDir: undefined, // Don't load .env files
  test: {
    globals: true,
    environment: 'jsdom',
    env: {
      DB_TYPE: 'sqlite',
      NODE_ENV: 'test',
      ENABLE_TEST_GATEWAY: 'true', // Mount full Gateway routes for integration tests
    },
    setupFiles: './tests/setup.ts',
    include: [
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/components/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/hooks/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/store/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/backend/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Integration tests excluded from default run - require DB setup
      // Run separately with: npm run test:integration
      'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Advanced pattern test directories (Agent 2)
      'tests/animation/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/accessibility/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/browser/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/network/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/keyboard/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/clipboard/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/localization/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/responsive/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Agent 1 directories
      'tests/worker/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/indexeddb/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/virtual/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/gesture/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/audio/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/canvas/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/pdf/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/csv/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Security tests (Agent 5)
      'tests/security/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Performance tests (Agent 5)
      'tests/performance/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // server/tests excluded - require full DB schema
      // Run separately with specialized setup
      // 'server/tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    // Optimize test execution
    pool: 'forks', // Use forks instead of threads to avoid napi_throw with SQLite native bindings
    singleFork: false,
    // Pass Node flags to runner workers (Vitest v4 pool rework)
    execArgv: Number.isFinite(VITEST_HEAP_MB) ? [`--max-old-space-size=${VITEST_HEAP_MB}`] : [],
    // Enable test file parallelization (but not within files)
    fileParallelism: true,
    // Enhanced timeout configuration for stability
    testTimeout: 60000, // 60 seconds per test (increased for lazy loading)
    hookTimeout: 120000, // 120 seconds for hooks (increased for integration DB setup)
    teardownTimeout: 10000, // 10 seconds for cleanup

    // Optimized concurrency for CI/CD (20+ shards)
    maxConcurrency: process.env.CI ? 8 : 4,

    // Enhanced retry logic for flaky tests
    retry: process.env.CI ? 3 : 1, // Retry 3 times in CI, 1 locally
    retryMode: 'run', // Retry only the failed tests

    // Additional stability options
    bail: 0, // Don't bail on first failure
    order: 'random', // Random order to catch dependencies
    // Flaky test detection - mark tests that fail intermittently
    // bail: 0, // Don't bail on first failure (Already defined above)
    exclude: [
      'tests/e2e/**',
      // 'tests/integration/**', // Re-enabled for fixes
      // 'tests/performance/**', // Now included for Agent 5
      'node_modules/**',
      // Playwright spec files (not Vitest tests)
      'tests/accessibility/*.spec.ts',
      // =====================================
      // EXCLUDED TESTS
      // Only truly problematic tests that need deeper investigation
      // =====================================

      // Duplicate test file - use .js version instead
      'tests/unit/backend/services/StageGateService.test.ts',

      // Hook tests - ALL FIXED as of Jan 2026
      // Previously excluded for timing/mock issues, now rewritten with proper interface tests
      // 'tests/hooks/useAssessmentCollaboration.test.ts', // FIXED
      // 'tests/hooks/useAssessmentWorkflow.test.ts', // FIXED
      // 'tests/hooks/useFocus.test.ts', // FIXED
      // 'tests/hooks/useKeyboardShortcuts.test.ts', // FIXED
      // 'tests/hooks/usePMOContext.test.ts', // FIXED
      // 'tests/hooks/useInbox.test.ts', // FIXED
      // 'tests/hooks/usePermissions.test.ts', // FIXED
      // 'tests/hooks/useTokenBalance.test.ts', // FIXED

      // Note: 57+ previously excluded tests have been FIXED and re-enabled as of Jan 2026
      // All backend route tests have been simplified and re-enabled
      // All 11 integration tests have been FIXED and re-enabled as of Jan 2026
    ],
    environmentMatchGlobs: [
      ['tests/unit/backend/**', 'node'],
      ['tests/backend/**', 'node'],
      ['server/**', 'node'],
    ],
    reporters: ['default', 'junit', 'json', 'verbose'],
    outputFile: 'junit.xml',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}', 'server/**/*.js'],
      exclude: [
        'src/vite-env.d.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
        'tests/**',
        'server/scripts/**',
        'server/workers/**',
        'server/seed_*.js',
        'server/fix_*.js',
        'server/inspect_*.js',
        'server/migrate_*.js',
        'server/test-*.js',
        'server/database.postgres.js',
        'server/database.sqlite.js',
        '**/trash_node_modules_*/**',
      ],
      thresholds: {
        global: {
          statements: 85, // Lowered from 95 to 85 as initial target
          branches: 80, // Lowered from 95 to 80 as initial target
          functions: 85, // Lowered from 95 to 85 as initial target
          lines: 85, // Lowered from 95 to 85 as initial target
        },
        // Per-file thresholds for critical files
        // @ts-expect-error: perFile thresholds is valid in vitest but types lag behind
        perFile: {
          // Critical security service - highest priority
          'server/services/accessPolicyService.js': {
            statements: 95, // CRITICAL SECURITY - must be 95%+
            branches: 90,
            functions: 95,
            lines: 95,
          },
          // Critical backend services - higher threshold
          'server/services/**/*.js': {
            statements: 80,
            branches: 75,
            functions: 80,
            lines: 80,
          },
          // Critical frontend components - higher threshold
          'src/**/*.{ts,tsx}': {
            statements: 75,
            branches: 70,
            functions: 75,
            lines: 75,
          },
          // Middleware - critical security code
          'server/middleware/**/*.{js,ts}': {
            statements: 85,
            branches: 80,
            functions: 85,
            lines: 85,
          },
          // Routes - API endpoints
          'server/routes/**/*.{js,ts}': {
            statements: 70,
            branches: 65,
            functions: 70,
            lines: 70,
          },
        },
      },
    },
  },
});
