const config = require('./config/database.config');

let db;

if (process.env.MOCK_DB === 'true') {
    console.log('[Database] Mocking database for tests');
    db = global.__TEST_DB_MOCK__ || {
        run: (sql, params, cb) => (typeof params === 'function' ? params(null) : cb && cb(null)),
        get: (sql, params, cb) => (typeof params === 'function' ? params(null, null) : cb && cb(null, null)),
        all: (sql, params, cb) => (typeof params === 'function' ? params(null, []) : cb && cb(null, [])),
        exec: (sql, cb) => (cb && cb(null)),
        serialize: (cb) => cb(),
        on: () => { },
        close: (cb) => (cb && cb(null))
    };
} else if (config.type === 'postgres') {
    console.log('[Database] Selected: PostgreSQL');
    db = require('./database.postgres.js');
} else {
    console.log('[Database] Selected: SQLite');
    // We use the active sqlite implementation we just backed up
    db = require('./database.sqlite.active.js');
}

module.exports = db;
