/**
 * Database Configuration
 * 
 * Supports both SQLite (development) and PostgreSQL (production)
 * Switch by setting DATABASE_URL environment variable
 */

const path = require('path');

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

// Determine database type
// Determine database type
const getDatabaseType = () => {
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
};

const databaseType = getDatabaseType();

// Database paths for SQLite
const sqlitePath = process.env.SQLITE_PATH || path.resolve(__dirname, 'consultify.db');

// Parse PostgreSQL connection URL (must be defined before config object)
function parsePostgresUrl(url) {
    try {
        const parsed = new URL(url);
        
        // Determine SSL configuration
        // Railway PostgreSQL doesn't require SSL for internal connections
        // Allow override via DB_SSL environment variable
        let sslConfig = false;
        if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require') {
            sslConfig = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
        } else if (process.env.DB_SSL === 'false' || process.env.DB_SSL === 'disable') {
            sslConfig = false;
        } else {
            // Default: No SSL for Railway/internal connections
            // Only enable SSL if explicitly requested or for external databases
            sslConfig = false;
        }
        
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port || '5432'),
            database: parsed.pathname.slice(1), // Remove leading /
            user: parsed.username,
            password: parsed.password,
            ssl: sslConfig,
            max: parseInt(process.env.DB_POOL_SIZE || '10'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        };
    } catch (e) {
        console.error('Failed to parse DATABASE_URL:', e.message);
        return null;
    }
}

const config = {
    type: databaseType,

    // SQLite config
    sqlite: {
        path: sqlitePath,
        // SQLite connection options
        options: {
            verbose: !isProduction
        }
    },

    // PostgreSQL config (parsed from DATABASE_URL)
    postgres: databaseUrl ? parsePostgresUrl(databaseUrl) : (() => {
        // Determine SSL configuration
        let sslConfig = false;
        if (process.env.DB_SSL === 'true' || process.env.DB_SSL === 'require') {
            sslConfig = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
        } else if (process.env.DB_SSL === 'false' || process.env.DB_SSL === 'disable') {
            sslConfig = false;
        } else {
            // Default: No SSL for Railway/internal connections
            sslConfig = false;
        }
        
        return {
            host: process.env.DB_HOST || 'localhost',
            port: parseInt(process.env.DB_PORT || '5432'),
            database: process.env.DB_NAME || 'consultify',
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || '',
            ssl: sslConfig,
            max: parseInt(process.env.DB_POOL_SIZE || '10'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        };
    })(),

    // Common settings
    debug: process.env.DB_DEBUG === 'true',
    logQueries: !isProduction && process.env.DB_LOG_QUERIES === 'true'
};

module.exports = config;
