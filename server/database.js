import { createRequire } from 'module';
import databaseConfig from './config/database.config.js';

const require = createRequire(import.meta.url);

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
        on: function () { return this; },
        close: function (cb) {
            if (cb) cb(null);
        }
    };
} else if (databaseConfig.type === 'postgres') {
    console.log('[Database] Selected: PostgreSQL');
    // Using require for now as dynamic import would break synchronous export
    // However, in our current environment (type: module), we should probably use await import()
    // but this file exports db synchronously. For now, staying with require for CJS compatibility
    // if it's safe, or we might need to migrate this to an async init pattern.
    db = require('./database.postgres.js');
    // console.log('[Database] Selected: SQLite');
    // CRITICAL: We dynamic require/import here to avoid loading sqlite3 bindings 
    // when MOCK_DB is true, which avoids native crashes in Vitest workers.
    try {
        // Use require (created via createRequire) to maintain synchronous behavior
        const sqliteDb = require('./database.sqlite.active.js');
        db = sqliteDb.default || sqliteDb;
    } catch (e) {
        console.error('[Database] Failed to load SQLite active database:', e);
        throw e;
    }
}


export default db;
