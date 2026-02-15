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
    include: ['tests/integration/routes/security-roles-policies.test.js'],
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
      ],
      thresholds: {
        global: {
          statements: 95,
          branches: 80,
          functions: 95,
          lines: 95,
        },
        // @ts-expect-error: perFile thresholds is valid in vitest but types lag behind
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
        },
      },
    },
  },
});
