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

// 10. Helmet + CSP must be configured (security headers hardening)
console.log('  Checking Helmet + CSP security headers...');
checkFileContains('server/src/index.ts', [
  { pattern: 'helmet({', message: 'Helmet middleware not configured' },
  { pattern: 'contentSecurityPolicy: isProduction', message: 'CSP does not appear production-gated' },
  { pattern: 'directives:', message: 'CSP directives missing' },
  { pattern: "defaultSrc: [\"'self'\"]", message: 'CSP defaultSrc self missing' },
  { pattern: "objectSrc: [\"'none'\"]", message: 'CSP objectSrc none missing' },
  { pattern: "frameAncestors: [\"'none'\"]", message: 'CSP frameAncestors none missing' },
]);

// 11. Additional Helmet hardening flags should remain enabled
console.log('  Checking additional Helmet hardening flags...');
checkFileContains('server/src/index.ts', [
  { pattern: 'noSniff: true', message: 'Helmet noSniff should be enabled' },
  { pattern: "action: 'deny'", message: 'Helmet frameguard should deny framing' },
  { pattern: "policy: 'strict-origin-when-cross-origin'", message: 'Referrer-Policy should be strict' },
]);

// 12. HSTS should be enabled in helmet config
console.log('  Checking HSTS hardening...');
checkFileContains('server/src/index.ts', [
  { pattern: 'hsts:', message: 'HSTS not configured via helmet' },
  { pattern: 'maxAge: 31536000', message: 'HSTS maxAge should be 1 year (31536000)' },
  { pattern: 'includeSubDomains: true', message: 'HSTS includeSubDomains should be true' },
  { pattern: 'preload: true', message: 'HSTS preload should be true' },
]);

// 13. Reverse-proxy awareness (req.ip / secure cookies)
console.log('  Checking proxy awareness (trust proxy)...');
checkFileContains('server/src/index.ts', [
  { pattern: "app.set('trust proxy', 1);", message: 'Express trust proxy not set' },
]);

// 14. Rate limiting must be real (Redis store + stable keying)
console.log('  Checking rate limiting store + keying...');
checkFileContains('server/src/index.ts', [
  { pattern: 'new RedisRateLimitStore', message: 'Rate limiting does not use Redis store' },
  { pattern: 'store: redisStore', message: 'apiLimiter missing redisStore binding' },
  { pattern: 'store: authRedisStore', message: 'authLimiter missing authRedisStore binding' },
  { pattern: 'ipKeyGenerator', message: 'Rate limiting keyGenerator should use ipKeyGenerator' },
  { pattern: '_rateLimitUserId', message: 'apiLimiter should key by userId when available' },
]);

// 15. Login limiter should skip successful requests (reduces lockout abuse)
console.log('  Checking auth limiter anti-bruteforce settings...');
checkFileContains('server/src/index.ts', [
  { pattern: 'skipSuccessfulRequests: true', message: 'authLimiter should skipSuccessfulRequests' },
]);

// 16. Production CORS must be explicit (FRONTEND_URL) or disabled (false)
console.log('  Checking production CORS origin safety...');
checkFileContains('server/src/index.ts', [
  { pattern: 'process.env.FRONTEND_URL', message: 'CORS origin should support explicit FRONTEND_URL' },
  { pattern: 'isProduction ? false', message: 'CORS should default to false in production when FRONTEND_URL is not set' },
]);

// 17. Cookie parser + CSRF wiring should exist
console.log('  Checking cookie parser + CSRF wiring...');
checkFileContains('server/src/index.ts', [
  { pattern: 'cookieParser()', message: 'cookie-parser not enabled' },
  { pattern: "app.get('/api/csrf-token'", message: 'CSRF token endpoint not registered' },
  { pattern: 'csrfTokenMiddleware', message: 'csrfTokenMiddleware not wired' },
  { pattern: 'if (isProduction)', message: 'CSRF middleware should be prod-gated with if (isProduction)' },
]);

// 18. Global input sanitization should be applied
console.log('  Checking global input sanitization wiring...');
checkFileContains('server/src/index.ts', [
  { pattern: 'app.use(inputSanitizationMiddleware)', message: 'Global inputSanitizationMiddleware not applied' },
]);

