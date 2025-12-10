/**
 * Database Query Adapter
 * 
 * Provides a unified interface for both SQLite and PostgreSQL
 * This is used by services that need database-agnostic queries
 */

const dbConfig = require('../config/database.config');

class QueryAdapter {
    constructor(db, type = 'sqlite') {
        this.db = db;
        this.type = type;
    }

    /**
     * Convert SQLite placeholder (?) to PostgreSQL ($1, $2, ...)
     */
    adaptQuery(sql, params = []) {
        if (this.type === 'postgres' && sql.includes('?')) {
            let paramIndex = 1;
            sql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        }
        return { sql, params };
    }

    /**
     * Get all rows
     */
    async all(sql, params = []) {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query(adapted.sql, adapted.params);
            return result.rows;
        } else {
            return new Promise((resolve, reject) => {
                this.db.all(adapted.sql, adapted.params, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
        }
    }

    /**
     * Get single row
     */
    async get(sql, params = []) {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query(adapted.sql, adapted.params);
            return result.rows[0];
        } else {
            return new Promise((resolve, reject) => {
                this.db.get(adapted.sql, adapted.params, (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }
    }

    /**
     * Execute a statement (INSERT, UPDATE, DELETE)
     */
    async run(sql, params = []) {
        const adapted = this.adaptQuery(sql, params);

        if (this.type === 'postgres') {
            const result = await this.db.query(adapted.sql, adapted.params);
            return {
                changes: result.rowCount,
                lastID: result.rows[0]?.id // For RETURNING id
            };
        } else {
            return new Promise((resolve, reject) => {
                this.db.run(adapted.sql, adapted.params, function (err) {
                    if (err) reject(err);
                    else resolve({ changes: this.changes, lastID: this.lastID });
                });
            });
        }
    }

    /**
     * Begin transaction
     */
    async beginTransaction() {
        if (this.type === 'postgres') {
            await this.db.query('BEGIN');
        } else {
            await this.run('BEGIN TRANSACTION');
        }
    }

    /**
     * Commit transaction
     */
    async commit() {
        if (this.type === 'postgres') {
            await this.db.query('COMMIT');
        } else {
            await this.run('COMMIT');
        }
    }

    /**
     * Rollback transaction
     */
    async rollback() {
        if (this.type === 'postgres') {
            await this.db.query('ROLLBACK');
        } else {
            await this.run('ROLLBACK');
        }
    }

    /**
     * Get placeholder syntax for the database type
     */
    placeholder(index) {
        return this.type === 'postgres' ? `$${index}` : '?';
    }

    /**
     * Get RETURNING clause (PostgreSQL) or nothing (SQLite uses lastID)
     */
    returning(column = 'id') {
        return this.type === 'postgres' ? ` RETURNING ${column}` : '';
    }

    /**
     * JSON functions differ between databases
     */
    jsonExtract(column, path) {
        if (this.type === 'postgres') {
            return `${column}->>'${path}'`;
        } else {
            return `json_extract(${column}, '$.${path}')`;
        }
    }
}

module.exports = QueryAdapter;
