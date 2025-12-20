const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Switching default provider to OpenAI...");

    // 1. Unset existing defaults
    db.run("UPDATE llm_providers SET is_default = 0", (err) => {
        if (err) console.error("Error clearing defaults:", err);

        // 2. Set OpenAI as default
        db.run("UPDATE llm_providers SET is_default = 1 WHERE provider = 'openai'", function (err) {
            if (err) {
                console.error("Error setting OpenAI default:", err);
                return;
            }
            console.log(`Updated ${this.changes} row(s).`);

            // Verify
            db.all("SELECT provider, is_default, is_active FROM llm_providers", (err, rows) => {
                console.table(rows);
                db.close();
            });
        });
    });
});

