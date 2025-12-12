const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, 'consultify.db');
const db = new sqlite3.Database(dbPath);

const IDS_TO_DELETE = [
    'f30bb1f3-b556-4e17-9f54-e170cc92251a', // Old OpenAI
    '21261bc5-6ef8-4709-bcae-940804fc9504', // Old Claude
    '5a42fa2b-5218-4ce0-bf98-6f7daf7169c0', // Old Google
    '31b8641f-bca3-406b-943e-8c95cd4a7922'  // Old Ollama (local)
];

db.serialize(() => {
    // 1. Delete Duplicates
    const placeholders = IDS_TO_DELETE.map(() => '?').join(',');
    db.run(`DELETE FROM llm_providers WHERE id IN (${placeholders})`, IDS_TO_DELETE, function (err) {
        if (err) console.error("Error deleting:", err);
        else console.log(`Deleted ${this.changes} duplicate rows.`);
    });

    // 2. Disable remaining Claude (User said "we don't have Cloud")
    db.run("UPDATE llm_providers SET is_active = 0 WHERE provider = 'anthropic'", function (err) {
        if (err) console.error("Error disabling Anthropic:", err);
        else console.log(`Disabled Anthropic (modified ${this.changes} rows).`);
    });

    // 3. Rename Google Gemini
    db.run("UPDATE llm_providers SET name = 'Google Gemini 2.0 Flash' WHERE provider = 'google'", function (err) {
        if (err) console.error("Error renaming Google:", err);
        else console.log(`Renamed Google (modified ${this.changes} rows).`);
    });

    // 4. Update Z.ai name just in case
    db.run("UPDATE llm_providers SET name = 'Zhipu AI (GLM-4)' WHERE provider = 'z_ai'", function (err) {
        // It was already correct but ensuring consistency
    });
});

setTimeout(() => db.close(), 1000);
