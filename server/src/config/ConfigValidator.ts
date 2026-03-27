/**
 * Configuration Validator
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Validates all environment variables with Zod schemas
 * Enforces required variables in production (crashes if missing)
 * Removes all hardcoded defaults for secrets
 */

import { z } from 'zod';

import logger from '../utils/Logger.js';

// ==========================================
// ZOD SCHEMAS
// ==========================================

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Base schema for JWT configuration
 * JWT_SECRET is REQUIRED in production, optional in development
 */
const JWTConfigSchema = z.object({
  JWT_SECRET: isProduction
    ? z.string().min(32, 'JWT_SECRET must be at least 32 characters in production')
    : z.string().min(1).default('supersecretkey_change_this_in_production'),
  JWT_EXPIRES_IN: z.string().default('365d'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('30d'),
  TOKEN_CLEANUP_INTERVAL: z.number().int().positive().default(3600000),
});

/**
 * Server configuration schema
 */
const ServerConfigSchema = z.object({
  PORT: z.number().int().positive().max(65535).default(3005),
  NODE_ENV: z.enum(['development', 'production', 'test', 'staging']).default('development'),
});

/**
 * OAuth configuration schema
 * If any OAuth provider is configured, all its fields become required
 */
const OAuthProviderSchema = z
  .object({
    CLIENT_ID: z.string().optional(),
    CLIENT_SECRET: z.string().optional(),
    CALLBACK_URL: z.string().url().optional(),
  })
  .refine(
    (data) => {
      // If any field is set, all must be set
      const hasAny = data.CLIENT_ID || data.CLIENT_SECRET || data.CALLBACK_URL;
      const hasAll = data.CLIENT_ID && data.CLIENT_SECRET && data.CALLBACK_URL;
      return !hasAny || hasAll;
    },
    {
      message:
        'If any OAuth field is set, all fields (CLIENT_ID, CLIENT_SECRET, CALLBACK_URL) must be set',
    }
  );

const OAuthConfigSchema = z.object({
  GOOGLE: OAuthProviderSchema.optional(),
  LINKEDIN: OAuthProviderSchema.optional(),
  MICROSOFT: OAuthProviderSchema.optional(),
});

/**
 * Database configuration schema
 * In production, database credentials are REQUIRED
 */
const DatabaseConfigSchema = z
  .object({
    DB_TYPE: z.enum(['postgres']).optional(),
    DATABASE_URL: z.string().url().optional(),
    // PostgreSQL individual fields (required if DB_TYPE=postgres in production)
    DB_HOST: z.string().optional(),
    DB_PORT: z.number().int().positive().optional(),
    DB_NAME: z.string().optional(),
    DB_USER: z.string().optional(),
    DB_PASSWORD: z.string().optional(),
    DB_SSL: z.enum(['true', 'false', 'require', 'disable']).optional(),
    DB_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).optional(),
    DB_POOL_SIZE: z.number().int().positive().default(10),
    DB_CONNECTION_TIMEOUT: z.number().int().positive().default(30000),
    DB_STATEMENT_TIMEOUT: z.number().int().positive().default(60000),
  })
  .refine(
    (data) => {
      if (isProduction && data.DB_TYPE === 'postgres') {
        // In production with PostgreSQL, we need either DATABASE_URL or all individual fields
        if (data.DATABASE_URL) return true;
        if (data.DB_HOST && data.DB_NAME && data.DB_USER && data.DB_PASSWORD) return true;
        return false;
      }
      return true;
    },
    {
      message:
        'In production with PostgreSQL, either DATABASE_URL or all DB_* fields (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) must be set',
    }
  );

/**
 * Redis configuration schema
 * Optional - falls back to in-memory if not set
 */
const RedisConfigSchema = z.object({
  REDIS_URL: z.string().url().optional(),
});

/**
 * Frontend configuration schema
 */
