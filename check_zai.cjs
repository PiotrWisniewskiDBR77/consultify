const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.get("SELECT * FROM llm_providers WHERE provider = 'z_ai'", (err, row) => {
    console.log("Z.ai Config:", row);
    db.close();
});
