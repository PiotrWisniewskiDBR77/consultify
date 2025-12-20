const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Checking LLM Providers ---");
    db.all("SELECT id, provider, model_id, length(api_key) as key_len FROM llm_providers", (err, rows) => {
        if (err) {
            console.error("Error fetching providers:", err);
            return;
        }
        if (rows.length === 0) {
            console.log("No LLM providers found.");
        } else {
            console.table(rows);
        }
    });

    console.log("\n--- Checking System Prompts ---");
    db.all("SELECT key, description, updated_at FROM system_prompts", (err, rows) => {
        if (err) {
            console.error("Error fetching prompts:", err);
            return;
        }
        if (rows.length === 0) {
            console.log("No system prompts found.");
        } else {
            console.table(rows);
        }
    });
});

db.close();
