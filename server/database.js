const config = require('./config/database.config');
const path = require('path');

// Determine which adapter to load based on configuration
if (config.type === 'postgres') {
    console.log('[Database] Using PostgreSQL Adapter');
    module.exports = require('./database.postgres');
} else {
    console.log('[Database] Using SQLite Adapter');
    module.exports = require('./database.sqlite');
}
