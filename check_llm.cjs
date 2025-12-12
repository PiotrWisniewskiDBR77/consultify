
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const databases = ['consultify.db', 'consultify.db.bak', 'consultify 2.db'];

databases.forEach(dbName => {
    console.log(`\nValidating: ${dbName}...`);
    const dbPath = path.resolve(__dirname, 'server', dbName);
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => { // OPEN_READONLY to be safe
        if (err) {
            console.log(`[${dbName}] Could not open: ${err.message}`);
            return;
        }

        db.all("SELECT * FROM llm_providers", [], (err, rows) => {
            if (err) {
                console.log(`[${dbName}] Error querying: ${err.message}`);
            } else {
                console.log(`[${dbName}] Found ${rows ? rows.length : 0} rows.`);
                if (rows && rows.length > 0) {
                    rows.forEach(row => {
                        console.log(`  - ${row.provider}: Active=${row.is_active}, Key=${row.api_key ? (row.api_key.substring(0, 5) + '...') : 'NULL'}`);
                    });
                }
            }
            db.close();
        });
    });
});

