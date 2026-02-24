/**
 * Startup Configuration Checks
 *
 * Validates critical configuration before server starts.
 * Prevents cryptic runtime errors by failing fast with clear messages.
 */

import logger from './Logger.js';

interface CheckResult {
  passed: boolean;
  message: string;
  critical: boolean;
}

/**
 * Check database configuration (PostgreSQL only)
 */
function checkDatabaseFile(): CheckResult {
  const databaseUrl = process.env.DATABASE_URL;
  const hasDbHost = process.env.DB_HOST;

  if (!databaseUrl && !hasDbHost) {
    return {
      passed: false,
      message: 'DATABASE_URL or DB_HOST required for PostgreSQL',
      critical: true,
    };
  }

  return {
    passed: true,
    message: 'PostgreSQL configured (DATABASE_URL or DB_* vars)',
    critical: false,
  };
}

/**
 * Check required environment variables
 */
function checkRequiredEnvVars(): CheckResult {
  const required = ['JWT_SECRET'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    return {
      passed: false,
      message: `Missing required environment variables: ${missing.join(', ')}`,
      critical: true,
    };
  }

  // Check JWT_SECRET is not default
  if (process.env.JWT_SECRET === 'supersecretkey_change_this_in_production') {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
      passed: !isProduction,
      message: isProduction
        ? 'CRITICAL: Using default JWT_SECRET in production!'
        : 'WARNING: Using default JWT_SECRET (OK for development)',
      critical: isProduction,
    };
  }

  return { passed: true, message: 'Required environment variables OK', critical: false };
}

/**
 * Check Redis configuration
 */
function checkRedisConfig(): CheckResult {
  const mockRedis = process.env.MOCK_REDIS === 'true';
  const redisUrl = process.env.REDIS_URL;

  if (mockRedis) {
    return { passed: true, message: 'Redis: Using mock client (MOCK_REDIS=true)', critical: false };
  }

  if (!redisUrl || redisUrl === 'redis://localhost:6379') {
    return {
      passed: true,
      message: 'Redis: Using default localhost connection (may timeout if Redis not running)',
      critical: false,
    };
  }

  if (redisUrl.includes('${{')) {
    return {
      passed: false,
      message: 'Redis URL contains unexpanded variables - will fallback to mock client',
      critical: false,
    };
  }

  return { passed: true, message: 'Redis configuration OK', critical: false };
}

/**
 * Check port availability
 */
function checkPort(): CheckResult {
  const port = parseInt(process.env.PORT || '3001', 10);

  if (isNaN(port) || port < 1 || port > 65535) {
    return {
      passed: false,
      message: `Invalid port: ${process.env.PORT}`,
      critical: true,
    };
  }

  return { passed: true, message: `Server will listen on port ${port}`, critical: false };
}

/**
 * Run all startup checks
 */
export async function runStartupChecks(): Promise<void> {
  logger.info('╔══════════════════════════════════════════════════════════════╗');
  logger.info('║                    STARTUP CONFIGURATION CHECK               ║');
  logger.info('╠══════════════════════════════════════════════════════════════╣');

  const checks: { name: string; check: () => CheckResult }[] = [
    { name: 'Environment Variables', check: checkRequiredEnvVars },
    { name: 'Database File', check: checkDatabaseFile },
    { name: 'Redis Configuration', check: checkRedisConfig },
    { name: 'Port Configuration', check: checkPort },
  ];

  let hasErrors = false;
  let hasCriticalErrors = false;

  for (const { name, check } of checks) {
    const result = check();
    const status = result.passed ? '✓' : result.critical ? '✗' : '⚠';
    const level = result.passed ? 'info' : result.critical ? 'error' : 'warn';

    logger[level](`║ ${status} ${name}: ${result.message}`);

    if (!result.passed) {
      hasErrors = true;
      if (result.critical) {
        hasCriticalErrors = true;
      }
    }
  }

  logger.info('╠══════════════════════════════════════════════════════════════╣');

  if (hasCriticalErrors) {
    logger.error('║ ❌ CRITICAL ERRORS FOUND - Server may not function correctly ║');
    logger.info('╚══════════════════════════════════════════════════════════════╝');

    // In production, exit on critical errors
    if (process.env.NODE_ENV === 'production') {
      logger.error('Exiting due to critical configuration errors in production');
      process.exit(1);
    }
  } else if (hasErrors) {
    logger.warn('║ ⚠ WARNINGS FOUND - Server will start with potential issues  ║');
    logger.info('╚══════════════════════════════════════════════════════════════╝');
  } else {
    logger.info('║ ✅ ALL CHECKS PASSED - Configuration looks good!             ║');
    logger.info('╚══════════════════════════════════════════════════════════════╝');
  }
}

export default runStartupChecks;
