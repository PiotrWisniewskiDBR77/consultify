import databaseConfig from './config/database.config.js';

let db;

// Priority path: Check if we should use a mock database for tests
if (process.env.MOCK_DB === 'true') {
    console.log('[Database] Mocking database for tests');
    db = global.__TEST_DB_MOCK__ || {
        run: function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            // Execute with context for this.lastID coverage
            if (callback) callback.call({ lastID: 1, changes: 1 }, null);
            return this;
        },
        get: function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, null); // Default no row
            return this;
        },
        all: function (sql, params, cb) {
            const callback = typeof params === 'function' ? params : cb;
            if (callback) callback(null, []); // Default empty array
            return this;
        },
        exec: function (sql, cb) {
            if (cb) cb(null);
            return this;
        },
        serialize: function (cb) {
            if (cb) cb();
            return this;
        },
        prepare: function (sql, params) {
            return {
                run: function (params, cb) {
                    const callback = typeof params === 'function' ? params : cb;
                    if (typeof callback === 'function') callback.call({ lastID: 1, changes: 1 }, null);
                    return this;
                },
                finalize: function (cb) {
                    if (typeof cb === 'function') cb();
                }
            };
        },
        on: function () { return this; },
        close: function (cb) {
            if (cb) cb(null);
        }
    };
} else if (databaseConfig.type === 'postgres') {
    console.log('[Database] Selected: PostgreSQL');
    const { default: postgresDb } = await import('./database.postgres.js');
    db = postgresDb;
} else {
    // console.log('[Database] Selected: SQLite');
    // CRITICAL: We dynamic import here to avoid loading sqlite3 bindings 
    // when MOCK_DB is true, which avoids native crashes in Vitest workers.
    try {
        const { default: sqliteDb } = await import('./database.sqlite.js');
        db = sqliteDb;
    } catch (e) {
        console.error('[Database] Failed to load SQLite active database:', e);
        throw e;
    }
}


// Export function for compatibility with TypeScript modules
export function getDatabase() {
    return db;
}

export default db;
