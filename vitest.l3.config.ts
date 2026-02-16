import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

/**
 * L3 (Integration/API) coverage config.
 *
 * Scope is intentionally focused on security admin endpoints that hit the real DB.
 */
const base = baseConfig as any;

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    environment: 'node',
    include: [
      'tests/integration/routes/security-roles-policies.test.js',
      'tests/integration/routes/notification-settings.l3.test.ts',
      'tests/integration/routes/login-history.l3.test.ts',
      'tests/integration/routes/health.l3.test.ts',
      'tests/integration/routes/health-faults.l3.test.ts',
    ],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    env: {
      ...(base.test?.env || {}),
      TEST_TYPE: 'integration',
      MOCK_DB: 'false',
    },
    coverage: {
      ...(base.test?.coverage || {}),
      reportsDirectory: 'test-results/coverage/l3',
      include: [
        'server/src/routes/securityPolicies.routes.ts',
        'server/src/routes/security/roles.routes.ts',
        'server/src/routes/notifications/notificationSettings.routes.ts',
        'server/src/routes/loginHistory.routes.ts',
        'server/src/routes/healthRoutes.ts',
        'server/src/routes/health.routes.ts',
      ],
      thresholds: {
        global: {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95,
        },
        perFile: {
          'server/src/routes/securityPolicies.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/security/roles.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/notifications/notificationSettings.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/loginHistory.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/healthRoutes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/health.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
        },
      },
    },
  },
});
