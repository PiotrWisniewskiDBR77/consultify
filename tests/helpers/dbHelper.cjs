/**
 * Database Helper for Tests
 * Provides utilities for managing test database state
 */

// Use dynamic import for ES module compatibility
let db;
let dbInitialized = false;
let dbInitPromise = null;

/**
 * Get database instance with caching and connection pooling optimization
 */
async function getDb() {
    if (!dbInitialized) {
        if (!dbInitPromise) {
            dbInitPromise = (async () => {
                const dbModule = await import('../../server/database.sqlite.active.js');
                db = dbModule.default || dbModule;
                dbInitialized = true;
                return db;
            })();
        }
        await dbInitPromise;
    }
    return db;
}

// Initialize db on first use
(async () => {
    try {
        db = await getDb();
    } catch (e) {
        // Will be initialized in initTestDb
    }
})();

/**
 * Wait for database initialization
 */
async function initTestDb() {
    db = await getDb();
    await db.initPromise;
    // Clear mock flag if set
    delete process.env.MOCK_DB;
    // Enable foreign keys for SQLite
    await new Promise((resolve) => {
        db.run('PRAGMA foreign_keys = ON', resolve);
    });
}

/**
 * Clean up test data from specific tables
 * @param {string[]} tables - Array of table names to clean
 */
async function cleanTables(tables) {
    const database = await getDb();
    return new Promise((resolve, reject) => {
        database.serialize(() => {
            // Disable foreign keys temporarily for faster cleanup
            database.run('PRAGMA foreign_keys = OFF', (err) => {
                if (err) return reject(err);

                let completed = 0;
                const total = tables.length;

                if (total === 0) {
                    database.run('PRAGMA foreign_keys = ON', () => resolve());
                    return;
                }

                tables.forEach(table => {
                    database.run(`DELETE FROM ${table}`, (err) => {
                        if (err && !err.message.includes('no such table')) {
                            console.warn(`Warning: Could not clean table ${table}:`, err.message);
                        }
                        completed++;
                        if (completed === total) {
                            database.run('PRAGMA foreign_keys = ON', () => resolve());
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
    const database = await getDb();
    return new Promise((resolve, reject) => {
        database.run(
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
    const database = await getDb();

    return new Promise((resolve, reject) => {
        database.run(
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
async function dbRun(sql, params = []) {
    const database = await getDb();
    return new Promise((resolve, reject) => {
        database.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

/**
 * Helper to query database
 */
async function dbAll(sql, params = []) {
    const database = await getDb();
    return new Promise((resolve, reject) => {
        database.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

/**
 * Helper to get single row
 */
async function dbGet(sql, params = []) {
    const database = await getDb();
    return new Promise((resolve, reject) => {
        database.get(sql, params, (err, row) => {
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
    get db() {
        if (!dbInitialized) {
            // Try to get db synchronously - will fail if not initialized
            // This is for backward compatibility
            return null;
        }
        return db;
    },
    getDb // Export async getter
};
