/**
 * Database Helper for Tests
 * Provides utilities for managing test database state
 *
 * CTO NOTE: Using Transactional Rollbacks for isolation and performance
 */

import { getDatabaseAsync } from '../../server/src/database/Database.js';

// Get database handle
let db;
async function getDb() {
  if (!db) {
    db = await getDatabaseAsync();
  }
  return db;
}

/**
 * Wait for database initialization
 */
export async function initTestDb() {
  const db = await getDb();
  // Clear mock flag if set
  delete process.env.MOCK_DB;

  // IMPORTANT: Enable foreign key constraints for proper testing
  await new Promise((resolve, reject) => {
    db.run('PRAGMA foreign_keys = ON', (err) => {
      if (err) {
        console.warn('Could not enable foreign keys:', err.message);
      }
      resolve();
    });
  });
}

/**
 * Start a database transaction
 */
export async function beginTransaction() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run('BEGIN TRANSACTION', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Rollback a database transaction
 */
export async function rollbackTransaction() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run('ROLLBACK', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Commit a database transaction
 */
export async function commitTransaction() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run('COMMIT', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Clean up test data from specific tables
 * @param {string[]} tables - Array of table names to clean
 */
export async function cleanTables(tables) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Disable foreign keys temporarily for faster cleanup
      db.run('PRAGMA foreign_keys = OFF', (err) => {
        if (err) return reject(err);

        let completed = 0;
        const total = tables.length;

        if (total === 0) {
          db.run('PRAGMA foreign_keys = ON', () => resolve());
          return;
        }

        tables.forEach((table) => {
          db.run(`DELETE FROM ${table}`, (err) => {
            if (err && !err.message.includes('no such table')) {
              console.warn(`Warning: Could not clean table ${table}:`, err.message);
            }
            completed++;
            if (completed === total) {
              db.run('PRAGMA foreign_keys = ON', () => resolve());
            }
          });
        });
      });
    });
  });
}

/**
 * Clean all test-related tables
 */
export async function cleanAllTestTables() {
  const testTables = [
    'activity_logs',
    'ai_feedback',
    'ai_logs',
    'feedback',
    'notifications',
    'tasks',
    'projects',
    'users',
    'organizations',
    'sessions',
    'settings',
    'invitations',
    'refresh_tokens',
    'revoked_tokens',
  ];

  return cleanTables(testTables);
}

/**
 * Create test organization
 */
export async function createTestOrg(orgId, name = 'Test Org') {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
      [orgId, name, 'free', 'active'],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Create test user
 */
export async function createTestUser(userData) {
  const db = await getDb();
  const {
    id,
    organizationId,
    email,
    password,
    firstName = 'Test',
    lastName = 'User',
    role = 'USER',
  } = userData;

  const bcrypt = await import('bcryptjs').then((m) => m.default || m);
  const hash = password ? bcrypt.hashSync(password, 8) : null;

  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, organizationId, email, hash, firstName, lastName, role],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

/**
 * Helper to run database operations in sequence
 */
export async function dbRun(sql, params = []) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Helper to query database
 */
export async function dbAll(sql, params = []) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

/**
 * Helper to get single row
 */
export async function dbGet(sql, params = []) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
