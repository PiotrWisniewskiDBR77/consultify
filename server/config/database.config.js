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
const getDatabaseType = () => {
    if (databaseUrl) {
        if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
            return 'postgres';
        }
    }
    return 'sqlite';
};

const databaseType = getDatabaseType();

// Database paths for SQLite
const sqlitePath = process.env.SQLITE_PATH || path.resolve(__dirname, 'consultify.db');

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
    postgres: databaseUrl ? parsePostgresUrl(databaseUrl) : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'consultify',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl: isProduction ? { rejectUnauthorized: false } : false,
        max: parseInt(process.env.DB_POOL_SIZE || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    },

    // Common settings
    debug: process.env.DB_DEBUG === 'true',
    logQueries: !isProduction && process.env.DB_LOG_QUERIES === 'true'
};

// Parse PostgreSQL connection URL
function parsePostgresUrl(url) {
    try {
        const parsed = new URL(url);
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port || '5432'),
            database: parsed.pathname.slice(1), // Remove leading /
            user: parsed.username,
            password: parsed.password,
            ssl: isProduction ? { rejectUnauthorized: false } : false,
            max: parseInt(process.env.DB_POOL_SIZE || '10'),
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000
        };
    } catch (e) {
        console.error('Failed to parse DATABASE_URL:', e.message);
        return null;
    }
}

module.exports = config;
