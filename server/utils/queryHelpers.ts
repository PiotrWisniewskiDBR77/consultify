/**
 * Query Helpers Utility
 * 
 * Provides Promise-based wrappers and helpers for database queries.
 * Eliminates callback hell and provides consistent error handling.
 */

import db from '../database';

interface Database {
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    run: (sql: string, params: unknown[], callback: (this: { lastID?: number; changes: number }, err: Error | null) => void) => void;
    serialize: (callback: () => void) => void;
}

interface QueryResult {
    lastID?: number;
    changes: number;
}

interface Query {
    type: 'all' | 'one' | 'run';
    sql: string;
    params?: unknown[];
}

/**
 * Promise-based wrapper for db.all
 */
export function queryAll(sql: string, params: unknown[] = []): Promise<unknown[]> {
    return new Promise((resolve, reject) => {
        (db as Database).all(sql, params, (err: Error | null, rows: unknown[]) => {
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
 */
export function queryOne(sql: string, params: unknown[] = []): Promise<unknown | null> {
    return new Promise((resolve, reject) => {
        (db as Database).get(sql, params, (err: Error | null, row: unknown) => {
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
 */
export function queryRun(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
        (db as Database).run(sql, params, function (this: { lastID?: number; changes: number }, err: Error | null) {
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
 */
export async function queryParallel(queries: Query[]): Promise<unknown[]> {
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
 */
export function buildInPlaceholders(values: unknown[]): string {
    return values.map(() => '?').join(', ');
}

/**
 * Build WHERE clause for organization filtering
 */
export function buildOrgFilter(tableAlias: string, orgId: string): string {
    return `${tableAlias}.organization_id = ?`;
}

/**
 * Build WHERE clause for user filtering (assignee or reporter)
 */
export function buildUserFilter(tableAlias: string, userId: string): string {
    return `(${tableAlias}.assignee_id = ? OR ${tableAlias}.reporter_id = ?)`;
}

/**
 * Execute transaction (for databases that support it)
 */
export async function transaction<T>(callback: (db: Database) => Promise<T>): Promise<T> {
    // SQLite transaction support
    return new Promise((resolve, reject) => {
        (db as Database).serialize(() => {
            (db as Database).run('BEGIN TRANSACTION', (err: Error | null) => {
                if (err) return reject(err);
                
                callback(db as Database)
                    .then((result) => {
                        (db as Database).run('COMMIT', (commitErr: Error | null) => {
                            if (commitErr) {
                                (db as Database).run('ROLLBACK', () => {});
                                reject(commitErr);
                            } else {
                                resolve(result);
                            }
                        });
                    })
                    .catch((error) => {
                        (db as Database).run('ROLLBACK', () => {});
                        reject(error);
                    });
            });
        });
    });
}

/**
 * Parse JSON fields safely
 */
export function parseJsonFields(
    row: Record<string, unknown>,
    jsonFields: string[] = ['checklist', 'attachments', 'tags', 'data']
): Record<string, unknown> {
    if (!row) return row;
    
    const parsed = { ...row };
    jsonFields.forEach(field => {
        if (parsed[field] && typeof parsed[field] === 'string') {
            try {
                parsed[field] = JSON.parse(parsed[field] as string);
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
 */
export function transformRow(
    row: Record<string, unknown> | null,
    fieldMap: Record<string, string> = {}
): Record<string, unknown> | null {
    if (!row) return null;
    
    const transformed: Record<string, unknown> = {};
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

