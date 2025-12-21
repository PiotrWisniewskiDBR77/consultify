/**
 * Query Helpers Utility
 * 
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */

const db = require('../database');

// FAZA 5: Performance tracking for queryHelpers
let performanceTracker = null;

/**
 * Enable performance tracking
 * @param {Function} tracker - Function to track query metrics (queryType, duration)
 */
function enablePerformanceTracking(tracker) {
    performanceTracker = tracker;
}

/**
 * Disable performance tracking
 */
function disablePerformanceTracking() {
    performanceTracker = null;
}

/**
 * Promise-based wrapper for db.all
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} Query results
 */
function queryAll(sql, params = []) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            const duration = Date.now() - startTime;
            
            // Track performance if enabled
            if (performanceTracker) {
                performanceTracker('all', duration);
            }
            
            if (err) {
                console.error('[QueryHelper] Error in queryAll:', err);
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}

/**
 * Promise-based wrapper for db.get
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<Object|null>} Single row or null
 */
function queryOne(sql, params = []) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            const duration = Date.now() - startTime;
            
            // Track performance if enabled
            if (performanceTracker) {
                performanceTracker('get', duration);
            }
            
            if (err) {
                console.error('[QueryHelper] Error in queryOne:', err);
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * Promise-based wrapper for db.run
 * @param {string} sql - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<{lastID: number, changes: number}>} Execution result
 */
function queryRun(sql, params = []) {
    const startTime = Date.now();
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            const duration = Date.now() - startTime;
            
            // Track performance if enabled
            if (performanceTracker) {
                performanceTracker('run', duration);
            }
            
            if (err) {
                console.error('[QueryHelper] Error in queryRun:', err);
                reject(err);
            } else {
                resolve({
                    lastID: this.lastID,
                    changes: this.changes
                });
            }
        });
    });
}

/**
 * Execute multiple queries in parallel
 * @param {Array<{sql: string, params: Array}>} queries - Array of query objects
 * @returns {Promise<Array>} Results in same order as queries
 */
async function queryParallel(queries) {
    const promises = queries.map(q => {
        if (q.type === 'all') {
            return queryAll(q.sql, q.params || []);
        } else if (q.type === 'one') {
            return queryOne(q.sql, q.params || []);
        } else {
            return queryRun(q.sql, q.params || []);
        }
    });
    
    return Promise.all(promises);
}

/**
 * Build IN clause placeholders for array of values
 * @param {Array} values - Array of values
 * @returns {string} Placeholder string like "?, ?, ?"
 */
function buildInPlaceholders(values) {
    return values.map(() => '?').join(', ');
}

/**
 * Build WHERE clause for organization filtering
 * @param {string} tableAlias - Table alias (e.g., 't' for tasks)
 * @param {string} orgId - Organization ID
 * @returns {string} WHERE clause
 */
function buildOrgFilter(tableAlias, orgId) {
    return `${tableAlias}.organization_id = ?`;
}

/**
 * Build WHERE clause for user filtering (assignee or reporter)
 * @param {string} tableAlias - Table alias
 * @param {string} userId - User ID
 * @returns {string} WHERE clause
 */
function buildUserFilter(tableAlias, userId) {
    return `(${tableAlias}.assignee_id = ? OR ${tableAlias}.reporter_id = ?)`;
}

/**
 * Execute transaction (for databases that support it)
 * @param {Function} callback - Async function that receives db instance
 * @returns {Promise<any>} Result of callback
 */
async function transaction(callback) {
    // SQLite transaction support
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);
                
                callback(db)
                    .then((result) => {
                        db.run('COMMIT', (commitErr) => {
                            if (commitErr) {
                                db.run('ROLLBACK', () => {});
                                reject(commitErr);
                            } else {
                                resolve(result);
                            }
                        });
                    })
                    .catch((error) => {
                        db.run('ROLLBACK', () => {});
                        reject(error);
                    });
            });
        });
    });
}

/**
 * Parse JSON fields safely
 * @param {Object} row - Database row
 * @param {Array<string>} jsonFields - Field names that contain JSON
 * @returns {Object} Row with parsed JSON fields
 */
function parseJsonFields(row, jsonFields = ['checklist', 'attachments', 'tags', 'data']) {
    if (!row) return row;
    
    const parsed = { ...row };
    jsonFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
            try {
                parsed[field] = JSON.parse(parsed[field]);
            } catch (e) {
                console.warn(`[QueryHelper] Failed to parse JSON field ${field}:`, e);
                parsed[field] = field.includes('[]') ? [] : {};
            }
        }
    });
    
    return parsed;
}

/**
 * Transform database row to API format (snake_case to camelCase)
 * @param {Object} row - Database row
 * @param {Object} fieldMap - Optional field mapping
 * @returns {Object} Transformed object
 */
function transformRow(row, fieldMap = {}) {
    if (!row) return null;
    
    const transformed = {};
    Object.keys(row).forEach(key => {
        // Use custom mapping if provided
        if (fieldMap[key]) {
            transformed[fieldMap[key]] = row[key];
        } else {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            transformed[camelKey] = row[key];
        }
    });
    
    return transformed;
}

module.exports = {
    queryAll,
    queryOne,
    queryRun,
    queryParallel,
    buildInPlaceholders,
    buildOrgFilter,
    buildUserFilter,
    transaction,
    parseJsonFields,
    transformRow,
    // FAZA 5: Performance tracking methods
    enablePerformanceTracking,
    disablePerformanceTracking
};

