import { defineConfig } from 'vitest/config';

import baseConfig from './vitest.config';

/**
 * L1 (Unit/Critical backend) coverage config.
 *
 * Scope: security boundary middleware + access policy enforcement.
 * Tests are the same as `test:unit:critical`, but coverage is narrowed to meaningful files
 * so we can reliably target 95%+ line coverage.
 */
const base = baseConfig as any;

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    environment: 'node',
    include: [
      'tests/unit/backend/permissionService.test.ts',
      'tests/unit/backend/tokenBillingService.test.ts',
      'tests/unit/backend/accessPolicyService.test.js',
      'tests/unit/backend/security/authMiddleware.test.ts',
      'tests/unit/backend/security/cookieAuth.test.ts',
      'tests/unit/backend/security/csrfMiddleware.test.ts',
      'tests/unit/backend/security/inputSanitization.test.ts',
      'tests/unit/backend/security/inputSanitizationMiddleware.test.ts',
      'tests/unit/backend/middleware/auth.middleware.test.ts',
      'tests/unit/backend/middleware/permissionMiddleware.test.ts',
      'tests/unit/backend/middleware/rateLimitUserId.middleware.test.ts',
      'tests/unit/backend/middleware/resourceQuota.middleware.test.ts',
      'tests/unit/server/utils/piiRedactor.test.ts',
    ],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    coverage: {
      ...(base.test?.coverage || {}),
      reportsDirectory: 'test-results/coverage/l1',
      include: [
        'server/src/middleware/auth.middleware.ts',
        'server/src/middleware/csrf.middleware.ts',
        'server/src/middleware/permission.middleware.ts',
        'server/src/middleware/inputSanitization.middleware.ts',
        'server/src/middleware/rateLimitUserId.middleware.ts',
        'server/src/middleware/resourceQuota.middleware.ts',
        'server/src/services/accessPolicyService.ts',
        'server/src/utils/security.utils.ts',
        'server/src/utils/cookieAuth.ts',
        'server/src/utils/piiRedactor.ts',
      ],
    },
  },
});
