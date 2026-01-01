/**
 * Database Promise Wrapper for SQLite3
 * 
 * SQLite3 uses callbacks by default. This module provides Promise-based wrappers
 * with built-in resilience features:
 * - Timeout protection (prevents hanging forever)
 * - Error handling with graceful fallbacks
 * - Logging for debugging
 * 
 * USAGE:
 * const dbPromise = require('../utils/dbPromise');
 * const rows = await dbPromise.all('SELECT * FROM users WHERE id = ?', [userId]);
 * const user = await dbPromise.get('SELECT * FROM users WHERE id = ?', [userId]);
 * const result = await dbPromise.run('INSERT INTO users (name) VALUES (?)', ['John']);
 */

const db = require('../database');

// Default timeout for database operations (5 seconds)
const DEFAULT_TIMEOUT = 5000;

/**
 * Simple logger for DB operations
 */
const dbLogger = {
    debug: (msg, data) => {
        if (process.env.DEBUG_DB === 'true') {
            console.log(`[DB:Promise] ${msg}`, data || '');
        }
    },
    warn: (msg, data) => {
        console.warn(`[DB:Promise] ${msg}`, data || '');
    },
    error: (msg, data) => {
        console.error(`[DB:Promise] ${msg}`, data || '');
    }
};

/**
 * Promise wrapper for db.all() - returns array of rows
 * 
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<Array>} - Array of rows (empty array on error if fallback enabled)
 */
function all(sql, params = [], options = {}) {
    const { timeout = DEFAULT_TIMEOUT, fallback = true } = options;

    return new Promise((resolve, reject) => {
        // Timeout protection
        const timeoutId = setTimeout(() => {
            dbLogger.warn('Query timeout', { sql: sql.substring(0, 100), timeout });
            if (fallback) {
                resolve([]);
            } else {
                reject(new Error(`Database query timeout after ${timeout}ms`));
            }
        }, timeout);

        try {
            db.all(sql, params, (err, rows) => {
                clearTimeout(timeoutId);
                
                if (err) {
                    dbLogger.warn('Query error', { error: err.message, sql: sql.substring(0, 100) });
                    if (fallback) {
                        resolve([]);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(rows || []);
                }
            });
        } catch (error) {
            clearTimeout(timeoutId);
            dbLogger.error('Query exception', { error: error.message, sql: sql.substring(0, 100) });
            if (fallback) {
                resolve([]);
            } else {
                reject(error);
            }
        }
    });
}

/**
 * Promise wrapper for db.get() - returns single row
 * 
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<Object|null>} - Single row or null (null on error if fallback enabled)
 */
function get(sql, params = [], options = {}) {
    const { timeout = DEFAULT_TIMEOUT, fallback = true } = options;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            dbLogger.warn('Query timeout', { sql: sql.substring(0, 100), timeout });
            if (fallback) {
                resolve(null);
            } else {
                reject(new Error(`Database query timeout after ${timeout}ms`));
            }
        }, timeout);

        try {
            db.get(sql, params, (err, row) => {
                clearTimeout(timeoutId);
                
                if (err) {
                    dbLogger.warn('Query error', { error: err.message, sql: sql.substring(0, 100) });
                    if (fallback) {
                        resolve(null);
                    } else {
                        reject(err);
                    }
                } else {
                    resolve(row || null);
                }
            });
        } catch (error) {
            clearTimeout(timeoutId);
            dbLogger.error('Query exception', { error: error.message, sql: sql.substring(0, 100) });
            if (fallback) {
                resolve(null);
            } else {
                reject(error);
            }
        }
    });
}

/**
 * Promise wrapper for db.run() - executes INSERT/UPDATE/DELETE
 * 
 * @param {string} sql - SQL statement
 * @param {Array} params - Statement parameters (default: [])
 * @param {Object} options - Options { timeout, fallback }
 * @returns {Promise<{success: boolean, lastID?: number, changes?: number, error?: string}>}
 */
function run(sql, params = [], options = {}) {
    const { timeout = DEFAULT_TIMEOUT, fallback = true } = options;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            dbLogger.warn('Statement timeout', { sql: sql.substring(0, 100), timeout });
            if (fallback) {
                resolve({ success: false, error: 'timeout' });
            } else {
                reject(new Error(`Database statement timeout after ${timeout}ms`));
            }
        }, timeout);

        try {
            db.run(sql, params, function(err) {
                clearTimeout(timeoutId);
                
                if (err) {
                    dbLogger.warn('Statement error', { error: err.message, sql: sql.substring(0, 100) });
                    if (fallback) {
                        resolve({ success: false, error: err.message });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve({ 
                        success: true, 
                        lastID: this.lastID, 
                        changes: this.changes 
                    });
                }
            });
        } catch (error) {
            clearTimeout(timeoutId);
            dbLogger.error('Statement exception', { error: error.message, sql: sql.substring(0, 100) });
            if (fallback) {
                resolve({ success: false, error: error.message });
            } else {
                reject(error);
            }
        }
    });
}

/**
 * Execute multiple statements in a transaction
 * 
 * @param {Array<{sql: string, params: Array}>} statements - Array of statements
 * @returns {Promise<{success: boolean, results: Array, error?: string}>}
 */
async function transaction(statements) {
    try {
        await run('BEGIN TRANSACTION');
        
        const results = [];
        for (const stmt of statements) {
            const result = await run(stmt.sql, stmt.params, { fallback: false });
            results.push(result);
        }
        
        await run('COMMIT');
        return { success: true, results };
    } catch (error) {
        dbLogger.error('Transaction failed, rolling back', { error: error.message });
        try {
            await run('ROLLBACK');
        } catch (rollbackError) {
            dbLogger.error('Rollback failed', { error: rollbackError.message });
        }
        return { success: false, error: error.message, results: [] };
    }
}

/**
 * Check if a table exists
 * 
 * @param {string} tableName - Name of table to check
 * @returns {Promise<boolean>}
 */
async function tableExists(tableName) {
    const result = await get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
    );
    return result !== null;
}

/**
 * Execute raw SQL and return result (for migrations, etc.)
 * 
 * @param {string} sql - SQL to execute
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function exec(sql) {
    return new Promise((resolve) => {
        db.exec(sql, (err) => {
            if (err) {
                dbLogger.error('Exec failed', { error: err.message });
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true });
            }
        });
    });
}

/**
 * Safe query wrapper that always returns an array (for SELECT queries)
 * Useful when you want to iterate over results without null checks
 * 
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>}
 */
async function safeAll(sql, params = []) {
    const result = await all(sql, params);
    return Array.isArray(result) ? result : [];
}

/**
 * Count rows matching a query
 * 
 * @param {string} table - Table name
 * @param {string} where - WHERE clause (without WHERE keyword)
 * @param {Array} params - Query parameters
 * @returns {Promise<number>}
 */
async function count(table, where = '1=1', params = []) {
    const result = await get(`SELECT COUNT(*) as count FROM ${table} WHERE ${where}`, params);
    return result?.count || 0;
}

module.exports = {
    all,
    get,
    run,
    transaction,
    tableExists,
    exec,
    safeAll,
    count,
    // Export logger for external use
    logger: dbLogger
};