const FrontendConfigSchema = z.object({
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

/**
 * Complete application configuration schema
 */
const AppConfigSchema = JWTConfigSchema.merge(ServerConfigSchema)
  .merge(FrontendConfigSchema)
  .merge(RedisConfigSchema)
  .extend({
    // OAuth providers
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_CALLBACK_URL: z.string().url().optional(),
    ASANA_CLIENT_ID: z.string().optional(),
    ASANA_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_CLIENT_ID: z.string().optional(),
    LINKEDIN_CLIENT_SECRET: z.string().optional(),
    LINKEDIN_CALLBACK_URL: z.string().url().optional(),
    MICROSOFT_CLIENT_ID: z.string().optional(),
    MICROSOFT_CLIENT_SECRET: z.string().optional(),
    MICROSOFT_CALLBACK_URL: z.string().url().optional(),
    SLACK_CLIENT_ID: z.string().optional(),
    SLACK_CLIENT_SECRET: z.string().optional(),
  })
  .refine(
    (data) => {
      // Google OAuth validation
      const googleHasAny =
        data.GOOGLE_CLIENT_ID || data.GOOGLE_CLIENT_SECRET || data.GOOGLE_CALLBACK_URL;
      const googleHasAll =
        data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET && data.GOOGLE_CALLBACK_URL;
      if (googleHasAny && !googleHasAll) return false;

      const asanaHasAny = data.ASANA_CLIENT_ID || data.ASANA_CLIENT_SECRET;
      const asanaHasAll = data.ASANA_CLIENT_ID && data.ASANA_CLIENT_SECRET;
      if (asanaHasAny && !asanaHasAll) return false;

      // LinkedIn OAuth validation
      const linkedinHasAny =
        data.LINKEDIN_CLIENT_ID || data.LINKEDIN_CLIENT_SECRET || data.LINKEDIN_CALLBACK_URL;
      const linkedinHasAll =
        data.LINKEDIN_CLIENT_ID && data.LINKEDIN_CLIENT_SECRET && data.LINKEDIN_CALLBACK_URL;
      if (linkedinHasAny && !linkedinHasAll) return false;

      // Microsoft OAuth validation
      const microsoftHasAny =
        data.MICROSOFT_CLIENT_ID || data.MICROSOFT_CLIENT_SECRET || data.MICROSOFT_CALLBACK_URL;
      const microsoftHasAll =
        data.MICROSOFT_CLIENT_ID && data.MICROSOFT_CLIENT_SECRET && data.MICROSOFT_CALLBACK_URL;
      if (microsoftHasAny && !microsoftHasAll) return false;

      const slackHasAny = data.SLACK_CLIENT_ID || data.SLACK_CLIENT_SECRET;
      const slackHasAll = data.SLACK_CLIENT_ID && data.SLACK_CLIENT_SECRET;
      if (slackHasAny && !slackHasAll) return false;

      return true;
    },
    {
      message: 'If any OAuth provider field is set, all fields for that provider must be set',
    }
  );

export type ValidatedConfig = z.infer<typeof AppConfigSchema>;

// ==========================================
// VALIDATION FUNCTIONS
// ==========================================

/**
 * Parse and validate environment variables
 * Throws error in production if required variables are missing
 */
export function validateConfig(): ValidatedConfig {
  const rawConfig = {
    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    REFRESH_TOKEN_EXPIRES_IN: process.env.REFRESH_TOKEN_EXPIRES_IN,
    TOKEN_CLEANUP_INTERVAL: process.env.TOKEN_CLEANUP_INTERVAL
      ? parseInt(process.env.TOKEN_CLEANUP_INTERVAL, 10)
      : undefined,

    // Server
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
    NODE_ENV: process.env.NODE_ENV,

    // OAuth
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    ASANA_CLIENT_ID: process.env.ASANA_CLIENT_ID,
    ASANA_CLIENT_SECRET: process.env.ASANA_CLIENT_SECRET,
    LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
    LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
    LINKEDIN_CALLBACK_URL: process.env.LINKEDIN_CALLBACK_URL,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    MICROSOFT_CALLBACK_URL: process.env.MICROSOFT_CALLBACK_URL,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET,

    // Frontend
    FRONTEND_URL: process.env.FRONTEND_URL,

    // Redis
    REDIS_URL: process.env.REDIS_URL,
  };

  // Validate configuration
  const result = AppConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.issues.map((issue) => {
      const path = issue.path.join('.');
      return `  - ${path}: ${issue.message}`;
    });

    logger.error('\n\x1b[31m%s\x1b[0m', 'Configuration validation failed:');
    errors.forEach((err: string) => logger.error(err));

    // In production, fail fast
    if (isProduction) {
      logger.error(
        '\n\x1b[31m%s\x1b[0m',
        'FATAL ERROR: Invalid configuration. Application cannot start in production with invalid configuration.'
      );
      logger.error('Please check your environment variables and fix the errors above.\n');
      process.exit(1);
    }

    // In development, warn but continue with defaults
    logger.warn(
      '\n\x1b[33m%s\x1b[0m',
      'WARNING: Using default values for invalid configuration. Fix errors before deploying to production.\n'
    );

    // Try to parse with defaults
    const defaultResult = AppConfigSchema.parse({
      ...rawConfig,
      JWT_SECRET: rawConfig.JWT_SECRET || 'supersecretkey_change_this_in_production',
    });
    return defaultResult;
  }

  // Additional production checks
  if (isProduction) {
    if (!result.data.JWT_SECRET || result.data.JWT_SECRET.length < 32) {
      logger.error(
        '\n\x1b[31m%s\x1b[0m',
        'FATAL ERROR: JWT_SECRET must be at least 32 characters in production.'
      );
      logger.error('Please set a secure JWT_SECRET environment variable.\n');
      process.exit(1);
    }

    if (result.data.JWT_SECRET === 'supersecretkey_change_this_in_production') {
      logger.error(
        '\n\x1b[31m%s\x1b[0m',
        'FATAL ERROR: JWT_SECRET cannot use default value in production.'
      );
      logger.error('Please set a secure JWT_SECRET environment variable.\n');
      process.exit(1);
    }
  }

  return result.data;
}

/**
 * Validate database configuration separately
 * This is called by DatabaseConfig.ts
 */
export function validateDatabaseConfig(): void {
  const dbType = process.env.DB_TYPE;
  const databaseUrl = process.env.DATABASE_URL;
  const hasDbHost = !!process.env.DB_HOST;
  const hasDbName = !!process.env.DB_NAME;
  const hasDbUser = !!process.env.DB_USER;
  const hasDbPassword = !!process.env.DB_PASSWORD;

  if (isProduction && dbType === 'postgres') {
    if (!databaseUrl && (!hasDbHost || !hasDbName || !hasDbUser || !hasDbPassword)) {
      logger.error(
        '\n\x1b[31m%s\x1b[0m',
        'FATAL ERROR: PostgreSQL configuration incomplete in production.'
      );
      logger.error(
        'Either DATABASE_URL or all DB_* fields (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) must be set.\n'
      );
      process.exit(1);
    }
  }
}

// ==========================================
// EXPORTS
// ==========================================

export default validateConfig;
