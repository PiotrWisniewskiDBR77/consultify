#!/usr/bin/env npx tsx
/**
 * Security Integrity Verification Script (P0 Gate)
 *
 * Detects security "shams" — no-op middlewares, static tokens, mock routes,
 * and other patterns that indicate fake security controls.
 *
 * Exit code 0 = all checks pass
 * Exit code 1 = at least one check failed (blocks CI/pre-commit)
 *
 * Usage:
 *   npx tsx scripts/security/verify-security-integrity.ts
 */

import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const errors: string[] = [];
const warnings: string[] = [];

// ============================================================
// HELPER
// ============================================================

function readFile(relPath: string): string | null {
  const fullPath = path.join(projectRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    warnings.push(`File not found: ${relPath}`);
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function checkFileDoesNotContain(
  relPath: string,
  patterns: { pattern: string | RegExp; message: string }[]
): void {
  const content = readFile(relPath);
  if (!content) return;

  for (const { pattern, message } of patterns) {
    const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
    if (found) {
      errors.push(`[${relPath}] ${message}`);
    }
  }
}

function checkFileContains(
  relPath: string,
  patterns: { pattern: string | RegExp; message: string }[]
): void {
  const content = readFile(relPath);
  if (!content) return;

  for (const { pattern, message } of patterns) {
    const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
    if (!found) {
      errors.push(`[${relPath}] ${message}`);
    }
  }
}

// ============================================================
// CHECKS
// ============================================================

console.log('🔒 Security Integrity Verification\n');

// 1. CSRF middleware must NOT be a no-op
console.log('  Checking CSRF middleware...');
checkFileDoesNotContain('server/src/middleware/csrf.middleware.ts', [
  {
    pattern: "'test-csrf-token'",
    message: 'Static CSRF token "test-csrf-token" found — CSRF is a sham',
  },
  {
    pattern: /csrfTokenMiddleware.*=.*\(_req.*_res.*next.*\).*\{[\s\n]*next\(\)/,
    message: 'CSRF middleware is a no-op (just calls next())',
  },
]);
checkFileContains('server/src/middleware/csrf.middleware.ts', [
  {
    pattern: 'crypto',
    message: 'CSRF middleware does not use crypto — tokens may not be secure',
  },
  {
    pattern: 'csrfValidationMiddleware',
    message: 'CSRF validation middleware export not found',
  },
]);

// 2. Input sanitization must NOT be a no-op
console.log('  Checking input sanitization middleware...');
checkFileDoesNotContain('server/src/middleware/inputSanitization.middleware.ts', [
  {
    pattern: /inputSanitizationMiddleware.*=.*\(\s*_req.*_res.*next.*\).*\{[\s\n]*next\(\)/,
    message: 'Input sanitization is a no-op (just calls next())',
  },
  {
    pattern: 'no-op fallback',
    message: 'Input sanitization still has "no-op fallback" comment',
  },
]);
checkFileContains('server/src/middleware/inputSanitization.middleware.ts', [
  {
    pattern: 'sanitizeObject',
    message: 'Input sanitization does not use sanitizeObject — not actually sanitizing',
  },
]);

// 3. Auth middleware must have production guards
console.log('  Checking auth middleware env guards...');
checkFileContains('server/src/middleware/auth.middleware.ts', [
  {
    pattern: 'isProductionEnv',
    message: 'Missing production environment guard variable',
  },
  {
    pattern: 'req.cookies',
    message: 'Auth middleware does not check cookies — cookie auth not implemented',
  },
]);

// 4. Security routes must NOT be mocks
console.log('  Checking security routes...');
checkFileDoesNotContain('server/src/routes/security.routes.ts', [
  {
    pattern: 'Security Routes (Mock)',
    message: 'Security routes still marked as "(Mock)"',
  },
  {
    pattern: /const\s+roles\s*:\s*any\[\]\s*=\s*\[\]/,
    message: 'Roles stored in-memory array instead of DB',
  },
]);
checkFileDoesNotContain('server/src/routes/securityPolicies.routes.ts', [
  {
    pattern: 'Security Policies Routes (Mock)',
    message: 'Security policies routes still marked as "(Mock)"',
  },
]);
// Verify it uses DB queries (not just in-memory data)
checkFileContains('server/src/routes/securityPolicies.routes.ts', [
  {
    pattern: 'dbGet',
    message: 'Security policies routes do not use dbGet — not DB-backed',
  },
  {
    pattern: 'dbRun',
    message: 'Security policies routes do not use dbRun — not DB-backed',
  },
]);

// 5. CORS must not use wildcard in production config
console.log('  Checking CORS configuration...');
checkFileDoesNotContain('server/src/index.ts', [
  {
    pattern: "isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000', '*']",
    message: 'CORS allows wildcard (*) origin — not safe for cookie auth',
  },
]);

// 6. Frontend must not store tokens in localStorage (check tokenService)
console.log('  Checking frontend token storage...');
const tokenServiceContent = readFile('src/services/tokenService.ts');
if (tokenServiceContent) {
  // Count localStorage.setItem('token' occurrences — should be in migration code only
  const directStorageWrites = (tokenServiceContent.match(/localStorage\.setItem\('token'/g) || [])
    .length;
  // Allow up to 1 occurrence (migration compat), flag if more
  if (directStorageWrites > 1) {
    errors.push(
      `[src/services/tokenService.ts] Multiple localStorage.setItem('token') calls (${directStorageWrites}) — should be migrating away from localStorage`
    );
  }
}

// 7. Login body should not be logged
console.log('  Checking sensitive data logging...');
checkFileDoesNotContain('server/src/index.ts', [
  {
    pattern: 'Login Request Body:',
    message: 'Login request body is being logged — credential leak risk',
  },
  {
    pattern: 'Login Request Headers:',
    message: 'Login request headers are being logged — token leak risk',
  },
]);

// 8. run-audit.ts should not have hardcoded coverage
console.log('  Checking test audit integrity...');
checkFileDoesNotContain('scripts/testing/run-audit.ts', [
  {
    pattern: '~96%',
    message: 'Hardcoded ~96% coverage value found in run-audit.ts',
  },
]);

// 9. E2E bypass in auth.routes.ts refresh must be guarded
console.log('  Checking E2E bypass guards in auth routes...');
checkFileContains('server/src/routes/auth.routes.ts', [
  {
    pattern: "process.env.NODE_ENV !== 'production'",
    message: 'Refresh endpoint E2E bypass is not guarded by production check',
  },
]);

// ============================================================
// RESULTS
// ============================================================

console.log('');

if (warnings.length > 0) {
  console.log(`⚠️  Warnings (${warnings.length}):`);
  for (const w of warnings) {
    console.log(`   - ${w}`);
  }
  console.log('');
}

if (errors.length > 0) {
  console.error(`❌ Security integrity check FAILED (${errors.length} issues):\n`);
  for (const e of errors) {
    console.error(`   ✗ ${e}`);
  }
  console.error('');
  console.error('Fix the above issues before deploying to production.');
  process.exit(1);
} else {
  console.log(`✅ Security integrity check PASSED — all ${9} checks clean.\n`);
  process.exit(0);
}
