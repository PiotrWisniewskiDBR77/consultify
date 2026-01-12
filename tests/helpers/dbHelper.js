/**
 * Database Helper for Tests
 * Provides utilities for managing test database state
 */

const db = require('../../server/database.js');

/**
 * Wait for database initialization
 */
async function initTestDb() {
    await db.initPromise;
    // Clear mock flag if set
    delete process.env.MOCK_DB;

    // IMPORTANT: Enable foreign key constraints for proper testing
    return new Promise((resolve, reject) => {
        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) {
                console.warn('Could not enable foreign keys:', err.message);
            }
            resolve();
        });
    });
}

/**
 * Clean up test data from specific tables
 * @param {string[]} tables - Array of table names to clean
 */
async function cleanTables(tables) {
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

                tables.forEach(table => {
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
async function cleanAllTestTables() {
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
    ];

    return cleanTables(testTables);
}

/**
 * Create test organization
 * @param {string} orgId - Organization ID
 * @param {string} name - Organization name
 * @returns {Promise<void>}
 */
async function createTestOrg(orgId, name = 'Test Org') {
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
 * @param {object} userData - User data
 * @returns {Promise<void>}
 */
async function createTestUser(userData) {
    const {
        id,
        organizationId,
        email,
        password,
        firstName = 'Test',
        lastName = 'User',
        role = 'USER',
    } = userData;

    const bcrypt = require('bcryptjs');
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
function dbRun(sql, params = []) {
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
function dbAll(sql, params = []) {
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
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

module.exports = {
    initTestDb,
    cleanTables,
    cleanAllTestTables,
    createTestOrg,
    createTestUser,
    dbRun,
    dbAll,
    dbGet,
};
