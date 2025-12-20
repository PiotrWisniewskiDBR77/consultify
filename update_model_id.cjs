const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'server/consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("Updating Gemini model ID...");
    db.run("UPDATE llm_providers SET model_id = 'gemini-2.0-flash' WHERE provider = 'gemini'", function (err) {
        if (err) {
            console.error("Error updating model ID:", err);
            return;
        }
        console.log(`Updated ${this.changes} row(s).`);

        // Verify update
        db.get("SELECT provider, model_id FROM llm_providers WHERE provider = 'gemini'", (err, row) => {
            console.log("Current Config:", row);
        });
    });
});

db.close();
