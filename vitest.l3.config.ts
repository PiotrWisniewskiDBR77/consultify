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
      'tests/integration/routes/security.l3.test.ts',
      'tests/integration/routes/security-roles.l3.test.ts',
      'tests/integration/routes/security-fallbacks.l3.test.ts',
      'tests/integration/routes/notification-settings.l3.test.ts',
      'tests/integration/routes/login-history.l3.test.ts',
      'tests/integration/routes/verify.l3.test.ts',
      'tests/integration/routes/mcp.l3.test.ts',
      'tests/integration/routes/audit.l3.test.ts',
      'tests/integration/routes/audit-log.l3.test.ts',
      'tests/integration/routes/system-health.l3.test.ts',
      'tests/integration/routes/db-metrics.l3.test.ts',
      'tests/integration/routes/status.l3.test.ts',
      'tests/integration/routes/status-reports.l3.test.ts',
      'tests/integration/routes/stabilization.l3.test.ts',
      'tests/integration/routes/api-keys.l3.test.ts',
      'tests/integration/routes/health.l3.test.ts',
      'tests/integration/routes/health-faults.l3.test.ts',
      'tests/integration/routes/health-controller.l3.test.ts',
      'tests/integration/routes/health-controller-faults.l3.test.ts',
      'tests/integration/routes/billing.routes.l3.test.ts',
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
        'server/src/routes/security.routes.ts',
        'server/src/routes/security/roles.routes.ts',
        'server/src/routes/notifications/notificationSettings.routes.ts',
        'server/src/routes/loginHistory.routes.ts',
        'server/src/routes/verify.routes.ts',
        'server/src/routes/mcp.routes.ts',
        'server/src/routes/audit.routes.ts',
        'server/src/routes/auditLog.routes.ts',
        'server/src/routes/systemHealth.routes.ts',
        'server/src/routes/db-metrics.routes.ts',
        'server/src/routes/status.routes.ts',
        'server/src/routes/status-reports.routes.ts',
        'server/src/routes/stabilization.routes.ts',
        'server/src/routes/apiKeys.routes.ts',
        'server/src/routes/healthRoutes.ts',
        'server/src/routes/health.routes.ts',
        'server/src/controllers/HealthCheckController.ts',
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
          'server/src/routes/security.routes.ts': {
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
          'server/src/routes/verify.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/mcp.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/audit.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/auditLog.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/systemHealth.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/db-metrics.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/status.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/status-reports.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/stabilization.routes.ts': {
            statements: 95,
            branches: 80,
            functions: 95,
            lines: 95,
          },
          'server/src/routes/apiKeys.routes.ts': {
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
          'server/src/controllers/HealthCheckController.ts': {
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
