/**
 * Database Configuration
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * Supports both SQLite (development) and PostgreSQL (production)
 * Switch by setting DATABASE_URL environment variable
 */

import { z } from 'zod';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ==========================================
// ZOD SCHEMAS
// ==========================================

const DatabaseTypeSchema = z.enum(['sqlite', 'postgres']);

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

const SQLiteConfigSchema = z.object({
    path: z.string(),
    options: z.object({
        verbose: z.boolean().optional(),
    }).optional(),
});

const DatabaseConfigSchema = z.object({
    type: DatabaseTypeSchema,
    sqlite: SQLiteConfigSchema,
    postgres: PostgresConfigSchema,
    debug: z.boolean().default(false),
    logQueries: z.boolean().default(false),
});

export type DatabaseType = z.infer<typeof DatabaseTypeSchema>;
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
export type PostgresConfig = z.infer<typeof PostgresConfigSchema>;
export type SQLiteConfig = z.infer<typeof SQLiteConfigSchema>;

// ==========================================
// CONFIGURATION
// ==========================================

const isProduction = process.env.NODE_ENV === 'production';
let databaseUrl: string | undefined = process.env.DATABASE_URL;

// Check if Railway variable expansion didn't work (still contains ${{)
if (databaseUrl && databaseUrl.includes('${{')) {
    console.warn('[DB Config] DATABASE_URL appears to contain unexpanded Railway variable:', databaseUrl);
    console.warn('[DB Config] Falling back to individual DB_* variables');
    databaseUrl = undefined; // Force fallback to individual variables
}

/**
 * Determine database type from environment
 */
function getDatabaseType(): DatabaseType {
    // 1. Strict Mode: If DB_TYPE is explicitly set, we MUST satisfy it or crash.
    if (process.env.DB_TYPE) {
        if (process.env.DB_TYPE === 'postgres') {
            if (!databaseUrl && !process.env.DB_HOST) {
                console.error('\n\x1b[31m%s\x1b[0m', 'FATAL ERROR: DB_TYPE is set to "postgres" but no DATABASE_URL or DB_HOST is provided.');
                console.error('Please configure your .env file with the correct database credentials.\n');
                process.exit(1);
            }
            return 'postgres';
        }
        if (process.env.DB_TYPE === 'sqlite') {
            return 'sqlite';
        }
    }

    // 2. Legacy/Auto-Detect Mode (Warn if falling back)
    if (databaseUrl) {
        if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
            return 'postgres';
        }
    }

    // Warn about implicit fallback
    console.warn('\n\x1b[33m%s\x1b[0m', 'WARNING: No DB_TYPE set. Falling back to SQLite default.');
    console.warn('To prevent this, set DB_TYPE=sqlite or DB_TYPE=postgres in your .env file.\n');
    return 'sqlite';
}

const databaseType = getDatabaseType();

// Database paths for SQLite
const sqlitePath = process.env.SQLITE_PATH || path.resolve(__dirname, '../../consultify.db');

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
            if (timeout < 10000) {
                console.warn(`[DB Config] WARNING: DB_CONNECTION_TIMEOUT=${timeout}ms is too short for Railway. Minimum recommended: 30000ms (30 seconds)`);
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
        console.error('Failed to parse DATABASE_URL:', error.message);
        return null;
    }
}

/**
 * Get PostgreSQL config from environment variables
 */
function getPostgresConfig(): PostgresConfig {
    if (databaseUrl) {
        const parsed = parsePostgresUrl(databaseUrl);
        if (parsed) {
            return parsed;
        }
        // If parsing failed, fall through to individual env vars
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
        if (timeout < 10000) {
            console.warn(`[DB Config] WARNING: DB_CONNECTION_TIMEOUT=${timeout}ms is too short for Railway. Minimum recommended: 30000ms (30 seconds)`);
            return 30000; // Force minimum 30 seconds
        }
        return timeout;
    })();

    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'consultify',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: sslConfig,
        max: parseInt(process.env.DB_POOL_SIZE || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: connectionTimeout,
        statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '60000', 10),
    };
}

/**
 * Create and validate database configuration
 */
function createDatabaseConfig(): DatabaseConfig {
    const config: DatabaseConfig = {
        type: databaseType,
        sqlite: {
            path: sqlitePath,
            options: {
                verbose: !isProduction,
            },
        },
        postgres: getPostgresConfig(),
        debug: process.env.DB_DEBUG === 'true',
        logQueries: !isProduction && process.env.DB_LOG_QUERIES === 'true',
    };

    // Validate with Zod
    const result = DatabaseConfigSchema.safeParse(config);
    if (!result.success) {
        console.error('[DB Config] Configuration validation failed:', result.error);
        throw new Error('Invalid database configuration');
    }

    return result.data;
}

export const databaseConfig = createDatabaseConfig();

export default databaseConfig;

