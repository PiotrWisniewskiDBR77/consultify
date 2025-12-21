const config = require('./config/database.config.ts');

let db;

if (config.type === 'postgres') {
    console.log('[Database] Selected: PostgreSQL');
    db = require('./database.postgres.js');
} else {
    console.log('[Database] Selected: SQLite');
    // We use the active sqlite implementation we just backed up
    db = require('./database.sqlite.active.js');
}

module.exports = db;
