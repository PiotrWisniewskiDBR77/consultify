const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

console.log("Switching to Z.ai...");

db.serialize(() => {
    // 1. Reset defaults
    db.run("UPDATE llm_providers SET is_default = 0");

    // 2. Set Z.ai as default
    // Note: User image shows provider 'z.ai' or 'z_ai' in DB? 
    // From list_keys output (Step 253): row.provider was 'z_ai'.
    db.run("UPDATE llm_providers SET is_default = 1 WHERE provider = 'z_ai'", function (err) {
        if (err) return console.error(err);
        console.log(`Updated ${this.changes} rows for z_ai.`);

        db.all("SELECT provider, is_default, is_active FROM llm_providers", (err, rows) => {
            console.table(rows);
            db.close();
        });
    });
});