// 19. Auth middleware must actually verify JWT with a secret
console.log('  Checking JWT verification path in auth middleware...');
checkFileContains('server/src/middleware/auth.middleware.ts', [
  { pattern: /verify\(token,\s*jwtSecret/, message: 'Auth middleware does not verify token with jwtSecret' },
  { pattern: 'JWT_SECRET', message: 'Auth middleware does not reference JWT_SECRET' },
]);

// 20. Audit logging must not be a no-op (must hook res.end and gate on 2xx)
console.log('  Checking audit logging middleware...');
checkFileContains('server/src/middleware/auditLog.middleware.ts', [
  { pattern: 'res.end', message: 'Audit middleware does not hook res.end' },
  { pattern: 'res.statusCode', message: 'Audit middleware does not inspect res.statusCode' },
  { pattern: 'ActivityService', message: 'Audit middleware does not reference ActivityService' },
]);

// 21. Optional user-based rate-limit keying should verify token
console.log('  Checking rateLimitUserId middleware integrity...');
checkFileContains('server/src/middleware/rateLimitUserId.middleware.ts', [
  { pattern: 'jwt.verify', message: 'rateLimitUserIdMiddleware does not verify JWT' },
  { pattern: 'req._rateLimitUserId', message: 'rateLimitUserIdMiddleware does not set req._rateLimitUserId' },
]);

// 22. Cookie auth helpers must enforce secure defaults
console.log('  Checking cookie auth flags (httpOnly/secure/sameSite)...');
checkFileContains('server/src/utils/cookieAuth.ts', [
  { pattern: 'httpOnly: true', message: 'Auth cookies should be httpOnly' },
  { pattern: 'secure: isProduction', message: 'Auth cookies should be secure in production' },
  { pattern: "sameSite: 'lax'", message: "Auth cookies should set sameSite explicitly ('lax')" },
]);

// 23. Startup checks should detect default JWT secret in production
console.log('  Checking JWT secret production safeguards (startup checks)...');
checkFileContains('server/src/utils/startupChecks.ts', [
  { pattern: 'JWT_SECRET', message: 'startupChecks does not validate JWT_SECRET presence' },
  { pattern: 'supersecretkey_change_this_in_production', message: 'startupChecks does not detect default JWT secret' },
  { pattern: 'CRITICAL: Using default JWT_SECRET in production!', message: 'startupChecks missing critical JWT secret warning' },
]);

// 24. Config validator should fail fast for weak/default JWT secret in production
console.log('  Checking JWT secret production safeguards (config validator)...');
checkFileContains('server/src/config/ConfigValidator.ts', [
  { pattern: 'JWT_SECRET.length < 32', message: 'ConfigValidator missing JWT_SECRET min-length enforcement' },
  { pattern: 'supersecretkey_change_this_in_production', message: 'ConfigValidator missing default JWT secret detection' },
  { pattern: 'process.exit(1)', message: 'ConfigValidator must process.exit(1) on invalid production config' },
]);

// 25. Encryption should use AEAD (AES-256-GCM) and modern crypto APIs
console.log('  Checking encryption service algorithm + primitives...');
checkFileContains('server/src/services/encryption/EncryptionService.ts', [
  { pattern: "const ALGORITHM = 'aes-256-gcm'", message: 'EncryptionService must use AES-256-GCM' },
  { pattern: 'crypto.pbkdf2Sync', message: 'EncryptionService missing PBKDF2 key derivation' },
  { pattern: 'PBKDF2_ITERATIONS = 100000', message: 'PBKDF2_ITERATIONS should be 100000' },
  { pattern: 'crypto.createCipheriv', message: 'EncryptionService should use createCipheriv' },
  { pattern: 'crypto.createDecipheriv', message: 'EncryptionService should use createDecipheriv' },
  { pattern: 'crypto.randomBytes', message: 'EncryptionService should use randomBytes for IV' },
]);
checkFileDoesNotContain('server/src/services/encryption/EncryptionService.ts', [
  { pattern: 'aes-256-ecb', message: 'Insecure ECB mode detected' },
  { pattern: /crypto\.createCipher\(/, message: 'Deprecated crypto.createCipher API detected' },
  { pattern: /crypto\.createDecipher\(/, message: 'Deprecated crypto.createDecipher API detected' },
]);

// 26. Stripe webhooks should use raw body parser for signature verification
console.log('  Checking Stripe webhook raw-body guard...');
checkFileContains('server/src/index.ts', [
  { pattern: "express.raw({ type: 'application/json' })", message: 'Stripe raw parser not configured' },
  { pattern: '/api/webhooks/stripe', message: 'Stripe webhook path not guarded for raw parsing' },
]);

// 27. Report import uploads should be memory-based and strictly filtered by type/size
console.log('  Checking report import upload hardening...');
checkFileContains('server/src/routes/report-import.routes.ts', [
  { pattern: 'multer.memoryStorage()', message: 'Report import upload must use memoryStorage' },
  { pattern: 'fileSize: 50 * 1024 * 1024', message: 'Report import file size limit (50MB) missing' },
  { pattern: 'allowedMimes', message: 'Report import fileFilter missing allowlist' },
  { pattern: 'application/pdf', message: 'Report import allowedMimes missing application/pdf' },
  { pattern: 'Unsupported file type', message: 'Report import should reject unsupported file types' },
]);

// 28. Avatar uploads should enforce size/type and avoid using original filenames directly
console.log('  Checking avatar upload hardening...');
checkFileContains('server/src/routes/users.routes.ts', [
  { pattern: 'multer.diskStorage', message: 'Avatar uploads must use diskStorage' },
  { pattern: 'uuidv4()', message: 'Avatar filename should be UUID-based' },
  { pattern: 'fileSize: 5 * 1024 * 1024', message: 'Avatar file size limit (5MB) missing' },
  { pattern: 'allowedTypes', message: 'Avatar upload fileFilter missing allowlist' },
  { pattern: 'image/jpeg', message: 'Avatar upload allowlist missing image/jpeg' },
  { pattern: 'image/png', message: 'Avatar upload allowlist missing image/png' },
]);
checkFileDoesNotContain('server/src/routes/users.routes.ts', [
  { pattern: 'cb(null, file.originalname)', message: 'Avatar upload uses originalname for filename (risk)' },
]);

// 29. CSRF token store should enforce expiry and cleanup
console.log('  Checking CSRF token store hygiene...');
checkFileContains('server/src/utils/security.utils.ts', [
  { pattern: 'expiresAt', message: 'CSRF token store entries should include expiresAt' },
  { pattern: 'cleanup', message: 'CSRF token store should have cleanup routine' },
  { pattern: 'csrfTokenStore.delete', message: 'CSRF token store should delete consumed/expired tokens' },
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
  console.log(`✅ Security integrity check PASSED — all ${29} checks clean.\n`);
  process.exit(0);
}
