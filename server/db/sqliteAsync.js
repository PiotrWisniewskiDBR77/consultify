/**
 * SQLite Async Helpers
 * 
 * Provides promisified wrappers for sqlite3 operations
 * and a proper transaction helper with single COMMIT/ROLLBACK.
 */

/**
 * Execute a SQL statement that modifies data
 * @param {object} db - sqlite3 database instance
 * @param {string} sql - SQL statement
 * @param {array} params - Parameters for prepared statement
 * @returns {Promise<{changes: number, lastID: number}>}
 */
function runAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ changes: this.changes, lastID: this.lastID });
        });
    });
}

/**
 * Execute a SQL query that returns a single row
 * @param {object} db - sqlite3 database instance
 * @param {string} sql - SQL query
 * @param {array} params - Parameters for prepared statement
 * @returns {Promise<object|undefined>}
 */
function getAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

/**
 * Execute a SQL query that returns multiple rows
 * @param {object} db - sqlite3 database instance
 * @param {string} sql - SQL query
 * @param {array} params - Parameters for prepared statement
 * @returns {Promise<array>}
 */
function allAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
}

/**
 * Execute a function within a transaction
 * Uses BEGIN IMMEDIATE for better serialization in high-concurrency scenarios
 * 
 * @param {object} db - sqlite3 database instance
 * @param {function} fn - Async function to execute within transaction
 * @returns {Promise<any>} - Result of fn()
 * @throws {Error} - If fn throws, transaction is rolled back and error is re-thrown
 */
async function withTransaction(db, fn) {
    await runAsync(db, 'BEGIN IMMEDIATE');
    try {
        const result = await fn();
        await runAsync(db, 'COMMIT');
        return result;
    } catch (e) {
        try {
            await runAsync(db, 'ROLLBACK');
        } catch (rollbackErr) {
            console.error('Rollback failed:', rollbackErr);
        }
        throw e;
    }
}

module.exports = { runAsync, getAsync, allAsync, withTransaction };
