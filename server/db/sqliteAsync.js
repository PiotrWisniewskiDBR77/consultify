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
export function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

export function getAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

export function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

export async function withTransaction(db, fn) {
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
