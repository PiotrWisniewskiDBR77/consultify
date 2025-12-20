const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

console.log("Switching to Qwen (Alibaba)...");
const qwenEndpoint = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions';

db.serialize(() => {
    // 1. Reset defaults
    db.run("UPDATE llm_providers SET is_default = 0");

    // 2. Set Qwen as default and update endpoint
    db.run("UPDATE llm_providers SET is_default = 1, endpoint = ? WHERE provider = 'qwen'", [qwenEndpoint], function (err) {
        if (err) return console.error(err);
        console.log(`Updated ${this.changes} rows for qwen.`);

        db.all("SELECT provider, is_default, endpoint FROM llm_providers", (err, rows) => {
            console.table(rows);
            db.close();
        });
    });
});
