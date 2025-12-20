const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

console.log("Updating Z.ai endpoint...");
const correctEndpoint = 'https://open.bigmodel.cn/api/paas/v4/chat/completions';

db.run("UPDATE llm_providers SET endpoint = ? WHERE provider = 'z_ai'", [correctEndpoint], function (err) {
    if (err) return console.error(err);
    console.log(`Updated ${this.changes} rows.`);
    db.close();
});
