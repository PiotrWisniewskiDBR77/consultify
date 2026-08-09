/**
 * Database Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * PostgreSQL only. SQLite has been fully removed.
 * Configure via DATABASE_URL or DB_* environment variables.
 */

import './loadEnv.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

import logger from '../utils/Logger.js';
import {
  assertNoLocalDatabaseOutsideTests,
  assertNoPrivateRailwayDbHostOutsideRailway,
  assertNoProductionDatabaseOutsideVerifiedRuntime,
  resolveReachableDatabaseUrl,
} from './databaseTargetResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// ZOD SCHEMAS
// ==========================================

const SSLConfigSchema = z.union([
  z.boolean(),
  z.object({
    rejectUnauthorized: z.boolean().optional(),
  }),
]);

const PostgresConfigSchema = z.object({
  host: z.string(),
  port: z.number().int().positive(),
  database: z.string(),
  user: z.string(),
  password: z.string(),
  ssl: SSLConfigSchema,
  max: z.number().int().positive().default(10),
  idleTimeoutMillis: z.number().int().positive().default(30000),
  connectionTimeoutMillis: z.number().int().positive().min(10000).default(30000),
  statement_timeout: z.number().int().positive().default(60000),
});

const ReadReplicaConfigSchema = PostgresConfigSchema.optional();

const DatabaseConfigSchema = z.object({
  type: z.literal('postgres'),
  postgres: PostgresConfigSchema,
  readReplica: ReadReplicaConfigSchema,
  debug: z.boolean().default(false),
  logQueries: z.boolean().default(false),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type PostgresConfig = z.infer<typeof PostgresConfigSchema>;

// ==========================================
// CONFIGURATION
// ==========================================

// ==========================================
// CONFIGURATION HELPERS
// ==========================================

function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  // Check if Railway variable expansion didn't work (still contains ${{)
  if (url && url.includes('${{')) {
    logger.warn('[DB Config] DATABASE_URL appears to contain unexpanded Railway variable:', url);
    logger.warn('[DB Config] Falling back to individual DB_* variables');
    return undefined;
  }
  const resolved = resolveReachableDatabaseUrl({
    databaseUrl: url,
    publicDatabaseUrl: process.env.DATABASE_PUBLIC_URL,
  });
  if (resolved.reason) {
    logger.warn(`[DB Config] ${resolved.reason}`);
  }
  return resolved.databaseUrl;
}

/**
 * Determine database type from environment
 */
export function getDatabaseType(): 'postgres' {
  // Re-read environment variables inside the function for testing support
  const databaseUrl = getDatabaseUrl();
  try {
    assertNoLocalDatabaseOutsideTests(process.env);
    assertNoPrivateRailwayDbHostOutsideRailway(process.env);
    assertNoProductionDatabaseOutsideVerifiedRuntime(process.env);
  } catch (error) {
    logger.error('\n\x1b[31m%s\x1b[0m', (error as Error).message);
    process.exit(1);
  }

  // Debug logging
  logger.info(`[DB Config] DATABASE_URL: ${databaseUrl ? 'SET' : 'NOT SET'}`);
  logger.info(`[DB Config] DB_TYPE: ${process.env.DB_TYPE || 'NOT SET'}`);

  // Validate database configuration (will crash in production if invalid)
  // validateDatabaseConfig();

  // 1. Strict Mode: If DB_TYPE is explicitly set, we MUST satisfy it or crash.
  if (!databaseUrl && !process.env.DB_HOST) {
    logger.error(
      '\n\x1b[31m%s\x1b[0m',
      'FATAL ERROR: PostgreSQL required. Set DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD.'
    );
    logger.error('Example: DATABASE_URL=postgresql://user:pass@external-db-host:5432/consultify\n');
    process.exit(1);
  }

  logger.info('[DB Config] Using PostgreSQL');
  return 'postgres';
}

/**
 * Parse PostgreSQL connection URL
 */
function parsePostgresUrl(url: string): PostgresConfig | null {
  try {
    const parsed = new URL(url);

    // Determine SSL configuration
    let sslConfig: boolean | { rejectUnauthorized?: boolean } = false;
    if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require') {
      sslConfig = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
    } else if (process.env.DB_SSL === 'false' || process.env.DB_SSL === 'disable') {
      sslConfig = false;
    } else {
      // Default: No SSL for Railway/internal connections
      sslConfig = false;
    }

    const connectionTimeout = (() => {
      const timeout = parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10);
      if (timeout < 30000) {
        logger.warn(
          `[DB Config] WARNING: DB_CONNECTION_TIMEOUT=${timeout}ms is too short for Railway. Minimum recommended: 30000ms (30 seconds). Auto-correcting to 30000ms.`
        );
        return 30000; // Force minimum 30 seconds
      }
      return timeout;
    })();

    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || '5432'),
      database: parsed.pathname.slice(1), // Remove leading /
      user: parsed.username,
      password: parsed.password,
      ssl: sslConfig,
      max: parseInt(process.env.DB_POOL_SIZE || '10'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: connectionTimeout,
      statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
    };
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    logger.error('Failed to parse DATABASE_URL:', error.message);
    return null;
  }
}

