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
      'tests/unit/backend/middleware/validation.validateBody.contract.test.ts',
      'tests/unit/backend/middleware/validation.validateQuery.contract.test.ts',
      'tests/unit/backend/middleware/validation.validateParams.contract.test.ts',
      'tests/unit/backend/middleware/admin.middleware.test.ts',
      'tests/unit/backend/middleware/errorHandler.middleware.test.ts',
      'tests/unit/backend/middleware/apiVersion.middleware.test.ts',
      'tests/unit/backend/middleware/rateLimiting.middleware.test.ts',
      'tests/unit/backend/middleware/rbac.middleware.test.ts',
      'tests/unit/backend/middleware/superAdmin.middleware.test.ts',
      'tests/unit/backend/middleware/orgContext.middleware.test.ts',
      'tests/unit/backend/middleware/apiKeyAuth.middleware.test.ts',
      'tests/unit/backend/middleware/securityHeaders.middleware.test.ts',
      'tests/unit/backend/utils/asyncHandler.test.ts',
      'tests/unit/backend/middleware/auth.middleware.test.ts',
      'tests/unit/backend/middleware/permissionMiddleware.test.ts',
      'tests/unit/server/utils/piiRedactor.test.ts',
    ],
    exclude: ['node_modules/**', 'tests/e2e/**'],
    coverage: {
      ...(base.test?.coverage || {}),
      reportsDirectory: 'test-results/coverage/l1',
      include: [
        'server/src/middleware/admin.middleware.ts',
        'server/src/middleware/apiVersion.middleware.ts',
        'server/src/middleware/auth.middleware.ts',
        'server/src/middleware/csrf.middleware.ts',
        'server/src/middleware/errorHandler.ts',
        'server/src/middleware/rbac.middleware.ts',
        'server/src/middleware/rateLimiting.middleware.ts',
        'server/src/middleware/superAdmin.middleware.ts',
        'server/src/middleware/orgContext.middleware.ts',
        'server/src/middleware/apiKeyAuth.middleware.ts',
        'server/src/middleware/securityHeaders.middleware.ts',
        'server/src/middleware/permission.middleware.ts',
        'server/src/middleware/inputSanitization.middleware.ts',
        'server/src/middleware/validation.middleware.ts',
        'server/src/services/accessPolicyService.ts',
        'server/src/utils/asyncHandler.ts',
        'server/src/utils/cookieAuth.ts',
        'server/src/utils/piiRedactor.ts',
        'server/src/utils/security.utils.ts',
      ],
    },
  },
});
