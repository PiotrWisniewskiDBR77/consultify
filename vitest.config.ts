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
      // highlight.js has no `exports` map; the inlined tiptap lowlight extension's
      // bare `highlight.js/lib/core` import is unresolvable under Vite's transform
      // without pointing at the concrete .js file (M04 notebook code highlight).
      {
        find: 'highlight.js/lib/core',
        replacement: path.resolve(__dirname, 'node_modules/highlight.js/lib/core.js'),
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
        replacement: path.resolve(__dirname, 'server/src/services/ai/learningSystem.ts'),
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
    // Inline ONLY the tiptap lowlight extension so Vite transforms its bare
    // `highlight.js/lib/core` import (resolved via the alias above). highlight.js
    // and lowlight stay externalized so Node's CJS resolver handles them
    // natively — inlining highlight.js is prohibitively slow (M04 code highlight).
    server: {
      deps: {
        inline: [/@tiptap\/extension-code-block-lowlight/],
      },
    },
    env: {
      DB_TYPE: 'sqlite',
      NODE_ENV: 'test',
      ENABLE_TEST_GATEWAY: 'true', // Mount full Gateway routes for integration tests
      // Pin encryption inputs so EncryptionService's module-singleton keyManager
      // derives a STABLE key regardless of which test loads it first. Without this,
      // test order (e.g. a gateway test temporarily setting an invalid-hex salt)
      // poisons the shared key → cross-file "Invalid encrypted format" pollution.
      ENCRYPTION_KEY: 'test-encryption-key-stable-deterministic-0123456789',
      ENCRYPTION_SALT: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
    },
    setupFiles: './tests/setup.ts',
    include: [
      'src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/components/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // H6.6: these real vitest dirs were never in `include`, so vitest could
      // not collect them regardless of invocation. `tests/component` (singular,
      // distinct from `tests/components`), plus contexts/frontend/navigation/views.
      // NOTE: `tests/visual` + `tests/visual-regression` are Playwright specs
      // (import @playwright/test) — deliberately NOT added here.
      'tests/component/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/contexts/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/frontend/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/navigation/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/views/**/*.{test,spec}.{js,ts,jsx,tsx}',
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
      // results-vnext (KPI-E001/E002 and future ROI/OKR/deviation packages)
      // unit tests — pure functions + mocked-PoolClient command tests, no
      // real DB needed. Without this glob these tests are uncollectable by
      // `npm run test:unit`/CI regardless of `git add -f`ing the files.
      'tests/resultsVnext/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Table Platform service tests
      'server/src/services/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}',
      // V8 integration tests (nested under __tests__/integration/)
      'server/src/services/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Server route tests that are safe to run from the root workspace config
      'server/src/routes/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}',
      'server/src/routes/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // Remaining colocated server tests (config/middleware/controllers/database/...).
      // Without this glob `npx vitest run server/src` matches nothing because an
      // explicit path positional is intersected with `include`, so these tests
      // (e.g. OrganizationController.membership, inputSanitization.middleware) never
      // ran in CI. The `_backup` tree is excluded below.
      'server/src/**/__tests__/*.{test,spec}.{js,ts,jsx,tsx}',
      'server/src/**/__tests__/**/*.{test,spec}.{js,ts,jsx,tsx}',
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
      // Backup tree (ts/js collision snapshots) — never run as live tests
      'server/src/_backup/**',
      // Playwright spec files (not Vitest tests)
      'tests/accessibility/*.spec.ts',
      // H6.6: Playwright-based visual tests (import @playwright/test) — must never
      // be collected by vitest even if a path positional matches their dir.
      'tests/visual/**',
      'tests/visual-regression/**',
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
      ['tests/security/**', 'node'],
      ['server/**', 'node'],
    ],
    reporters: ['default', 'junit', 'json', 'verbose'],
    outputFile: 'junit.xml',
    coverage: {
      provider: 'v8',
      all: false,
      reporter: ['text', 'json', 'json-summary', 'html', 'lcov'],
      include: [
        // Backend coverage
        'server/src/controllers/**/*.{ts,js}',
        'server/src/middleware/**/*.{ts,js}',
        'server/src/routes/**/*.{ts,js}',
        'server/src/services/*.{ts,js}',
        // Frontend coverage (initial target: 50%+ — will increase over time)
        'src/**/*.{ts,tsx}',
      ],
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
        'server/dist/**',
        '**/dist/**',
        '**/build/**',
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
          // Critical middleware (security boundary) — must be 95%+
          'server/src/middleware/auth.middleware.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/middleware/csrf.middleware.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/middleware/permission.middleware.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/middleware/inputSanitization.middleware.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          // Critical security service - highest priority
          'server/src/services/accessPolicyService.ts': {
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
          'server/src/middleware/**/*.{js,ts}': {
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
