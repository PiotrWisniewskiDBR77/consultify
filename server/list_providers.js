const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log("--- Content of llm_providers ---");
    db.all("SELECT id, name, provider, model_id, is_active FROM llm_providers", (err, rows) => {
        if (err) {
            console.error(err);
        } else {
            console.table(rows);
        }
        db.close();
    });
});
