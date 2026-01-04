/**
 * Query Helpers Utility
 *
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */
import db from '../database';
/**
 * Promise-based wrapper for db.all
 */
export function queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                console.error('[QueryHelper] Error in queryAll:', err);
                reject(err);
            }
            else {
                resolve(rows || []);
            }
        });
    });
}
/**
 * Promise-based wrapper for db.get
 */
export function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                console.error('[QueryHelper] Error in queryOne:', err);
                reject(err);
            }
            else {
                resolve(row || null);
            }
        });
    });
}
/**
 * Promise-based wrapper for db.run
 */
export function queryRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                console.error('[QueryHelper] Error in queryRun:', err);
                reject(err);
            }
            else {
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
 */
export async function queryParallel(queries) {
    const promises = queries.map(q => {
        if (q.type === 'all') {
            return queryAll(q.sql, q.params || []);
        }
        else if (q.type === 'one') {
            return queryOne(q.sql, q.params || []);
        }
        else {
            return queryRun(q.sql, q.params || []);
        }
    });
    return Promise.all(promises);
}
/**
 * Build IN clause placeholders for array of values
 */
export function buildInPlaceholders(values) {
    return values.map(() => '?').join(', ');
}
/**
 * Build WHERE clause for organization filtering
 */
export function buildOrgFilter(tableAlias, orgId) {
    return `${tableAlias}.organization_id = ?`;
}
/**
 * Build WHERE clause for user filtering (assignee or reporter)
 */
export function buildUserFilter(tableAlias, userId) {
    return `(${tableAlias}.assignee_id = ? OR ${tableAlias}.reporter_id = ?)`;
}
/**
 * Execute transaction (for databases that support it)
 */
export async function transaction(callback) {
    // SQLite transaction support
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err)
                    return reject(err);
                callback(db)
                    .then((result) => {
                    db.run('COMMIT', (commitErr) => {
                        if (commitErr) {
                            db.run('ROLLBACK', () => { });
                            reject(commitErr);
                        }
                        else {
                            resolve(result);
                        }
                    });
                })
                    .catch((error) => {
                    db.run('ROLLBACK', () => { });
                    reject(error);
                });
            });
        });
    });
}
/**
 * Parse JSON fields safely
 */
export function parseJsonFields(row, jsonFields = ['checklist', 'attachments', 'tags', 'data']) {
    if (!row)
        return row;
    const parsed = { ...row };
    jsonFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
            try {
                parsed[field] = JSON.parse(parsed[field]);
            }
            catch (e) {
                console.warn(`[QueryHelper] Failed to parse JSON field ${field}:`, e);
                parsed[field] = field.includes('[]') ? [] : {};
            }
        }
    });
    return parsed;
}
/**
 * Transform database row to API format (snake_case to camelCase)
 */
export function transformRow(row, fieldMap = {}) {
    if (!row)
        return null;
    const transformed = {};
    Object.keys(row).forEach(key => {
        // Use custom mapping if provided
        if (fieldMap[key]) {
            transformed[fieldMap[key]] = row[key];
        }
        else {
            // Convert snake_case to camelCase
            const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
            transformed[camelKey] = row[key];
        }
    });
    return transformed;
}
//# sourceMappingURL=queryHelpers.js.map