import { createRequire } from 'module';
import config from './config/database.config.js';
import sqliteDb from './database.sqlite.active.js';

const require = createRequire(import.meta.url);

let db;

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
} else if (config.type === 'postgres') {
    console.log('[Database] Selected: PostgreSQL');
    db = require('./database.postgres.js');
} else {
    console.log('[Database] Selected: SQLite');
    // We use the active sqlite implementation we just backed up
    db = sqliteDb;
}

export default db;
