const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

console.log("Checking Qwen Config...");
db.get("SELECT * FROM llm_providers WHERE provider = 'qwen'", (err, row) => {
    console.log("Qwen Config:", row);
    db.close();
});
