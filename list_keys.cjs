const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

console.log("--- Current Database Keys ---");
db.each("SELECT provider, api_key FROM llm_providers", (err, row) => {
    if (row.api_key) {
        console.log(`${row.provider}: ${row.api_key.substring(0, 10)}...${row.api_key.substring(row.api_key.length - 5)} (Total Len: ${row.api_key.length})`);
    } else {
        console.log(`${row.provider}: NULL`);
    }
}, () => db.close());