/**
 * Get PostgreSQL config from environment variables
 */
function getPostgresConfig(): PostgresConfig {
  const databaseUrl = getDatabaseUrl();
  if (databaseUrl) {
    const parsed = parsePostgresUrl(databaseUrl);
    if (parsed) {
      return parsed;
    }
    // If parsing failed, fall through to individual env vars
  }

  try {
    assertNoLocalDatabaseOutsideTests(process.env);
    assertNoPrivateRailwayDbHostOutsideRailway(process.env);
    assertNoProductionDatabaseOutsideVerifiedRuntime(process.env);
  } catch (error) {
    logger.error('\n\x1b[31m%s\x1b[0m', (error as Error).message);
    process.exit(1);
  }

  // Determine SSL configuration
  let sslConfig: boolean | { rejectUnauthorized?: boolean } = false;
  if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require') {
    sslConfig = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
  } else if (process.env.DB_SSL === 'false' || process.env.DB_SSL === 'disable') {
    sslConfig = false;
  } else {
    // Default: No SSL for Railway/internal connections
    sslConfig = false;
  }

  const connectionTimeout = (() => {
    const timeout = parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000', 10);
    if (timeout < 30000) {
      logger.warn(
        `[DB Config] WARNING: DB_CONNECTION_TIMEOUT=${timeout}ms is too short for Railway. Minimum recommended: 30000ms (30 seconds). Auto-correcting to 30000ms.`
      );
      return 30000; // Force minimum 30 seconds
    }
    return timeout;
  })();

  return {
    host: process.env.DB_HOST || '',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || '',
    user: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    ssl: sslConfig,
    max: parseInt(process.env.DB_POOL_SIZE || '10'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: connectionTimeout,
    statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
  };
}

/**
 * Get Read Replica config from environment variables
 */
function getReadReplicaConfig(): PostgresConfig | undefined {
  const readUrl = process.env.DB_READ_URL || process.env.DATABASE_READ_URL;
  if (readUrl) {
    // Check if readUrl also has unexpanded Railway variables
    if (readUrl.includes('${{')) {
      logger.warn('[DB Config] DATABASE_READ_URL appears to contain unexpanded Railway variable');
      return undefined;
    }
    const parsed = parsePostgresUrl(readUrl);
    if (parsed) return parsed;
  }

  if (process.env.DB_READ_HOST) {
    // Inherit defaults from primary, override with read-specifics
    const primary = getPostgresConfig();
    return {
      ...primary,
      host: process.env.DB_READ_HOST,
      port: parseInt(process.env.DB_READ_PORT || String(primary.port)),
      user: process.env.DB_READ_USER || primary.user,
      password: process.env.DB_READ_PASSWORD || primary.password,
    };
  }

  return undefined;
}

/**
 * Create and validate database configuration
 * Renamed to loadDatabaseConfig for consistency with tests and exported for testing support
 */
export function loadDatabaseConfig(): DatabaseConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseType = getDatabaseType();

  const config: DatabaseConfig = {
    type: databaseType,
    postgres: getPostgresConfig(),
    readReplica: getReadReplicaConfig(),
    debug: process.env.DB_DEBUG === 'true',
    logQueries: !isProduction && process.env.DB_LOG_QUERIES === 'true',
  };

  // Validate with Zod
  const result = DatabaseConfigSchema.safeParse(config);
  if (!result.success) {
    logger.error('[DB Config] Configuration validation failed:', result.error);
    throw new Error('Invalid database configuration');
  }

  return result.data;
}

// Lazy-load database config to ensure dotenv has loaded first
let _databaseConfig: DatabaseConfig | null = null;

export function getDatabaseConfig(): DatabaseConfig {
  if (!_databaseConfig) {
    _databaseConfig = loadDatabaseConfig();
  }
  return _databaseConfig;
}

// For backward compatibility, export as const (but it's actually lazy-loaded)
export const databaseConfig = new Proxy({} as DatabaseConfig, {
  get(_target, prop) {
    return getDatabaseConfig()[prop as keyof DatabaseConfig];
  },
  ownKeys() {
    return Object.keys(getDatabaseConfig());
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getDatabaseConfig(), prop);
  },
});

export default databaseConfig;
